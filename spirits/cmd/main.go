package main

import (
	"context"
	"fmt"
	"math"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/joho/godotenv"

	"seirei/spirits/anthropic"
	"seirei/spirits/spirittools"
	"seirei/spirits/worldclient"

	"github.com/sipeed/picoclaw/pkg/agent"
	"github.com/sipeed/picoclaw/pkg/tools"
)

// Behavior loop timing
const (
	PollInterval        = 5 * time.Second  // Event detection polling
	IdleThinkInterval   = 45 * time.Second // LLM call interval in idle
	ActiveThinkInterval = 15 * time.Second // LLM call interval in active
	ConvThinkInterval   = 4 * time.Second  // LLM call interval in conversing
	RestCheckInterval   = 15 * time.Second // Recovery check interval
	ConvTimeoutDuration = 30 * time.Second // Silence timeout for conversing→idle
)

// Mental energy
const (
	InitialMentalEnergy  = 100.0
	MaxMentalEnergy      = 100.0
	MentalCostPerThink   = 5.0
	MentalCostPerGoal    = 10.0
	MentalRecoveryPerSec = 3.0 / 60.0 // 3/min
	RestRecoveryMult     = 3.0
)

type spiritConfig struct {
	id       string
	name     string
	position [3]float64
	color    string
	persona  string
}

func main() {
	godotenv.Load()
	apiKey := os.Getenv("ANTHROPIC_API_KEY")
	if apiKey == "" {
		fmt.Fprintln(os.Stderr, "ANTHROPIC_API_KEY is required")
		os.Exit(1)
	}

	worldURL := os.Getenv("WORLD_SERVER_URL")
	if worldURL == "" {
		worldURL = "http://localhost:3001"
	}

	model := os.Getenv("MODEL")
	if model == "" {
		model = "claude-haiku-4-5-20251001"
	}

	client := worldclient.New(worldURL)

	countStr := os.Getenv("SPIRIT_COUNT")
	count := 5
	if countStr != "" {
		if n, err := strconv.Atoi(countStr); err == nil && n > 0 {
			count = n
		}
	}

	nameGen := NewCombinatorialNameGen()
	if count > nameGen.MaxNames() {
		fmt.Fprintf(os.Stderr, "SPIRIT_COUNT=%d exceeds max unique names (%d)\n", count, nameGen.MaxNames())
		os.Exit(1)
	}

	spirits := generateSpirits(count, nameGen)

	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt)
	defer cancel()

	var wg sync.WaitGroup

	for i, sp := range spirits {
		state, err := client.Register(sp.id, sp.name, sp.position, sp.color)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Register %s failed: %v\n", sp.name, err)
			os.Exit(1)
		}
		fmt.Printf("Spirit registered: %s at [%.0f, %.0f, %.0f]\n",
			state.Name, state.Position[0], state.Position[1], state.Position[2])

		registry := tools.NewToolRegistry()
		registry.Register(spirittools.NewObserveTool(client, sp.id))
		registry.Register(spirittools.NewMoveToTool(client, sp.id))
		registry.Register(spirittools.NewWalkToTool(client, sp.id))
		registry.Register(spirittools.NewLookAtTool(client, sp.id))
		registry.Register(spirittools.NewSayTool(client, sp.id))
		registry.Register(spirittools.NewSetGoalTool(client, sp.id))
		registry.Register(spirittools.NewRestTool(client, sp.id))

		systemPrompt := fmt.Sprintf(`あなたは「%s」という名前の精霊です。
バーチャルワールドに住んでいて、自由に探索し、他の精霊と交流します。

%s

使えるツール:
- observe: 周囲を観察する。正面の視野内（90°）のオブジェクトと精霊、声が知覚できる。声だけは全方位から聞こえる
  ※ 毎ターン自動で観察結果がプロンプトに含まれます。追加で別方向を見たいときだけ look_at + observe を使ってください。
- move_to: 指定したオブジェクトIDの場所に移動する（例: move_to(target="fountain-0")）
- walk_to: 任意の座標に歩いて移動する（例: walk_to(x=3.0, z=-5.0)）。精霊に近づくときはこれを使う
- look_at: 移動せずに指定座標の方向を向く（例: look_at(x=0.0, z=0.0)）。会話前に相手を見る、周囲を見回すときに使う
- say: 声を出す。範囲内の全精霊に聞こえる
  - volume: "whisper"(1.5m), "normal"(5.0m), "shout"(15.0m)
  - to: 話しかける相手のID（任意。省略すると独り言）
- set_goal: 目標とアプローチを宣言する。何をしたいか決まったら使う
  - goal: 大きな目的（例: "友達を作りたい"、"ワールドを探索したい"）
  - subgoal: 今のアプローチ（例: "みんなに話を聞く"、"噴水の周りを散歩する"）
- rest: 家のベッドで休憩する。ベッドの近くにいないと失敗する

ワールドの仕組み:
- 1回の移動で最大5mまでしか動けません。遠くに行くには何回かに分けて移動してください
- ワールドには家（house）があり、中にベッドがあります
- 休憩するには、まず家に move_to で移動してから rest を使ってください
- ベッドの近くにいないと rest は失敗します

行動のルール:
- 状態に応じて適切に行動してください
- idle状態: 何をしたいか考えて、set_goal で目標を宣言してください
- active状態: 目標に向かって行動してください
- conversing状態: 会話に集中してください。say で返事しましょう
- 声が聞こえたら、look_at で声の主の方を向いてから say で返事する
- 精霊が見えたら、look_at でそちらを向いてから say で話しかける
- 体力や思考力が低くなったら、早めに家に向かって休みましょう。枯渇してからでは遅いです
- 同じ場所にばかりいないで色々な場所を探索しましょう
- 前回までの行動を踏まえて行動してください`, sp.name, sp.persona)

		loop := agent.NewCustomLoop(agent.CustomLoopConfig{
			Provider:      anthropic.NewProvider(apiKey),
			Tools:         registry,
			Model:         model,
			ContextWindow: 8192,
			MaxIterations: 8,
			SessionDir:    "./sessions",
			SystemPrompt:  systemPrompt,
		})

		wg.Add(1)
		staggerDelay := time.Duration(i) * 2 * time.Second
		go runSpirit(ctx, &wg, sp, loop, client, staggerDelay)
	}

	fmt.Printf("\n>>> 状態ベース行動ループ開始 (%d体, Ctrl+C で停止)\n\n", len(spirits))

	wg.Wait()
	fmt.Println("\n>>> 全精霊停止")
}

