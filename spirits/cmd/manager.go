package main

import (
	"context"
	"fmt"
	"math/rand"
	"sync"
	"time"

	"seirei/spirits/spirittools"
	"seirei/spirits/worldclient"

	"github.com/sipeed/picoclaw/pkg/agent"
	"github.com/sipeed/picoclaw/pkg/providers"
	"github.com/sipeed/picoclaw/pkg/tools"
)

type runningSpirit struct {
	config    spiritConfig
	cancel    context.CancelFunc
	done      chan struct{}
	startedAt time.Time
}

// AgentInfo is the public representation of a running spirit.
type AgentInfo struct {
	ID        string            `json:"id"`
	Name      string            `json:"name"`
	Color     string            `json:"color"`
	StartedAt time.Time         `json:"startedAt"`
	Workspace map[string]string `json:"workspace"`
}

// SpawnRequest describes a spirit to create dynamically.
type SpawnRequest struct {
	Name      string            `json:"name,omitempty"`
	Color     string            `json:"color,omitempty"`
	Workspace map[string]string `json:"workspace,omitempty"`
}

// SpawnResult is returned after successful spawn.
type SpawnResult struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Color string `json:"color"`
}

type SpiritManager struct {
	mu       sync.RWMutex
	spirits  map[string]*runningSpirit
	client   *worldclient.Client
	provider providers.LLMProvider
	model    string
	nameGen  *CombinatorialNameGen
	rootCtx  context.Context
	wg       sync.WaitGroup
	nextID   int
	usedNames map[string]bool
}

func NewSpiritManager(rootCtx context.Context, client *worldclient.Client, provider providers.LLMProvider, model string, nameGen *CombinatorialNameGen) *SpiritManager {
	return &SpiritManager{
		spirits:   make(map[string]*runningSpirit),
		client:    client,
		provider:  provider,
		model:     model,
		nameGen:   nameGen,
		rootCtx:   rootCtx,
		nextID:    1,
		usedNames: make(map[string]bool),
	}
}

// SpawnSpirit creates and starts a new spirit goroutine.
func (m *SpiritManager) SpawnSpirit(req SpawnRequest) (*SpawnResult, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	id := fmt.Sprintf("spirit-go-%d", m.nextID)
	m.nextID++

	// Name
	name := req.Name
	if name == "" {
		// Find next unused name from generator
		for i := 0; i < m.nameGen.MaxNames(); i++ {
			candidate := m.nameGen.Generate(i)
			if !m.usedNames[candidate] {
				name = candidate
				break
			}
		}
		if name == "" {
			return nil, fmt.Errorf("no more unique names available")
		}
	}
	if m.usedNames[name] {
		return nil, fmt.Errorf("name %q is already in use", name)
	}
	m.usedNames[name] = true

	// Color
	color := req.Color
	if color == "" {
		color = generateRandomColor()
	}

	// Position
	pos := generatePosition(m.client)

	// Workspace
	ws := req.Workspace
	if len(ws) == 0 {
		owners := getShuffledOwners()
		idx := rand.Intn(len(owners))
		ws = generateWorkspace(idx, owners)
	}

	timing := generateTiming()

	sp := spiritConfig{
		id:        id,
		name:      name,
		position:  pos,
		color:     color,
		workspace: ws,
		timing:    timing,
	}

	// Register with world server
	state, err := m.client.Register(sp.id, sp.name, sp.position, sp.color)
	if err != nil {
		m.usedNames[name] = false
		return nil, fmt.Errorf("register failed: %w", err)
	}

	log(sp.name, "登録完了 (%s) pos=[%.0f,%.0f] color=%s", sp.id, state.Position[0], state.Position[2], sp.color)

	// Build agent loop
	actionLog := spirittools.NewActionLog(30)
	registry := tools.NewToolRegistry()
	registry.Register(spirittools.NewObserveTool(m.client, sp.id))
	registry.Register(spirittools.NewMoveToTool(m.client, sp.id, actionLog))
	registry.Register(spirittools.NewWalkToTool(m.client, sp.id, actionLog))
	registry.Register(spirittools.NewLookAtTool(m.client, sp.id, actionLog))
	registry.Register(spirittools.NewSayTool(m.client, sp.id, actionLog))
	registry.Register(spirittools.NewSetGoalTool(m.client, sp.id, actionLog))
	registry.Register(spirittools.NewRestTool(m.client, sp.id, actionLog))
	registry.Register(spirittools.NewStopTool(m.client, sp.id, actionLog))

	systemPrompt := buildSystemPrompt(sp.name, sp.workspace)

	loop := agent.NewCustomLoop(agent.CustomLoopConfig{
		Provider:      m.provider,
		Tools:         registry,
		Model:         m.model,
		ContextWindow: 8192,
		MaxIterations: 4,
		SessionDir:    "",
		SystemPrompt:  systemPrompt,
	})

	// Create per-spirit context
	spiritCtx, spiritCancel := context.WithCancel(m.rootCtx)
	done := make(chan struct{})

	rs := &runningSpirit{
		config:    sp,
		cancel:    spiritCancel,
		done:      done,
		startedAt: time.Now(),
	}
	m.spirits[id] = rs

	m.wg.Add(1)
	go func() {
		defer m.wg.Done()
		defer close(done)
		runSpirit(spiritCtx, sp, loop, m.client, 0, actionLog)
	}()

	return &SpawnResult{
		ID:    id,
		Name:  name,
		Color: color,
	}, nil
}

// DespawnSpirit stops and unregisters a spirit.
func (m *SpiritManager) DespawnSpirit(id string) error {
	m.mu.Lock()
	rs, ok := m.spirits[id]
	if !ok {
		m.mu.Unlock()
		return fmt.Errorf("spirit %q not found", id)
	}
	delete(m.spirits, id)
	m.usedNames[rs.config.name] = false
	m.mu.Unlock()

	// Stop goroutine
	rs.cancel()
	<-rs.done

	// Unregister from world server
	if err := m.client.Unregister(id); err != nil {
		logErr(rs.config.name, "unregister失敗: %v", err)
		return err
	}

	log(rs.config.name, "退場完了 (%s)", id)
	return nil
}

// ListSpirits returns info about all running spirits.
func (m *SpiritManager) ListSpirits() []AgentInfo {
	m.mu.RLock()
	defer m.mu.RUnlock()

	result := make([]AgentInfo, 0, len(m.spirits))
	for _, rs := range m.spirits {
		result = append(result, AgentInfo{
			ID:        rs.config.id,
			Name:      rs.config.name,
			Color:     rs.config.color,
			StartedAt: rs.startedAt,
			Workspace: rs.config.workspace,
		})
	}
	return result
}

// WaitAll blocks until all spirit goroutines have finished.
func (m *SpiritManager) WaitAll() {
	m.wg.Wait()
}
