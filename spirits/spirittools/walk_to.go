package spirittools

import (
	"context"
	"fmt"
	"math"

	"seirei/spirits/worldclient"
)

const stopDistance = 1.5

type WalkToTool struct {
	client    *worldclient.Client
	spiritID  string
	actionLog *ActionLog
}

func NewWalkToTool(client *worldclient.Client, spiritID string, actionLog *ActionLog) *WalkToTool {
	return &WalkToTool{client: client, spiritID: spiritID, actionLog: actionLog}
}

func (t *WalkToTool) Name() string {
	return "walk_to"
}

func (t *WalkToTool) Description() string {
	return "指定した座標に向かって歩き始める。移動はサーバーが自動で進めるので、歩いている間も考えたり話したりできる。相手の1.5m手前で自動的に止まる。"
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

	// Get current position to calculate stop distance
	me, err := t.client.GetSpirit(t.spiritID)
	if err != nil {
		return "", fmt.Errorf("get spirit failed: %w", err)
	}

	dx := targetX - me.Position[0]
	dz := targetZ - me.Position[2]
	dist := math.Sqrt(dx*dx + dz*dz)

	// Stop 1.5m short of target
	finalX, finalZ := targetX, targetZ
	if dist > stopDistance {
		ratio := (dist - stopDistance) / dist
		finalX = me.Position[0] + dx*ratio
		finalZ = me.Position[2] + dz*ratio
	}

	result, err := t.client.Walk(t.spiritID, finalX, finalZ)
	if err != nil {
		return "", fmt.Errorf("walk failed: %w", err)
	}

	if !result.Success {
		return "移動の開始に失敗しました", nil
	}

	estimatedTime := dist / 2.0 // 2m/s

	t.actionLog.Add("walk_to", fmt.Sprintf("[%.1f, %.1f]に向かって歩き始めた", targetX, targetZ))

	return fmt.Sprintf("【移動開始】[%.1f, %.1f]に向かって歩き始めました。到着まで約%.0f秒。移動中も他のことができます。",
		targetX, targetZ, estimatedTime), nil
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
