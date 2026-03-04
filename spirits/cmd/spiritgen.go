package main

import (
	"fmt"
	"math"
	"math/rand"
	"sync"
	"time"

	"seirei/spirits/worldclient"
)

// shuffledOwnersOnce ensures ownerNames are shuffled exactly once.
var (
	shuffledOwnersOnce sync.Once
	globalShuffledOwners []string
)

func getShuffledOwners() []string {
	shuffledOwnersOnce.Do(func() {
		globalShuffledOwners = make([]string, len(ownerNames))
		copy(globalShuffledOwners, ownerNames)
		rand.Shuffle(len(globalShuffledOwners), func(i, j int) {
			globalShuffledOwners[i], globalShuffledOwners[j] = globalShuffledOwners[j], globalShuffledOwners[i]
		})
	})
	return globalShuffledOwners
}

// Spawn bounds — defaults; overridden at runtime by SetSpawnBounds.
var (
	spawnMinX = -30.0
	spawnMaxX = 30.0
	spawnMinZ = -30.0
	spawnMaxZ = 30.0
)

// SetSpawnBounds updates the spawn area from server-provided world bounds.
func SetSpawnBounds(minX, maxX, minZ, maxZ float64) {
	spawnMinX = minX
	spawnMaxX = maxX
	spawnMinZ = minZ
	spawnMaxZ = maxZ
}

func isBlockedSpawn(_, _ float64) bool {
	return false
}

// Owner name pool (Japanese names).
var ownerNames = []string{
	"ユキ", "レン", "ミサキ", "タクヤ", "アオイ",
	"ハルカ", "ソウタ", "リン", "カイト", "ヒナ",
	"ナオキ", "サクラ", "ユウマ", "コトネ", "シュウ",
	"マナ", "リュウ", "ツバサ", "メイ", "ダイチ",
	"カナデ", "アキラ", "ノゾミ", "トウマ", "チヒロ",
	"イツキ", "フウカ", "ケイ", "ミツキ", "ヨシノ",
}

// Interest pool.
var interests = []string{
	"イラスト", "3Dモデリング", "アニメ", "プログラミング", "読書",
	"音楽", "料理", "ガーデニング", "カフェ巡り", "ゲーム",
	"格闘技", "筋トレ", "天文学", "哲学", "散歩",
	"写真撮影", "映画鑑賞", "手芸", "旅行", "ダンス",
}

// Personality trait pool.
var traits = []string{
	"好奇心旺盛", "明るい", "物静か", "観察力が鋭い", "おっとり",
	"世話好き", "元気", "負けず嫌い", "マイペース", "夢想家",
	"慎重", "社交的", "ロマンチスト", "几帳面", "天然",
}

// Trait-based flavor text templates.
var flavorTemplates = map[string]string{
	"好奇心旺盛":  "新しいものを見つけると目を輝かせます。",
	"明るい":    "いつもニコニコしていて周りを明るくします。",
	"物静か":    "言葉数は少ないが的確です。",
	"観察力が鋭い": "些細な変化もすぐに気づきます。",
	"おっとり":   "のんびりしていて癒し系です。",
	"世話好き":   "みんなの面倒を見たがります。",
	"元気":     "いつもパワー全開で走り回っています。",
	"負けず嫌い":  "何でも勝負にしたがります。",
	"マイペース":  "自分のペースを崩しません。",
	"夢想家":    "ぼんやり空を眺めるのが好きです。",
	"慎重":     "石橋を叩いて渡るタイプです。",
	"社交的":    "誰とでもすぐ仲良くなれます。",
	"ロマンチスト": "きれいなものに心を奪われがちです。",
	"几帳面":    "何でもきっちり整理しないと気が済みません。",
	"天然":     "不思議な発言で周囲を驚かせます。",
}

// generateSpirits creates spirit configurations with auto-generated attributes.
func generateSpirits(count int, nameGen NameGenerator, client *worldclient.Client) []spiritConfig {
	spirits := make([]spiritConfig, count)
	owners := getShuffledOwners()

	for i := 0; i < count; i++ {
		name := nameGen.Generate(i)
		color := generateColor(i, count)
		pos := generatePosition(client)
		ws := generateWorkspace(i, owners)
		timing := generateTiming()

		spirits[i] = spiritConfig{
			id:        fmt.Sprintf("spirit-go-%d", i+1),
			name:      name,
			position:  pos,
			color:     color,
			workspace: ws,
			timing:    timing,
		}
	}

	return spirits
}

