package main

import (
	"fmt"
	"math"
	"math/rand"
)

// Plaza centers where spirits spawn around (2x2 grid).
var plazaCenters = [][2]float64{
	{0, 0},
	{18, 0},
	{0, 18},
	{18, 18},
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
func generateSpirits(count int, nameGen NameGenerator) []spiritConfig {
	spirits := make([]spiritConfig, count)

	// Shuffle owner names for unique assignment
	shuffledOwners := make([]string, len(ownerNames))
	copy(shuffledOwners, ownerNames)
	rand.Shuffle(len(shuffledOwners), func(i, j int) {
		shuffledOwners[i], shuffledOwners[j] = shuffledOwners[j], shuffledOwners[i]
	})

	for i := 0; i < count; i++ {
		name := nameGen.Generate(i)
		color := generateColor(i, count)
		pos := generatePosition(i, count)
		persona := generatePersona(i, shuffledOwners)

		spirits[i] = spiritConfig{
			id:       fmt.Sprintf("spirit-go-%d", i+1),
			name:     name,
			position: pos,
			color:    color,
			persona:  persona,
		}
	}

	return spirits
}

// generateColor produces a pastel hex color using evenly-spaced hues.
func generateColor(index, total int) string {
	baseHue := float64(index) * 360.0 / float64(total)
	offset := rand.Float64()*30 - 15 // ±15 degree jitter
	hue := math.Mod(baseHue+offset+360, 360)
	sat := 50 + rand.Float64()*20  // 50-70%
	lit := 65 + rand.Float64()*10  // 65-75%
	return hslToHex(hue, sat, lit)
}

// generatePosition distributes spirits around plaza centers.
func generatePosition(index, total int) [3]float64 {
	plaza := plazaCenters[index%len(plazaCenters)]
	angle := 2 * math.Pi * float64(index) / float64(total)
	angle += (rand.Float64() - 0.5) * 0.5 // small angular jitter
	radius := 6 + rand.Float64()*6         // 6-12
	x := plaza[0] + radius*math.Cos(angle)
	z := plaza[1] + radius*math.Sin(angle)
	return [3]float64{math.Round(x*10) / 10, 0, math.Round(z*10) / 10}
}

// generatePersona creates a persona string from random profile elements.
func generatePersona(index int, shuffledOwners []string) string {
	owner := shuffledOwners[index%len(shuffledOwners)]

	// Pick 3 unique interests
	picked := pickN(interests, 3)
	interestStr := picked[0] + "、" + picked[1] + "、" + picked[2]

	// Pick 2 unique traits
	pickedTraits := pickN(traits, 2)
	traitStr := pickedTraits[0] + "、" + pickedTraits[1]

	// Flavor text from first trait
	flavor := flavorTemplates[pickedTraits[0]]
	if flavor == "" {
		flavor = "独特の雰囲気を持っています。"
	}

	return fmt.Sprintf(`あなたの持ち主のプロフィール:
- 名前: %s
- 興味: %s
- 性格: %s
あなたの人格はこのプロフィールを反映しています。%s`, owner, interestStr, traitStr, flavor)
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
