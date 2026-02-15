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
	return "指定したオブジェクトの場所に向かって歩き始める。observeで見えたオブジェクトのIDを指定する。"
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

	// Start walking to object
	result, err := t.client.Walk(t.spiritID, obj.Position[0], obj.Position[2])
	if err != nil {
		return "", fmt.Errorf("walk failed: %w", err)
	}

	if !result.Success {
		return "移動の開始に失敗しました", nil
	}

	// Estimate time
	me, _ := t.client.GetSpirit(t.spiritID)
	var estimatedTime float64
	if me != nil {
		dx := obj.Position[0] - me.Position[0]
		dz := obj.Position[2] - me.Position[2]
		dist := math.Sqrt(dx*dx + dz*dz)
		estimatedTime = dist / 2.0
	}

	t.actionLog.Add("move_to", fmt.Sprintf("%s（%s）に向かって歩き始めた", target, obj.Name))

	return fmt.Sprintf("【移動開始】%s（%s）に向かって歩き始めました。到着まで約%.0f秒。移動中も他のことができます。",
		target, obj.Name, estimatedTime), nil
}
