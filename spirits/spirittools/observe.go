package spirittools

import (
	"context"
	"fmt"

	"seirei/spirits/worldclient"
)

type ObserveTool struct {
	client   *worldclient.Client
	spiritID string
}

func NewObserveTool(client *worldclient.Client, spiritID string) *ObserveTool {
	return &ObserveTool{client: client, spiritID: spiritID}
}

func (t *ObserveTool) Name() string {
	return "observe"
}

func (t *ObserveTool) Description() string {
	return "周囲を観察して、見えるオブジェクトや近くの精霊を知覚する"
}

func (t *ObserveTool) Parameters() map[string]interface{} {
	return map[string]interface{}{
		"type":       "object",
		"properties": map[string]interface{}{},
	}
}

func (t *ObserveTool) Execute(ctx context.Context, args map[string]interface{}) (string, error) {
	obs, err := t.client.Observe(t.spiritID)
	if err != nil {
		return "", fmt.Errorf("observe failed: %w", err)
	}

	result := fmt.Sprintf("【観察結果】時間帯: %s\n", obs.TimeOfDay)

	if len(obs.Objects) == 0 {
		result += "見えるもの: なし\n"
	} else {
		result += "見えるもの:\n"
		for _, obj := range obs.Objects {
			size := "小さい"
			if obj.ScreenOccupancy > 0.1 {
				size = "大きい"
			} else if obj.ScreenOccupancy > 0.03 {
				size = "中くらい"
			}
			result += fmt.Sprintf("  - %s (%s): 距離%.1f, %s\n", obj.ID, obj.Type, obj.Distance, size)
		}
	}

	if len(obs.Spirits) == 0 {
		result += "近くの精霊: いない\n"
	} else {
		result += "近くの精霊:\n"
		for _, s := range obs.Spirits {
			result += fmt.Sprintf("  - %s (ID: %s): 距離%.1f, 位置[%.1f, %.1f]\n", s.Name, s.ID, s.Distance, s.Position[0], s.Position[2])
		}
	}

	if len(obs.Voices) > 0 {
		result += "聞こえた声:\n"
		for _, v := range obs.Voices {
			var addressing string
			if v.To == t.spiritID {
				addressing = "あなたに向かって"
			} else if v.ToName != "" {
				addressing = fmt.Sprintf("%sに向かって", v.ToName)
			} else {
				addressing = "独り言"
			}
			volumeLabel := "通常の声"
			switch v.Volume {
			case "whisper":
				volumeLabel = "ささやき"
			case "shout":
				volumeLabel = "叫び"
			}
			result += fmt.Sprintf("  - %s（%s）:「%s」(距離%.1f, %s)\n", v.From, addressing, v.Message, v.Distance, volumeLabel)
		}
	}

	return result, nil
}