func runSpirit(ctx context.Context, wg *sync.WaitGroup, sp spiritConfig, loop *agent.AgentLoop, client *worldclient.Client, staggerDelay time.Duration) {
	defer wg.Done()

	sessionKey := sp.id
	state := "idle"
	goal := ""
	subgoal := ""
	mentalEnergy := InitialMentalEnergy
	maxME := MaxMentalEnergy
	lastThink := time.Time{}
	lastVoiceHeard := time.Time{}
	lastEnergySync := time.Now()

	// Stagger start
	if staggerDelay > 0 {
		select {
		case <-ctx.Done():
			return
		case <-time.After(staggerDelay):
		}
	}

	// Report initial energy
	client.UpdateEnergy(sp.id, mentalEnergy, maxME)

	fmt.Printf("[%s] 行動ループ開始 (state=%s, ME=%.0f/%.0f)\n", sp.name, state, mentalEnergy, maxME)

	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		// 1. Lightweight event check via observe
		obs, err := client.Observe(sp.id)
		if err != nil {
			fmt.Fprintf(os.Stderr, "[%s] observe error: %v\n", sp.name, err)
			sleepCtx(ctx, PollInterval)
			continue
		}

		// 2. Event-driven state transitions
		if len(obs.Voices) > 0 && state != "conversing" {
			oldState := state
			state = "conversing"
			lastVoiceHeard = time.Now()
			client.UpdateState(sp.id, "conversing", nil, nil)
			fmt.Printf("[%s] %s → conversing (声が聞こえた)\n", sp.name, oldState)
		} else if len(obs.Voices) > 0 {
			lastVoiceHeard = time.Now()
		}

		// 3. Resource check — get latest stamina from server
		spirit, _ := client.GetSpirit(sp.id)
		if spirit != nil {
			// Sync state from server (set_goal/rest tools update server directly)
			if spirit.State != "" && spirit.State != state {
				fmt.Printf("[%s] サーバー同期: %s → %s\n", sp.name, state, spirit.State)
				state = spirit.State
			}
			if spirit.Goal != "" {
				goal = spirit.Goal
			}
			if spirit.Subgoal != "" {
				subgoal = spirit.Subgoal
			}
		}

		// Force resting if resources depleted (会話中は強制しない — LLMに切り上げを委ねる)
		// その場で休憩状態に入る。ベッド横臥はクライアント側でベッド近接時のみ表示
		if state != "resting" && state != "conversing" {
			if (spirit != nil && spirit.Stamina <= 0) || mentalEnergy <= 0 {
				state = "resting"
				client.UpdateState(sp.id, "resting", nil, nil)
				fmt.Printf("[%s] → resting (リソース枯渇)\n", sp.name)
			}
		}

		// 4. State-specific processing
		var sleepDuration time.Duration
		switch state {
		case "resting":
			// Recover mentalEnergy
			elapsed := RestCheckInterval.Seconds()
			mentalEnergy += MentalRecoveryPerSec * elapsed * RestRecoveryMult
			mentalEnergy = math.Min(mentalEnergy, maxME)

			// Check if recovered enough
			if spirit != nil && spirit.Stamina > spirit.MaxStamina*0.5 && mentalEnergy > maxME*0.3 {
				state = "idle"
				client.UpdateState(sp.id, "idle", nil, nil)
				fmt.Printf("[%s] resting → idle (回復完了: stamina=%.0f, ME=%.0f)\n",
					sp.name, spirit.Stamina, mentalEnergy)
			}
			sleepDuration = RestCheckInterval

		case "idle":
			if time.Since(lastThink) >= IdleThinkInterval && mentalEnergy >= MentalCostPerGoal {
				content := buildPrompt(state, goal, subgoal, spirit, mentalEnergy, maxME, obs, sp.id)
				fmt.Printf("[%s] idle思考 (ME=%.0f)\n", sp.name, mentalEnergy)
				response, err := loop.ProcessDirect(ctx, content, sessionKey)
				if err != nil {
					fmt.Fprintf(os.Stderr, "[%s] LLM error: %v\n", sp.name, err)
				} else {
					fmt.Printf("[%s] %s\n", sp.name, truncate(response, 200))
				}
				mentalEnergy -= MentalCostPerGoal
				lastThink = time.Now()
			}
			sleepDuration = PollInterval

		case "active":
			if time.Since(lastThink) >= ActiveThinkInterval && mentalEnergy >= MentalCostPerThink {
				content := buildPrompt(state, goal, subgoal, spirit, mentalEnergy, maxME, obs, sp.id)
				fmt.Printf("[%s] active思考: %s (ME=%.0f)\n", sp.name, goal, mentalEnergy)
				response, err := loop.ProcessDirect(ctx, content, sessionKey)
				if err != nil {
					fmt.Fprintf(os.Stderr, "[%s] LLM error: %v\n", sp.name, err)
				} else {
					fmt.Printf("[%s] %s\n", sp.name, truncate(response, 200))
				}
				mentalEnergy -= MentalCostPerThink
				lastThink = time.Now()
			}
			sleepDuration = PollInterval

		case "conversing":
			// 会話中はME借金を許容（-20まで）して切り上げる余裕を持たせる
			if time.Since(lastThink) >= ConvThinkInterval && mentalEnergy >= -20 {
				content := buildPrompt(state, goal, subgoal, spirit, mentalEnergy, maxME, obs, sp.id)
				fmt.Printf("[%s] conv思考 (ME=%.0f)\n", sp.name, mentalEnergy)
				response, err := loop.ProcessDirect(ctx, content, sessionKey)
				if err != nil {
					fmt.Fprintf(os.Stderr, "[%s] LLM error: %v\n", sp.name, err)
				} else {
					fmt.Printf("[%s] %s\n", sp.name, truncate(response, 200))
				}
				mentalEnergy -= MentalCostPerThink
				lastThink = time.Now()
			}
			// Conversation timeout
			if time.Since(lastVoiceHeard) > ConvTimeoutDuration {
				state = "idle"
				client.UpdateState(sp.id, "idle", nil, nil)
				fmt.Printf("[%s] conversing → idle (会話タイムアウト)\n", sp.name)
			}
			sleepDuration = 2 * time.Second
		}

		// 5. Natural mentalEnergy recovery (non-resting)
		if state != "resting" {
			elapsed := time.Since(lastEnergySync).Seconds()
			mentalEnergy += MentalRecoveryPerSec * elapsed
			mentalEnergy = math.Min(mentalEnergy, maxME)
		}
		lastEnergySync = time.Now()

		// 6. Report energy to server
		client.UpdateEnergy(sp.id, mentalEnergy, maxME)

		// 会話中は-20まで借金OK、それ以外は0でclamp
		if state == "conversing" {
			mentalEnergy = math.Max(-20, mentalEnergy)
		} else {
			mentalEnergy = math.Max(0, mentalEnergy)
		}

		sleepCtx(ctx, sleepDuration)
	}
}

