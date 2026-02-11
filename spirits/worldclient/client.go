package worldclient

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

type Client struct {
	baseURL    string
	httpClient *http.Client
}

func New(baseURL string) *Client {
	return &Client{
		baseURL:    baseURL,
		httpClient: &http.Client{},
	}
}

type SpiritState struct {
	ID            string     `json:"id"`
	Name          string     `json:"name"`
	Position      [3]float64 `json:"position"`
	RotationY     float64    `json:"rotationY"`
	CurrentAction *string    `json:"currentAction"`
	LastThinkAt   int64      `json:"lastThinkAt"`
	Color         string     `json:"color"`
	LastSpeech    string     `json:"lastSpeech,omitempty"`
	LastSpeechAt  int64      `json:"lastSpeechAt,omitempty"`
	// Behavior system
	State           string  `json:"state"`
	Goal            string  `json:"goal,omitempty"`
	Subgoal         string  `json:"subgoal,omitempty"`
	Stamina         float64 `json:"stamina"`
	MaxStamina      float64 `json:"maxStamina"`
	MentalEnergy    float64 `json:"mentalEnergy"`
	MaxMentalEnergy float64 `json:"maxMentalEnergy"`
}

type VisibleObject struct {
	ID              string     `json:"id"`
	Type            string     `json:"type"`
	Position        [3]float64 `json:"position"`
	Distance        float64    `json:"distance"`
	ScreenOccupancy float64    `json:"screenOccupancy"`
}

type NearbySpiritInfo struct {
	ID       string     `json:"id"`
	Name     string     `json:"name"`
	Distance float64    `json:"distance"`
	Position [3]float64 `json:"position"`
}

type HeardVoice struct {
	From     string  `json:"from"`
	FromID   string  `json:"fromId"`
	To       string  `json:"to,omitempty"`
	ToName   string  `json:"toName,omitempty"`
	Message  string  `json:"message"`
	Volume   string  `json:"volume"`
	Distance float64 `json:"distance"`
}

type ObservationResult struct {
	Objects   []VisibleObject    `json:"objects"`
	Spirits   []NearbySpiritInfo `json:"spirits"`
	TimeOfDay string             `json:"timeOfDay"`
	Voices    []HeardVoice       `json:"voices"`
}

type SayResult struct {
	Success bool   `json:"success"`
	Hearers int    `json:"hearers"`
	Error   string `json:"error,omitempty"`
}

type MoveResult struct {
	Success     bool       `json:"success"`
	NewPosition [3]float64 `json:"newPosition"`
	NewRotation float64    `json:"newRotation"`
}

type BedInfo struct {
	HouseID  string     `json:"houseId"`
	Position [3]float64 `json:"position"`
}

type WorldObject struct {
	ID          string     `json:"id"`
	Type        string     `json:"type"`
	Position    [3]float64 `json:"position"`
	BoundingBox struct {
		Min [3]float64 `json:"min"`
		Max [3]float64 `json:"max"`
	} `json:"boundingBox"`
}

func (c *Client) Register(id, name string, position [3]float64, color string) (*SpiritState, error) {
	body := map[string]interface{}{
		"id":       id,
		"name":     name,
		"position": position,
		"color":    color,
	}
	var state SpiritState
	if err := c.post("/api/spirits/register", body, &state); err != nil {
		return nil, err
	}
	return &state, nil
}

func (c *Client) Observe(spiritID string) (*ObservationResult, error) {
	var result ObservationResult
	if err := c.post(fmt.Sprintf("/api/spirits/%s/observe", spiritID), nil, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

func (c *Client) Move(spiritID string, targetX, targetZ float64) (*MoveResult, error) {
	body := map[string]interface{}{
		"targetX": targetX,
		"targetZ": targetZ,
	}
	var result MoveResult
	if err := c.post(fmt.Sprintf("/api/spirits/%s/move", spiritID), body, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

type LookAtResult struct {
	Success     bool    `json:"success"`
	NewRotation float64 `json:"newRotation"`
}

func (c *Client) LookAt(spiritID string, targetX, targetZ float64) (*LookAtResult, error) {
	body := map[string]interface{}{
		"targetX": targetX,
		"targetZ": targetZ,
	}
	var result LookAtResult
	if err := c.post(fmt.Sprintf("/api/spirits/%s/look_at", spiritID), body, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

func (c *Client) Say(spiritID, message, volume string, to string) (*SayResult, error) {
	body := map[string]interface{}{
		"message": message,
		"volume":  volume,
	}
	if to != "" {
		body["to"] = to
	}
	var result SayResult
	if err := c.post(fmt.Sprintf("/api/spirits/%s/say", spiritID), body, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

func (c *Client) GetSpirit(spiritID string) (*SpiritState, error) {
	var state SpiritState
	if err := c.get(fmt.Sprintf("/api/spirits/%s", spiritID), &state); err != nil {
		return nil, err
	}
	return &state, nil
}

func (c *Client) GetObject(objectID string) (*WorldObject, error) {
	var obj WorldObject
	if err := c.get(fmt.Sprintf("/api/world/objects/%s", objectID), &obj); err != nil {
		return nil, err
	}
	return &obj, nil
}

func (c *Client) ListBeds() ([]BedInfo, error) {
	var beds []BedInfo
	if err := c.get("/api/world/beds", &beds); err != nil {
		return nil, err
	}
	return beds, nil
}

func (c *Client) UpdateState(spiritID, state string, goal, subgoal *string) (*SpiritState, error) {
	body := map[string]interface{}{
		"state": state,
	}
	if goal != nil {
		body["goal"] = *goal
	}
	if subgoal != nil {
		body["subgoal"] = *subgoal
	}
	var result SpiritState
	if err := c.patch(fmt.Sprintf("/api/spirits/%s/state", spiritID), body, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

func (c *Client) UpdateEnergy(spiritID string, mentalEnergy, maxMentalEnergy float64) (*SpiritState, error) {
	body := map[string]interface{}{
		"mentalEnergy":    mentalEnergy,
		"maxMentalEnergy": maxMentalEnergy,
	}
	var result SpiritState
	if err := c.patch(fmt.Sprintf("/api/spirits/%s/energy", spiritID), body, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

func (c *Client) get(path string, result interface{}) error {
	req, err := http.NewRequest("GET", c.baseURL+path, nil)
	if err != nil {
		return err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		data, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(data))
	}

	return json.NewDecoder(resp.Body).Decode(result)
}

func (c *Client) post(path string, body interface{}, result interface{}) error {
	var reqBody io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return err
		}
		reqBody = bytes.NewReader(data)
	}

	req, err := http.NewRequest("POST", c.baseURL+path, reqBody)
	if err != nil {
		return err
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		data, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(data))
	}

	return json.NewDecoder(resp.Body).Decode(result)
}

func (c *Client) patch(path string, body interface{}, result interface{}) error {
	data, err := json.Marshal(body)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("PATCH", c.baseURL+path, bytes.NewReader(data))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		respData, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(respData))
	}

	return json.NewDecoder(resp.Body).Decode(result)
}
