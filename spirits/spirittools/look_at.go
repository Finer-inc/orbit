package spirittools

import (
	"context"
	"fmt"

	"seirei/spirits/worldclient"
)

type LookAtTool struct {
	client    *worldclient.Client
	spiritID  string
	actionLog *ActionLog
}

func NewLookAtTool(client *worldclient.Client, spiritID string, actionLog *ActionLog) *LookAtTool {
	return &LookAtTool{client: client, spiritID: spiritID, actionLog: actionLog}
}

func (t *LookAtTool) Name() string {
	return "look_at"
}

func (t *LookAtTool) Description() string {
	return "移動せずに指定した座標の方向を向く。会話前に相手の方を向いたり、気になる方向を見るときに使う。"
}

func (t *LookAtTool) Parameters() map[string]interface{} {
	return map[string]interface{}{
		"type": "object",
		"properties": map[string]interface{}{
			"x": map[string]interface{}{
				"type":        "number",
				"description": "向きたい方向のX座標",
			},
			"z": map[string]interface{}{
				"type":        "number",
				"description": "向きたい方向のZ座標",
			},
		},
		"required": []string{"x", "z"},
	}
}

func (t *LookAtTool) Execute(ctx context.Context, args map[string]interface{}) (string, error) {
	x, ok := toFloat64(args["x"])
	if !ok {
		return "エラー: x座標を数値で指定してください", nil
	}
	z, ok := toFloat64(args["z"])
	if !ok {
		return "エラー: z座標を数値で指定してください", nil
	}

	result, err := t.client.LookAt(t.spiritID, x, z)
	if err != nil {
		return "", fmt.Errorf("look_at failed: %w", err)
	}

	if !result.Success {
		return "向きを変えられませんでした", nil
	}

	t.actionLog.Add("look_at", fmt.Sprintf("[%.1f, %.1f]の方を向いた", x, z))
	return fmt.Sprintf("【向き変更】[%.1f, %.1f]の方向を向きました", x, z), nil
}