func buildPrompt(state, goal, subgoal string, spirit *worldclient.SpiritState,
	mentalEnergy, maxME float64, obs *worldclient.ObservationResult, selfID string) string {

	var b strings.Builder

	// Status
	b.WriteString(fmt.Sprintf("あなたの状態: %s\n", state))
	if goal != "" {
		b.WriteString(fmt.Sprintf("目標: %s\n", goal))
	} else {
		b.WriteString("目標: なし\n")
	}
	if subgoal != "" {
		b.WriteString(fmt.Sprintf("アプローチ: %s\n", subgoal))
	}
	if spirit != nil {
		b.WriteString(fmt.Sprintf("体力: %.0f/%.0f  思考力: %.0f/%.0f\n",
			spirit.Stamina, spirit.MaxStamina, mentalEnergy, maxME))
	}

	// Observation
	b.WriteString(fmt.Sprintf("\n【観察結果】時間帯: %s\n", obs.TimeOfDay))

	if len(obs.Objects) == 0 {
		b.WriteString("見えるもの: なし\n")
	} else {
		b.WriteString("見えるもの:\n")
		for _, obj := range obs.Objects {
			size := "小さい"
			if obj.ScreenOccupancy > 0.1 {
				size = "大きい"
			} else if obj.ScreenOccupancy > 0.03 {
				size = "中くらい"
			}
			b.WriteString(fmt.Sprintf("  - %s (%s): 距離%.1f, %s\n", obj.ID, obj.Type, obj.Distance, size))
		}
	}

	if len(obs.Spirits) == 0 {
		b.WriteString("近くの精霊: いない\n")
	} else {
		b.WriteString("近くの精霊:\n")
		for _, s := range obs.Spirits {
			b.WriteString(fmt.Sprintf("  - %s (ID: %s): 距離%.1f, 位置[%.1f, %.1f]\n",
				s.Name, s.ID, s.Distance, s.Position[0], s.Position[2]))
		}
	}

	if len(obs.Voices) > 0 {
		b.WriteString("聞こえた声:\n")
		for _, v := range obs.Voices {
			var addressing string
			if v.To == selfID {
				addressing = "あなたに向かって"
			} else if v.ToName != "" {
				addressing = fmt.Sprintf("%sに向かって", v.ToName)
			} else {
				addressing = "独り言"
			}
			volumeLabel := "通常の声"
			switch v.Volume {
			case "whisper":
				volumeLabel = "ささやき"
			case "shout":
				volumeLabel = "叫び"
			}
			b.WriteString(fmt.Sprintf("  - %s（%s）:「%s」(距離%.1f, %s)\n",
				v.From, addressing, v.Message, v.Distance, volumeLabel))
		}
	}

	// State-specific instructions
	switch state {
	case "idle":
		b.WriteString("\n→ 何をしたいか考えて、set_goal で目標を宣言してください。何もなければそのままでOK。")
	case "active":
		b.WriteString("\n→ 目標に向かって次の行動を選んでください。体力が低ければ rest で休んでもOK。目標を変えたいなら set_goal で宣言。")
	case "conversing":
		if mentalEnergy < maxME*0.2 {
			b.WriteString("\n→ 思考力が残りわずかです。会話を自然に切り上げてください（例:「そろそろ休むね」「また話そう」）。別れの挨拶をしてから rest を使いましょう。")
		} else {
			b.WriteString("\n→ 会話を続けてください。say で返事しましょう。look_at で相手の方を向いてから話すとよい。")
		}
	}

	return b.String()
}

func sleepCtx(ctx context.Context, d time.Duration) {
	select {
	case <-ctx.Done():
	case <-time.After(d):
	}
}

func truncate(s string, maxLen int) string {
	// Truncate to first line or maxLen
	if idx := strings.Index(s, "\n"); idx >= 0 && idx < maxLen {
		return s[:idx] + "..."
	}
	if len(s) > maxLen {
		return s[:maxLen] + "..."
	}
	return s
}