// generateRandomColor produces a random pastel hex color (for dynamically added spirits).
func generateRandomColor() string {
	hue := rand.Float64() * 360
	sat := 50 + rand.Float64()*20 // 50-70%
	lit := 65 + rand.Float64()*10 // 65-75%
	return hslToHex(hue, sat, lit)
}

// generateTiming creates randomized per-spirit timing intervals.
// Each spirit gets unique intervals so they naturally drift apart over time.
func generateTiming() spiritTiming {
	return spiritTiming{
		idleThink:   randDuration(17, 27), // base 22s ± ~5s (was 45s)
		activeThink: randDuration(6, 9),   // base 7s ± ~1.5s (was 15s)
		convThink:   randDuration(2, 3),   // base 2.5s ± ~0.5s (was 4s)
		restCheck:   randDuration(6, 9),   // base 7s ± ~1.5s (was 15s)
	}
}

// randDuration returns a random duration between minSec and maxSec seconds.
func randDuration(minSec, maxSec float64) time.Duration {
	secs := minSec + rand.Float64()*(maxSec-minSec)
	return time.Duration(secs * float64(time.Second))
}

// generateColor produces a pastel hex color using evenly-spaced hues.
func generateColor(index, total int) string {
	baseHue := float64(index) * 360.0 / float64(total)
	offset := rand.Float64()*30 - 15 // ±15 degree jitter
	hue := math.Mod(baseHue+offset+360, 360)
	sat := 50 + rand.Float64()*20 // 50-70%
	lit := 65 + rand.Float64()*10 // 65-75%
	return hslToHex(hue, sat, lit)
}

// generatePosition gets a spawn point from the server, falling back to local bounds-based random.
func generatePosition(client *worldclient.Client) [3]float64 {
	// Try server-side spawn point first
	if client != nil {
		if result, err := client.GetSpawnPoint(); err == nil {
			return result.Position
		}
	}
	// Fallback: existing bounds-based random
	for i := 0; i < 128; i++ {
		x := spawnMinX + rand.Float64()*(spawnMaxX-spawnMinX)
		z := spawnMinZ + rand.Float64()*(spawnMaxZ-spawnMinZ)
		if isBlockedSpawn(x, z) {
			continue
		}
		return [3]float64{math.Round(x*10) / 10, 0, math.Round(z*10) / 10}
	}
	return [3]float64{0, 0, 0}
}

// generateWorkspace creates a workspace map from random profile elements.
func generateWorkspace(index int, shuffledOwners []string) map[string]string {
	owner := shuffledOwners[index%len(shuffledOwners)]
	picked := pickN(interests, 3)
	pickedTraits := pickN(traits, 2)
	flavor := flavorTemplates[pickedTraits[0]]
	if flavor == "" {
		flavor = "独特の雰囲気を持っています。"
	}

	return map[string]string{
		"soul": fmt.Sprintf("- 性格: %s、%s\n%s", pickedTraits[0], pickedTraits[1], flavor),
		"user": fmt.Sprintf("- 持ち主の名前: %s\n- 持ち主の興味: %s、%s、%s", owner, picked[0], picked[1], picked[2]),
	}
}

// pickN returns n unique random elements from the slice.
func pickN(pool []string, n int) []string {
	if n > len(pool) {
		n = len(pool)
	}
	indices := rand.Perm(len(pool))
	result := make([]string, n)
	for i := 0; i < n; i++ {
		result[i] = pool[indices[i]]
	}
	return result
}

// hslToHex converts HSL (h: 0-360, s: 0-100, l: 0-100) to a hex color string.
func hslToHex(h, s, l float64) string {
	s /= 100
	l /= 100

	c := (1 - math.Abs(2*l-1)) * s
	x := c * (1 - math.Abs(math.Mod(h/60, 2)-1))
	m := l - c/2

	var r, g, b float64
	switch {
	case h < 60:
		r, g, b = c, x, 0
	case h < 120:
		r, g, b = x, c, 0
	case h < 180:
		r, g, b = 0, c, x
	case h < 240:
		r, g, b = 0, x, c
	case h < 300:
		r, g, b = x, 0, c
	default:
		r, g, b = c, 0, x
	}

	ri := int(math.Round((r + m) * 255))
	gi := int(math.Round((g + m) * 255))
	bi := int(math.Round((b + m) * 255))

	return fmt.Sprintf("#%02x%02x%02x", ri, gi, bi)
}
