package spirittools

import (
	"context"
	"fmt"

	"seirei/spirits/worldclient"
)

type StopTool struct {
	client    *worldclient.Client
	spiritID  string
	actionLog *ActionLog
}

func NewStopTool(client *worldclient.Client, spiritID string, actionLog *ActionLog) *StopTool {
	return &StopTool{client: client, spiritID: spiritID, actionLog: actionLog}
}

func (t *StopTool) Name() string {
	return "stop"
}

func (t *StopTool) Description() string {
	return "移動中に立ち止まる。歩いている最中に何か気になることがあったら使う。"
}

func (t *StopTool) Parameters() map[string]interface{} {
	return map[string]interface{}{
		"type":       "object",
		"properties": map[string]interface{}{},
	}
}

func (t *StopTool) Execute(ctx context.Context, args map[string]interface{}) (string, error) {
	result, err := t.client.Stop(t.spiritID)
	if err != nil {
		return "", fmt.Errorf("stop failed: %w", err)
	}
	if !result.Success {
		return "停止に失敗しました", nil
	}
	t.actionLog.Add("stop", fmt.Sprintf("立ち止まった [%.1f, %.1f]", result.Position[0], result.Position[2]))
	return fmt.Sprintf("【停止】立ち止まりました。現在位置: [%.1f, %.1f, %.1f]",
		result.Position[0], result.Position[1], result.Position[2]), nil
}
