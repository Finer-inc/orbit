package glm

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"

	"github.com/sipeed/picoclaw/pkg/providers"
)

// GLM sometimes outputs tool calls as text instead of proper function calls.
// Pattern: toolName<arg_key>key1</arg_key><arg_value>val1</arg_value>...
var textToolCallRe = regexp.MustCompile(`^(\w+)(<arg_key>.*</arg_value>.*)`)
var argPairRe = regexp.MustCompile(`<arg_key>([^<]+)</arg_key><arg_value>([^<]*)</arg_value>`)

const (
	defaultBaseURL = "https://open.bigmodel.cn/api/paas/v4"
	defaultModel   = "glm-4.7"
)

type Provider struct {
	apiKey     string
	baseURL    string
	httpClient *http.Client
}

func NewProvider(apiKey string) *Provider {
	return &Provider{
		apiKey:     apiKey,
		baseURL:    defaultBaseURL,
		httpClient: &http.Client{},
	}
}

func (p *Provider) GetDefaultModel() string {
	return defaultModel
}

func (p *Provider) Chat(ctx context.Context, messages []providers.Message, tools []providers.ToolDefinition, model string, options map[string]interface{}) (*providers.LLMResponse, error) {
	// Build OpenAI-compatible messages (system stays as role:"system" in the array)
	apiMessages := make([]map[string]interface{}, 0, len(messages))

	for _, m := range messages {
		switch m.Role {
		case "system", "user":
			apiMessages = append(apiMessages, map[string]interface{}{
				"role":    m.Role,
				"content": m.Content,
			})
		case "assistant":
			msg := map[string]interface{}{
				"role": "assistant",
			}
			if m.Content != "" {
				msg["content"] = m.Content
			}
			if len(m.ToolCalls) > 0 {
				tcs := make([]map[string]interface{}, 0, len(m.ToolCalls))
				for _, tc := range m.ToolCalls {
					name := tc.Name
					argsStr := ""
					if tc.Function != nil {
						name = tc.Function.Name
						argsStr = tc.Function.Arguments
					} else if len(tc.Arguments) > 0 {
						b, _ := json.Marshal(tc.Arguments)
						argsStr = string(b)
					}
					tcs = append(tcs, map[string]interface{}{
						"id":   tc.ID,
						"type": "function",
						"function": map[string]string{
							"name":      name,
							"arguments": argsStr,
						},
					})
				}
				msg["tool_calls"] = tcs
			}
			apiMessages = append(apiMessages, msg)
		case "tool":
			apiMessages = append(apiMessages, map[string]interface{}{
				"role":         "tool",
				"content":      m.Content,
				"tool_call_id": m.ToolCallID,
			})
		}
	}

	reqBody := map[string]interface{}{
		"model":    model,
		"messages": apiMessages,
		"thinking": map[string]string{"type": "disabled"},
	}

	if len(tools) > 0 {
		reqBody["tools"] = tools
		reqBody["tool_choice"] = "auto"
	}

	if maxTokens, ok := options["max_tokens"].(int); ok {
		reqBody["max_tokens"] = maxTokens
	}
	if temp, ok := options["temperature"].(float64); ok {
		reqBody["temperature"] = temp
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", p.baseURL+"/chat/completions", bytes.NewReader(jsonData))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+p.apiKey)

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("send request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("GLM API error %d: %s", resp.StatusCode, string(body))
	}

	return p.parseResponse(body)
}

func (p *Provider) parseResponse(body []byte) (*providers.LLMResponse, error) {
	var apiResp struct {
		Choices []struct {
			Message struct {
				Content   string `json:"content"`
				ToolCalls []struct {
					ID       string `json:"id"`
					Type     string `json:"type"`
					Function *struct {
						Name      string `json:"name"`
						Arguments string `json:"arguments"`
					} `json:"function"`
				} `json:"tool_calls"`
			} `json:"message"`
			FinishReason string `json:"finish_reason"`
		} `json:"choices"`
		Usage *struct {
			PromptTokens     int `json:"prompt_tokens"`
			CompletionTokens int `json:"completion_tokens"`
			TotalTokens      int `json:"total_tokens"`
		} `json:"usage"`
	}

	if err := json.Unmarshal(body, &apiResp); err != nil {
		return nil, fmt.Errorf("unmarshal response: %w (body: %s)", err, string(body))
	}

	if len(apiResp.Choices) == 0 {
		return &providers.LLMResponse{
			Content:      "",
			FinishReason: "stop",
		}, nil
	}

	choice := apiResp.Choices[0]

	toolCalls := make([]providers.ToolCall, 0, len(choice.Message.ToolCalls))
	for _, tc := range choice.Message.ToolCalls {
		arguments := make(map[string]interface{})
		name := ""

		if tc.Function != nil {
			name = tc.Function.Name
			if tc.Function.Arguments != "" {
				if err := json.Unmarshal([]byte(tc.Function.Arguments), &arguments); err != nil {
					arguments["raw"] = tc.Function.Arguments
				}
			}
		}

		toolCalls = append(toolCalls, providers.ToolCall{
			ID:        tc.ID,
			Name:      name,
			Arguments: arguments,
		})
	}

	// GLM sometimes outputs tool calls as text (e.g. "say<arg_key>message</arg_key><arg_value>hello</arg_value>")
	// Detect and convert to proper tool calls.
	content := choice.Message.Content
	if len(toolCalls) == 0 && strings.Contains(content, "<arg_key>") {
		if parsed := parseTextToolCall(content); parsed != nil {
			toolCalls = append(toolCalls, *parsed)
			content = "" // consumed as tool call
		}
	}

	result := &providers.LLMResponse{
		Content:      content,
		ToolCalls:    toolCalls,
		FinishReason: choice.FinishReason,
	}

	if apiResp.Usage != nil {
		result.Usage = &providers.UsageInfo{
			PromptTokens:     apiResp.Usage.PromptTokens,
			CompletionTokens: apiResp.Usage.CompletionTokens,
			TotalTokens:      apiResp.Usage.TotalTokens,
		}
	}

	return result, nil
}

// parseTextToolCall extracts a tool call from GLM's text-format output.
// Input: "say<arg_key>message</arg_key><arg_value>hello</arg_value><arg_key>volume</arg_key><arg_value>normal</arg_value>"
// Returns a ToolCall with name="say", arguments={"message":"hello","volume":"normal"}
func parseTextToolCall(content string) *providers.ToolCall {
	m := textToolCallRe.FindStringSubmatch(content)
	if m == nil {
		return nil
	}
	name := m[1]
	pairs := argPairRe.FindAllStringSubmatch(m[2], -1)
	if len(pairs) == 0 {
		return nil
	}
	args := make(map[string]interface{}, len(pairs))
	for _, p := range pairs {
		args[p[1]] = p[2]
	}
	return &providers.ToolCall{
		ID:        fmt.Sprintf("text_tc_%s", name),
		Name:      name,
		Arguments: args,
	}
}
