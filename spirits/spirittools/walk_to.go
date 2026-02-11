package spirittools

import (
	"context"
	"fmt"
	"math"

	"seirei/spirits/worldclient"
)

const stopDistance = 1.5

type WalkToTool struct {
	client   *worldclient.Client
	spiritID string
}

func NewWalkToTool(client *worldclient.Client, spiritID string) *WalkToTool {
	return &WalkToTool{client: client, spiritID: spiritID}
}

func (t *WalkToTool) Name() string {
	return "walk_to"
}

func (t *WalkToTool) Description() string {
	return "指定した座標に歩いて移動する。精霊の位置やオブジェクトの位置など、任意の座標に使える。相手の1.5m手前で自動的に止まる。"
}

func (t *WalkToTool) Parameters() map[string]interface{} {
	return map[string]interface{}{
		"type": "object",
		"properties": map[string]interface{}{
			"x": map[string]interface{}{
				"type":        "number",
				"description": "移動先のX座標",
			},
			"z": map[string]interface{}{
				"type":        "number",
				"description": "移動先のZ座標",
			},
		},
		"required": []string{"x", "z"},
	}
}

func (t *WalkToTool) Execute(ctx context.Context, args map[string]interface{}) (string, error) {
	targetX, ok := toFloat64(args["x"])
	if !ok {
		return "エラー: x座標を数値で指定してください", nil
	}
	targetZ, ok := toFloat64(args["z"])
	if !ok {
		return "エラー: z座標を数値で指定してください", nil
	}

	// Get current position to stop short of target
	me, err := t.client.GetSpirit(t.spiritID)
	if err != nil {
		return "", fmt.Errorf("get spirit failed: %w", err)
	}

	dx := targetX - me.Position[0]
	dz := targetZ - me.Position[2]
	dist := math.Sqrt(dx*dx + dz*dz)

	finalX, finalZ := targetX, targetZ
	if dist > stopDistance {
		ratio := (dist - stopDistance) / dist
		finalX = me.Position[0] + dx*ratio
		finalZ = me.Position[2] + dz*ratio
	}

	result, err := t.client.Move(t.spiritID, finalX, finalZ)
	if err != nil {
		return "", fmt.Errorf("walk failed: %w", err)
	}

	if !result.Success {
		return "移動に失敗しました", nil
	}

	return fmt.Sprintf("【移動完了】目標[%.1f, %.1f]の近くに移動しました。現在位置: [%.1f, %.1f, %.1f]",
		targetX, targetZ, result.NewPosition[0], result.NewPosition[1], result.NewPosition[2]), nil
}

func toFloat64(v interface{}) (float64, bool) {
	switch n := v.(type) {
	case float64:
		return n, true
	case int:
		return float64(n), true
	case int64:
		return float64(n), true
	default:
		return 0, false
	}
}
