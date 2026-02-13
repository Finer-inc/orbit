package spirittools

import (
	"context"
	"fmt"
	"math"

	"seirei/spirits/worldclient"
)

type MoveToTool struct {
	client    *worldclient.Client
	spiritID  string
	actionLog *ActionLog
}

func NewMoveToTool(client *worldclient.Client, spiritID string, actionLog *ActionLog) *MoveToTool {
	return &MoveToTool{client: client, spiritID: spiritID, actionLog: actionLog}
}

func (t *MoveToTool) Name() string {
	return "move_to"
}

func (t *MoveToTool) Description() string {
	return "指定したオブジェクトの場所に移動する。observeで見えたオブジェクトのIDを指定する。"
}

func (t *MoveToTool) Parameters() map[string]interface{} {
	return map[string]interface{}{
		"type": "object",
		"properties": map[string]interface{}{
			"target": map[string]interface{}{
				"type":        "string",
				"description": "移動先のオブジェクトID（例: fountain-0, tree-1, house-0）",
			},
		},
		"required": []string{"target"},
	}
}

func (t *MoveToTool) Execute(ctx context.Context, args map[string]interface{}) (string, error) {
	target, ok := args["target"].(string)
	if !ok || target == "" {
		return "エラー: target（移動先のオブジェクトID）を指定してください", nil
	}

	// Resolve object position
	obj, err := t.client.GetObject(target)
	if err != nil {
		return fmt.Sprintf("エラー: オブジェクト「%s」が見つかりません", target), nil
	}

	targetX := obj.Position[0]
	targetZ := obj.Position[2]

	// Move spirit
	result, err := t.client.Move(t.spiritID, targetX, targetZ)
	if err != nil {
		return "", fmt.Errorf("move failed: %w", err)
	}

	if !result.Success {
		return "移動に失敗しました", nil
	}

	// Calculate distance moved from previous position (approximate from result)
	dist := math.Sqrt(
		math.Pow(result.NewPosition[0]-targetX, 2) +
			math.Pow(result.NewPosition[2]-targetZ, 2),
	)
	_ = dist

	t.actionLog.Add("move_to", fmt.Sprintf("%s（%s）の近くに移動した → [%.1f, %.1f]", target, obj.Type, result.NewPosition[0], result.NewPosition[2]))

	return fmt.Sprintf("【移動完了】%s（%s）の近くに移動しました。現在位置: [%.1f, %.1f, %.1f]",
		target, obj.Type, result.NewPosition[0], result.NewPosition[1], result.NewPosition[2]), nil
}
