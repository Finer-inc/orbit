package spirittools

import (
	"context"
	"fmt"
	"math"

	"seirei/spirits/worldclient"
)

const bedProximity = 2.0

type RestTool struct {
	client   *worldclient.Client
	spiritID string
}

func NewRestTool(client *worldclient.Client, spiritID string) *RestTool {
	return &RestTool{client: client, spiritID: spiritID}
}

func (t *RestTool) Name() string {
	return "rest"
}

func (t *RestTool) Description() string {
	return "家のベッドで休憩する。まず家に移動(move_to)してから使うこと。ベッドの近くにいないと失敗する。"
}

func (t *RestTool) Parameters() map[string]interface{} {
	return map[string]interface{}{
		"type":       "object",
		"properties": map[string]interface{}{},
	}
}

func (t *RestTool) Execute(ctx context.Context, args map[string]interface{}) (string, error) {
	// 自分の位置を取得
	spirit, err := t.client.GetSpirit(t.spiritID)
	if err != nil {
		return "", fmt.Errorf("rest failed: %w", err)
	}

	// ベッド一覧を取得
	beds, err := t.client.ListBeds()
	if err != nil {
		return "", fmt.Errorf("rest failed: %w", err)
	}

	// 最寄りのベッドとの距離を確認
	nearestDist := math.MaxFloat64
	nearestHouse := ""
	for _, bed := range beds {
		dx := spirit.Position[0] - bed.Position[0]
		dz := spirit.Position[2] - bed.Position[2]
		dist := math.Sqrt(dx*dx + dz*dz)
		if dist < nearestDist {
			nearestDist = dist
			nearestHouse = bed.HouseID
		}
	}

	if nearestDist > bedProximity {
		return fmt.Sprintf("【休憩失敗】ベッドの近くにいません（最寄り: %s, 距離%.1f）。まず家に move_to で移動してください。", nearestHouse, nearestDist), nil
	}

	// ベッドの近くにいる → resting状態に
	_, err = t.client.UpdateState(t.spiritID, "resting", nil, nil)
	if err != nil {
		return "", fmt.Errorf("rest failed: %w", err)
	}

	return "【休憩開始】ベッドで休んでいます。体力と思考力が回復します。", nil
}
