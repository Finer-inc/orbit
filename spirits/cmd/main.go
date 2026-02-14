package main

import (
	"context"
	"fmt"
	"math"
	"math/rand"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/joho/godotenv"

	"seirei/spirits/anthropic"
	"seirei/spirits/glm"
	"seirei/spirits/spirittools"
	"seirei/spirits/worldclient"

	"github.com/sipeed/picoclaw/pkg/agent"
	"github.com/sipeed/picoclaw/pkg/providers"
	"github.com/sipeed/picoclaw/pkg/tools"
)

// Behavior loop timing — base values (per-spirit intervals are randomized in spiritgen.go)
const (
	TickInterval        = 1 * time.Second  // World tick rate (all spirits)
	ConvTimeoutDuration = 30 * time.Second // Silence timeout for conversing→idle
	SayCooldown         = 10 * time.Second // Wait after speaking for response
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

type spiritTiming struct {
	idleThink   time.Duration // LLM call interval in idle
	activeThink time.Duration // LLM call interval in active
	convThink   time.Duration // LLM call interval in conversing
	restCheck   time.Duration // Recovery check interval
}

type spiritConfig struct {
	id       string
	name     string
	position [3]float64
	color    string
	persona  string
	timing   spiritTiming
}

// rateLimitedProvider wraps an LLMProvider with a concurrency semaphore.
type rateLimitedProvider struct {
	inner providers.LLMProvider
	sem   chan struct{}
}

func newRateLimitedProvider(inner providers.LLMProvider, maxConcurrent int) *rateLimitedProvider {
	return &rateLimitedProvider{
		inner: inner,
		sem:   make(chan struct{}, maxConcurrent),
	}
}

func (r *rateLimitedProvider) Chat(ctx context.Context, messages []providers.Message, tools []providers.ToolDefinition, model string, options map[string]interface{}) (*providers.LLMResponse, error) {
	select {
	case r.sem <- struct{}{}:
		defer func() { <-r.sem }()
	case <-ctx.Done():
		return nil, ctx.Err()
	}
	return r.inner.Chat(ctx, messages, tools, model, options)
}

func (r *rateLimitedProvider) GetDefaultModel() string {
	return r.inner.GetDefaultModel()
}

func main() {
	godotenv.Load()
	rand.Seed(time.Now().UnixNano())

	// Select LLM provider
	providerName := os.Getenv("LLM_PROVIDER")
	if providerName == "" {
		providerName = "glm"
	}

	var baseProvider providers.LLMProvider
	switch providerName {
	case "glm":
		glmKey := os.Getenv("GLM_API_KEY")
		if glmKey == "" {
			fmt.Fprintln(os.Stderr, "GLM_API_KEY is required when LLM_PROVIDER=glm")
			os.Exit(1)
		}
		baseProvider = glm.NewProvider(glmKey)
	case "anthropic":
		anthropicKey := os.Getenv("ANTHROPIC_API_KEY")
		if anthropicKey == "" {
			fmt.Fprintln(os.Stderr, "ANTHROPIC_API_KEY is required when LLM_PROVIDER=anthropic")
			os.Exit(1)
		}
		baseProvider = anthropic.NewProvider(anthropicKey)
	default:
		fmt.Fprintf(os.Stderr, "Unknown LLM_PROVIDER: %s (use 'glm' or 'anthropic')\n", providerName)
		os.Exit(1)
	}

	maxConcurrent := 3
	if v := os.Getenv("LLM_MAX_CONCURRENT"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			maxConcurrent = n
		}
	}
	provider := newRateLimitedProvider(baseProvider, maxConcurrent)
	fmt.Printf("LLMプロバイダー: %s (同時実行上限: %d)\n", providerName, maxConcurrent)

	model := os.Getenv("MODEL")
	if model == "" {
		model = provider.GetDefaultModel()
	}

	worldURL := os.Getenv("WORLD_SERVER_URL")
	if worldURL == "" {
		worldURL = "http://localhost:3001"
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

	fmt.Printf("=== 精霊生成完了: %d体 ===\n", count)
	for i, sp := range spirits {
		state, err := client.Register(sp.id, sp.name, sp.position, sp.color)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Register %s failed: %v\n", sp.name, err)
			os.Exit(1)
		}
		fmt.Printf("  %s (%s) pos=[%.0f,%.0f] color=%s timing=[idle=%ds active=%ds conv=%ds rest=%ds]\n",
			state.Name, sp.id, state.Position[0], state.Position[2], sp.color,
			int(sp.timing.idleThink.Seconds()), int(sp.timing.activeThink.Seconds()),
			int(sp.timing.convThink.Seconds()), int(sp.timing.restCheck.Seconds()))

		actionLog := spirittools.NewActionLog(30)

		registry := tools.NewToolRegistry()
		registry.Register(spirittools.NewObserveTool(client, sp.id))
		registry.Register(spirittools.NewMoveToTool(client, sp.id, actionLog))
		registry.Register(spirittools.NewWalkToTool(client, sp.id, actionLog))
		registry.Register(spirittools.NewLookAtTool(client, sp.id, actionLog))
		registry.Register(spirittools.NewSayTool(client, sp.id, actionLog))
		registry.Register(spirittools.NewSetGoalTool(client, sp.id, actionLog))
		registry.Register(spirittools.NewRestTool(client, sp.id, actionLog))
		registry.Register(spirittools.NewStopTool(client, sp.id, actionLog))

		systemPrompt := fmt.Sprintf(`あなたは「%s」という名前の精霊です。
バーチャルワールドに住んでいて、自由に探索し、他の精霊と交流します。

%s

使えるツール:
- observe: 周囲を観察する。正面の視野内（150°）のオブジェクトと精霊、声が知覚できる。声だけは全方位から聞こえる
  ※ 毎ターン自動で観察結果がプロンプトに含まれます。追加で別方向を見たいときだけ look_at + observe を使ってください。
- move_to: 指定したオブジェクトIDの場所に向かって歩き始める（例: move_to(target="fountain-0")）
- walk_to: 任意の座標に向かって歩き始める（例: walk_to(x=3.0, z=-5.0)）。精霊に近づくときはこれを使う
- stop: 移動中に立ち止まる。誰かに話しかけられたり、気になるものを見つけたら使う
- look_at: 移動せずに指定座標の方向を向く（例: look_at(x=0.0, z=0.0)）。会話前に相手を見る、周囲を見回すときに使う
- say: 声を出す。声は距離に応じた範囲内の全精霊に聞こえる
  - volume: "whisper"(1.5m以内), "normal"(5m以内), "shout"(15m以内)
  - to: 話しかける相手のID（任意。省略すると独り言）
  - 重要: 話しかける前に必ず walk_to で相手の近くまで移動してから say を使うこと。遠くから声をかけても届かない
  - 重要: セリフは画面に10秒間表示される。10秒で読める長さに収めること。長い話は複数回に分けて話す
- set_goal: 目標とアプローチを宣言する。何をしたいか決まったら使う
  - goal: 大きな目的（例: "友達を作りたい"、"ワールドを探索したい"）
  - subgoal: 今のアプローチ（例: "みんなに話を聞く"、"噴水の周りを散歩する"）
- rest: 家のベッドで休憩する。ベッドの近くにいないと失敗する

ワールドの仕組み:
- 移動速度は約2m/sです。遠い場所には数十秒かかります
- walk_to/move_to は「移動開始」です。到着を待ちません。移動中も考えたり話したりできます
- 移動中に声をかけられたら、stop で立ち止まって対応してください
- ワールドには家（house）があり、中にベッドがあります
- 休憩するには、まず家に move_to で移動してから rest を使ってください
- ベッドの近くにいないと rest は失敗します

行動のルール:
- 状態に応じて適切に行動してください
- idle状態: 何をしたいか考えて、set_goal で目標を宣言してください
- active状態: 目標に向かって行動してください
- conversing状態: 会話に集中してください。say で返事しましょう
- say の前には必ず look_at で相手の方を向くこと（意図的に背を向ける等の理由がない限り）
- 精霊が見えたら、まず walk_to で近づいてから say で話しかける。「通常の声で届く」と表示されるまで近づくこと
- 体力や思考力が低くなったら、早めに家に向かって休みましょう。枯渇してからでは遅いです
- 同じ場所にばかりいないで色々な場所を探索しましょう
- 前回までの行動を踏まえて行動してください`, sp.name, sp.persona)

		loop := agent.NewCustomLoop(agent.CustomLoopConfig{
			Provider:      provider,
			Tools:         registry,
			Model:         model,
			ContextWindow: 8192,
			MaxIterations: 4,
			SessionDir:    "",
			SystemPrompt:  systemPrompt,
		})

		wg.Add(1)
		startDelay := time.Duration(i) * 2 * time.Second
		go runSpirit(ctx, &wg, sp, loop, client, startDelay, actionLog)
	}

	ts := time.Now().Format("15:04:05")
	fmt.Printf("\n[%s] === 行動ループ開始 (%d体, tick=%s, Ctrl+C で停止) ===\n\n",
		ts, len(spirits), TickInterval)

	wg.Wait()
	ts = time.Now().Format("15:04:05")
	fmt.Printf("\n[%s] === 全精霊停止 ===\n", ts)
}

