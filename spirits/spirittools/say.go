package spirittools

import (
	"context"
	"fmt"
	"math"

	"seirei/spirits/worldclient"
)

var volumeRange = map[string]float64{
	"whisper": 1.5,
	"normal":  5.0,
	"shout":   15.0,
}

type SayTool struct {
	client    *worldclient.Client
	spiritID  string
	actionLog *ActionLog
}

func NewSayTool(client *worldclient.Client, spiritID string, actionLog *ActionLog) *SayTool {
	return &SayTool{client: client, spiritID: spiritID, actionLog: actionLog}
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
		// toの相手に届いたかチェック
		reached := true
		var distToTarget float64
		self, _ := t.client.GetSpirit(t.spiritID)
		target, _ := t.client.GetSpirit(to)
		if self != nil && target != nil {
			dx := self.Position[0] - target.Position[0]
			dz := self.Position[2] - target.Position[2]
			distToTarget = math.Sqrt(dx*dx + dz*dz)
			if distToTarget > volumeRange[volume] {
				reached = false
			}
		}
		if !reached {
			t.actionLog.Add("say", fmt.Sprintf("%sに「%s」と言ったが、%.0fm先で声が届かなかった", target.Name, message, distToTarget))
			return fmt.Sprintf("【発話】「%s」と言った（%s、届いた精霊: %d体）。ただし %s は %.0fm先にいるため声が届かなかった。近づくか、より大きな声(shout=15m)を使ってください", message, volumeLabel, result.Hearers, target.Name, distToTarget), nil
		}
		t.actionLog.Add("say", fmt.Sprintf("%sに「%s」と言った（%s、%d体に届いた）", to, message, volumeLabel, result.Hearers))
		return fmt.Sprintf("【発話】%sに向かって「%s」と言った（%s、届いた精霊: %d体）", to, message, volumeLabel, result.Hearers), nil
	}
	t.actionLog.Add("say", fmt.Sprintf("「%s」と言った（%s、%d体に届いた）", message, volumeLabel, result.Hearers))
	return fmt.Sprintf("【発話】「%s」と言った（%s、届いた精霊: %d体）", message, volumeLabel, result.Hearers), nil
}
