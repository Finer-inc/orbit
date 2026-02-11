package spirittools

import (
	"context"
	"fmt"

	"seirei/spirits/worldclient"
)

type SetGoalTool struct {
	client   *worldclient.Client
	spiritID string
}

func NewSetGoalTool(client *worldclient.Client, spiritID string) *SetGoalTool {
	return &SetGoalTool{client: client, spiritID: spiritID}
}

func (t *SetGoalTool) Name() string {
	return "set_goal"
}

func (t *SetGoalTool) Description() string {
	return "目標（goal）とアプローチ（subgoal）を宣言する。目標を設定すると active 状態になる。"
}

func (t *SetGoalTool) Parameters() map[string]interface{} {
	return map[string]interface{}{
		"type": "object",
		"properties": map[string]interface{}{
			"goal": map[string]interface{}{
				"type":        "string",
				"description": "達成したい大きな目的（例: 友達を作りたい、ワールドを探索したい）",
			},
			"subgoal": map[string]interface{}{
				"type":        "string",
				"description": "今のアプローチ（例: みんなに話を聞く、噴水の周りを散歩する）",
			},
		},
		"required": []string{"goal"},
	}
}

func (t *SetGoalTool) Execute(ctx context.Context, args map[string]interface{}) (string, error) {
	goal, _ := args["goal"].(string)
	if goal == "" {
		return "エラー: goal（目標）を指定してください", nil
	}

	subgoal, _ := args["subgoal"].(string)
	var subgoalPtr *string
	if subgoal != "" {
		subgoalPtr = &subgoal
	}

	_, err := t.client.UpdateState(t.spiritID, "active", &goal, subgoalPtr)
	if err != nil {
		return "", fmt.Errorf("set_goal failed: %w", err)
	}

	if subgoal != "" {
		return fmt.Sprintf("【目標設定】目標: %s / アプローチ: %s", goal, subgoal), nil
	}
	return fmt.Sprintf("【目標設定】目標: %s", goal), nil
}