// log prints a timestamped, spirit-prefixed message.
func log(name, format string, args ...any) {
	ts := time.Now().Format("15:04:05")
	msg := fmt.Sprintf(format, args...)
	fmt.Printf("[%s][%s] %s\n", ts, name, msg)
}

// logErr prints a timestamped, spirit-prefixed error message to stderr.
func logErr(name, format string, args ...any) {
	ts := time.Now().Format("15:04:05")
	msg := fmt.Sprintf(format, args...)
	fmt.Fprintf(os.Stderr, "[%s][%s] ERROR: %s\n", ts, name, msg)
}

// posStr formats a spirit position for logging.
func posStr(spirit *worldclient.SpiritState) string {
	if spirit == nil {
		return "?"
	}
	return fmt.Sprintf("[%.1f,%.1f]", spirit.Position[0], spirit.Position[2])
}

// resourceStr formats stamina/ME for logging.
func resourceStr(spirit *worldclient.SpiritState, me, maxME float64) string {
	if spirit == nil {
		return fmt.Sprintf("ME=%.0f/%.0f", me, maxME)
	}
	return fmt.Sprintf("ST=%.0f/%.0f ME=%.0f/%.0f", spirit.Stamina, spirit.MaxStamina, me, maxME)
}

func runSpirit(ctx context.Context, wg *sync.WaitGroup, sp spiritConfig, loop *agent.AgentLoop, client *worldclient.Client, startDelay time.Duration, actionLog *spirittools.ActionLog) {
	defer wg.Done()

	// Stagger startup to avoid simultaneous API calls
	if startDelay > 0 {
		log(sp.name, "起動待機 %ds...", int(startDelay.Seconds()))
		sleepCtx(ctx, startDelay)
	}

	sessionKey := sp.id
	timing := sp.timing
	state := "idle"
	goal := ""
	subgoal := ""
	mentalEnergy := InitialMentalEnergy
	maxME := MaxMentalEnergy
	lastThink := time.Now().Add(-timing.idleThink) // Think on first tick after startDelay
	lastVoiceHeard := time.Time{}
	lastSayAt := time.Time{}
	lastEnergySync := time.Now()
	thinkCount := 0

	// Report initial energy
	client.UpdateEnergy(sp.id, mentalEnergy, maxME)

	log(sp.name, "行動ループ開始 state=%s %s", state, resourceStr(nil, mentalEnergy, maxME))

	for {
		select {
		case <-ctx.Done():
			log(sp.name, "停止 (計%d回思考)", thinkCount)
			return
		default:
		}

		// 1. Observe
		obs, err := client.Observe(sp.id)
		if err != nil {
			logErr(sp.name, "observe失敗: %v", err)
			sleepCtx(ctx, TickInterval)
			continue
		}

		// 2. Event-driven state transitions
		if len(obs.Voices) > 0 && state != "conversing" {
			oldState := state
			state = "conversing"
			lastVoiceHeard = time.Now()
			client.UpdateState(sp.id, "conversing", nil, nil)
			speakers := make([]string, len(obs.Voices))
			for i, v := range obs.Voices {
				speakers[i] = v.From
			}
			log(sp.name, "STATE %s→conversing 声: %s", oldState, strings.Join(speakers, ", "))
		} else if len(obs.Voices) > 0 {
			lastVoiceHeard = time.Now()
		}

		// Record heard voices to ActionLog
		for _, v := range obs.Voices {
			var summary string
			if v.To == sp.id {
				summary = fmt.Sprintf("%sがあなたに向かって「%s」と言った", v.From, v.Message)
			} else if v.ToName != "" {
				summary = fmt.Sprintf("%sが%sに向かって「%s」と言った", v.From, v.ToName, v.Message)
			} else {
				summary = fmt.Sprintf("%sの独り言「%s」が聞こえた", v.From, v.Message)
			}
			actionLog.Add("voice_heard", summary)
		}

		// 3. Resource check — sync state from server
		spirit, _ := client.GetSpirit(sp.id)
		if spirit != nil {
			if spirit.State != "" && spirit.State != state {
				log(sp.name, "SYNC %s→%s (サーバー)", state, spirit.State)
				state = spirit.State
			}
			if spirit.Goal != "" {
				goal = spirit.Goal
			}
			if spirit.Subgoal != "" {
				subgoal = spirit.Subgoal
			}
		}

		// Force resting if resources depleted
		if state != "resting" && state != "conversing" {
			if (spirit != nil && spirit.Stamina <= 0) || mentalEnergy <= 0 {
				state = "resting"
				client.UpdateState(sp.id, "resting", nil, nil)
				log(sp.name, "STATE →resting (リソース枯渇) %s pos=%s",
					resourceStr(spirit, mentalEnergy, maxME), posStr(spirit))
			}
		}

		// 4. Voice interrupt during movement: if called by name while walking, force think
		voiceInterrupt := false
		if spirit != nil && spirit.MovingTo != nil && len(obs.Voices) > 0 {
			for _, v := range obs.Voices {
				if v.To == sp.id {
					voiceInterrupt = true
					log(sp.name, "VOICE 移動中に呼びかけられた → Think割り込み")
					break
				}
			}
		}

		// 5. State-specific: check if it's time to think
		shouldThink := voiceInterrupt
		switch state {
		case "resting":
			mentalEnergy += MentalRecoveryPerSec * TickInterval.Seconds() * RestRecoveryMult
			mentalEnergy = math.Min(mentalEnergy, maxME)

			if time.Since(lastThink) >= timing.restCheck {
				if spirit != nil && spirit.Stamina > spirit.MaxStamina*0.5 && mentalEnergy > maxME*0.3 {
					state = "idle"
					client.UpdateState(sp.id, "idle", nil, nil)
					log(sp.name, "STATE resting→idle (回復完了) %s pos=%s",
						resourceStr(spirit, mentalEnergy, maxME), posStr(spirit))
				}
				lastThink = time.Now()
			}

		case "idle":
			if time.Since(lastThink) >= timing.idleThink && mentalEnergy >= MentalCostPerGoal {
				shouldThink = true
			}

		case "active":
			if time.Since(lastThink) >= timing.activeThink && mentalEnergy >= MentalCostPerThink {
				shouldThink = true
			}

		case "conversing":
			if time.Since(lastThink) >= timing.convThink && mentalEnergy >= -20 {
				// say後のcooldown: 相手の返答を待つ
				if !lastSayAt.IsZero() && time.Since(lastSayAt) < SayCooldown {
					// cooldown中だが、新しい声が聞こえたら即解除
					if len(obs.Voices) > 0 {
						log(sp.name, "SAY cooldown解除 (返答あり)")
						lastSayAt = time.Time{}
						shouldThink = true
					}
					// else: cooldown中、待つ
				} else {
					shouldThink = true
				}
			}
			if time.Since(lastVoiceHeard) > ConvTimeoutDuration {
				state = "idle"
				client.UpdateState(sp.id, "idle", nil, nil)
				log(sp.name, "STATE conversing→idle (会話タイムアウト %.0fs)",
					time.Since(lastVoiceHeard).Seconds())
				shouldThink = false
			}
		}

		// 5. LLM call
		if shouldThink {
			content := buildPrompt(state, goal, subgoal, spirit, mentalEnergy, maxME, obs, sp.id, actionLog)
			cost := MentalCostPerThink
			label := "active"
			extra := ""
			if state == "idle" {
				cost = MentalCostPerGoal
				label = "idle"
			} else if state == "conversing" {
				label = "conv"
			}
			if goal != "" {
				extra = fmt.Sprintf(" goal=%q", truncate(goal, 30))
			}

			log(sp.name, "THINK[%s] #%d %s pos=%s%s",
				label, thinkCount+1, resourceStr(spirit, mentalEnergy, maxME), posStr(spirit), extra)

			// Think前のlastSpeechAtを記録
			preSpeechAt := int64(0)
			if spirit != nil {
				preSpeechAt = spirit.LastSpeechAt
			}

			thinkStart := time.Now()
			response, err := loop.ProcessDirect(ctx, content, sessionKey)
			thinkDur := time.Since(thinkStart)

			if err != nil {
				logErr(sp.name, "LLM失敗 (%.1fs): %v", thinkDur.Seconds(), err)
			} else {
				log(sp.name, "REPLY (%.1fs): %s", thinkDur.Seconds(), truncate(response, 200))
			}

			// Think中にsayしたか検出
			postSpirit, _ := client.GetSpirit(sp.id)
			if postSpirit != nil && postSpirit.LastSpeechAt > preSpeechAt {
				lastSayAt = time.Now()
				log(sp.name, "SAY cooldown開始 (%ds)", int(SayCooldown.Seconds()))
			}

			mentalEnergy -= cost
			lastThink = time.Now()
			thinkCount++
		}

		// 6. Natural mentalEnergy recovery (non-resting)
		if state != "resting" {
			elapsed := time.Since(lastEnergySync).Seconds()
			mentalEnergy += MentalRecoveryPerSec * elapsed
			mentalEnergy = math.Min(mentalEnergy, maxME)
		}
		lastEnergySync = time.Now()

		// 7. Report energy to server
		client.UpdateEnergy(sp.id, mentalEnergy, maxME)

		// Clamp
		if state == "conversing" {
			mentalEnergy = math.Max(-20, mentalEnergy)
		} else {
			mentalEnergy = math.Max(0, mentalEnergy)
		}

		sleepCtx(ctx, TickInterval)
	}
}

