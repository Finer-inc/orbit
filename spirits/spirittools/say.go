package spirittools

import (
	"context"
	"fmt"

	"seirei/spirits/worldclient"
)

type SayTool struct {
	client   *worldclient.Client
	spiritID string
}

func NewSayTool(client *worldclient.Client, spiritID string) *SayTool {
	return &SayTool{client: client, spiritID: spiritID}
}

func (t *SayTool) Name() string {
	return "say"
}

func (t *SayTool) Description() string {
	return "声を出す。volume で声の大きさを指定: whisper(1.5m以内), normal(5.0m以内), shout(15.0m以内)。to で話しかける相手の精霊IDを指定できる（任意）。範囲内の全精霊に聞こえる。"
}

func (t *SayTool) Parameters() map[string]interface{} {
	return map[string]interface{}{
		"type": "object",
		"properties": map[string]interface{}{
			"message": map[string]interface{}{
				"type":        "string",
				"description": "言いたいこと",
			},
			"volume": map[string]interface{}{
				"type":        "string",
				"enum":        []string{"whisper", "normal", "shout"},
				"description": "声の大きさ: whisper(ささやき,1.5m), normal(通常,5.0m), shout(叫び,15.0m)",
			},
			"to": map[string]interface{}{
				"type":        "string",
				"description": "話しかける相手の精霊ID（任意。指定しなければ独り言）",
			},
		},
		"required": []string{"message", "volume"},
	}
}

func (t *SayTool) Execute(ctx context.Context, args map[string]interface{}) (string, error) {
	message, _ := args["message"].(string)
	volume, _ := args["volume"].(string)
	to, _ := args["to"].(string)

	if message == "" {
		return "エラー: message（言いたいこと）を指定してください", nil
	}
	if volume == "" {
		volume = "normal"
	}

	result, err := t.client.Say(t.spiritID, message, volume, to)
	if err != nil {
		return "", fmt.Errorf("say failed: %w", err)
	}

	if !result.Success {
		return fmt.Sprintf("発話に失敗しました: %s", result.Error), nil
	}

	volumeLabel := "通常の声"
	switch volume {
	case "whisper":
		volumeLabel = "ささやき"
	case "shout":
		volumeLabel = "叫び"
	}

	if to != "" {
		return fmt.Sprintf("【発話】%sに向かって「%s」と言った（%s、届いた精霊: %d体）", to, message, volumeLabel, result.Hearers), nil
	}
	return fmt.Sprintf("【発話】「%s」と言った（%s、届いた精霊: %d体）", message, volumeLabel, result.Hearers), nil
}