func buildPrompt(state, goal, subgoal string, spirit *worldclient.SpiritState,
	mentalEnergy, maxME float64, obs *worldclient.ObservationResult, selfID string,
	actionLog *spirittools.ActionLog) string {

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
		if spirit.MovingTo != nil {
			b.WriteString(fmt.Sprintf("移動中: [%.1f, %.1f]に向かって歩いています\n",
				spirit.MovingTo[0], spirit.MovingTo[1]))
		}
	}

	// Memory
	if actionLog != nil {
		memorySection := actionLog.Render()
		if memorySection != "" {
			b.WriteString("\n")
			b.WriteString(memorySection)
		}
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
		b.WriteString("視界に入った精霊: いない\n")
	} else {
		b.WriteString("視界に入った精霊:\n")
		for _, s := range obs.Spirits {
			var reachability string
			switch {
			case s.Distance <= 1.5:
				reachability = "ささやきでも届く"
			case s.Distance <= 5.0:
				reachability = "通常の声で届く"
			case s.Distance <= 15.0:
				reachability = fmt.Sprintf("叫べば届く（%.0fm先）。ただし周囲にも聞こえる", s.Distance)
			default:
				reachability = fmt.Sprintf("声が届かない（%.0fm先）。近づく必要あり", s.Distance)
			}
			b.WriteString(fmt.Sprintf("  - %s (ID: %s): 距離%.1f, 位置[%.1f, %.1f] → %s\n",
				s.Name, s.ID, s.Distance, s.Position[0], s.Position[2], reachability))
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
			b.WriteString("\n→ 会話を続けてください。say の前に look_at で相手の方を向いてから返事しましょう。")
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
