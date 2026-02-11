package anthropic

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/sipeed/picoclaw/pkg/providers"
)

type Provider struct {
	apiKey     string
	httpClient *http.Client
}

func NewProvider(apiKey string) *Provider {
	return &Provider{
		apiKey:     apiKey,
		httpClient: &http.Client{},
	}
}

func (p *Provider) GetDefaultModel() string {
	return "claude-haiku-4-5-20251001"
}

func (p *Provider) Chat(ctx context.Context, messages []providers.Message, tools []providers.ToolDefinition, model string, options map[string]interface{}) (*providers.LLMResponse, error) {
	// Split system message from conversation messages
	var systemText string
	var convMessages []anthropicMessage

	for _, m := range messages {
		switch m.Role {
		case "system":
			systemText = m.Content
		case "user":
			convMessages = append(convMessages, anthropicMessage{
				Role:    "user",
				Content: m.Content,
			})
		case "assistant":
			msg := anthropicMessage{Role: "assistant"}
			if m.Content != "" {
				msg.ContentBlocks = append(msg.ContentBlocks, contentBlock{
					Type: "text",
					Text: m.Content,
				})
			}
			for _, tc := range m.ToolCalls {
				name := tc.Name
				if tc.Function != nil {
					name = tc.Function.Name
				}
				args := tc.Arguments
				if tc.Function != nil && len(args) == 0 {
					json.Unmarshal([]byte(tc.Function.Arguments), &args)
				}
				msg.ContentBlocks = append(msg.ContentBlocks, contentBlock{
					Type:  "tool_use",
					ID:    tc.ID,
					Name:  name,
					Input: args,
				})
			}
			if len(msg.ContentBlocks) > 0 {
				convMessages = append(convMessages, msg)
			} else if msg.Content != "" {
				convMessages = append(convMessages, msg)
			}
		case "tool":
			convMessages = append(convMessages, anthropicMessage{
				Role: "user",
				ContentBlocks: []contentBlock{{
					Type:       "tool_result",
					ToolUseID:  m.ToolCallID,
					Content:    m.Content,
				}},
			})
		}
	}

	// Build request body
	reqBody := map[string]interface{}{
		"model":      model,
		"max_tokens": 1024,
	}

	if systemText != "" {
		reqBody["system"] = systemText
	}

	// Serialize messages
	serialized := make([]map[string]interface{}, 0, len(convMessages))
	for _, m := range convMessages {
		if len(m.ContentBlocks) > 0 {
			blocks := make([]map[string]interface{}, 0, len(m.ContentBlocks))
			for _, b := range m.ContentBlocks {
				block := map[string]interface{}{"type": b.Type}
				switch b.Type {
				case "text":
					block["text"] = b.Text
				case "tool_use":
					block["id"] = b.ID
					block["name"] = b.Name
					block["input"] = b.Input
				case "tool_result":
					block["tool_use_id"] = b.ToolUseID
					block["content"] = b.Content
				}
				blocks = append(blocks, block)
			}
			serialized = append(serialized, map[string]interface{}{
				"role":    m.Role,
				"content": blocks,
			})
		} else {
			serialized = append(serialized, map[string]interface{}{
				"role":    m.Role,
				"content": m.Content,
			})
		}
	}
	reqBody["messages"] = serialized

	if maxTokens, ok := options["max_tokens"].(int); ok {
		reqBody["max_tokens"] = maxTokens
	}
	if temp, ok := options["temperature"].(float64); ok {
		reqBody["temperature"] = temp
	}

	// Convert tools to Anthropic format
	if len(tools) > 0 {
		anthropicTools := make([]map[string]interface{}, 0, len(tools))
		for _, t := range tools {
			anthropicTools = append(anthropicTools, map[string]interface{}{
				"name":         t.Function.Name,
				"description":  t.Function.Description,
				"input_schema": t.Function.Parameters,
			})
		}
		reqBody["tools"] = anthropicTools
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.anthropic.com/v1/messages", bytes.NewReader(jsonData))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", p.apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")

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
		return nil, fmt.Errorf("API error %d: %s", resp.StatusCode, string(body))
	}

	return p.parseResponse(body)
}

func (p *Provider) parseResponse(body []byte) (*providers.LLMResponse, error) {
	var resp anthropicResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, fmt.Errorf("unmarshal response: %w", err)
	}

	var content string
	var toolCalls []providers.ToolCall

	for _, block := range resp.Content {
		switch block.Type {
		case "text":
			content += block.Text
		case "tool_use":
			toolCalls = append(toolCalls, providers.ToolCall{
				ID:        block.ID,
				Name:      block.Name,
				Arguments: block.Input,
			})
		}
	}

	return &providers.LLMResponse{
		Content:      content,
		ToolCalls:    toolCalls,
		FinishReason: resp.StopReason,
		Usage: &providers.UsageInfo{
			PromptTokens:     resp.Usage.InputTokens,
			CompletionTokens: resp.Usage.OutputTokens,
			TotalTokens:      resp.Usage.InputTokens + resp.Usage.OutputTokens,
		},
	}, nil
}

// Internal types for Anthropic API format

type anthropicMessage struct {
	Role          string         `json:"role"`
	Content       string         `json:"content,omitempty"`
	ContentBlocks []contentBlock `json:"-"`
}

type contentBlock struct {
	Type      string                 `json:"type"`
	Text      string                 `json:"text,omitempty"`
	ID        string                 `json:"id,omitempty"`
	Name      string                 `json:"name,omitempty"`
	Input     map[string]interface{} `json:"input,omitempty"`
	ToolUseID string                 `json:"tool_use_id,omitempty"`
	Content   string                 `json:"content,omitempty"`
}

type anthropicResponse struct {
	Content    []responseBlock `json:"content"`
	StopReason string          `json:"stop_reason"`
	Usage      struct {
		InputTokens  int `json:"input_tokens"`
		OutputTokens int `json:"output_tokens"`
	} `json:"usage"`
}

type responseBlock struct {
	Type  string                 `json:"type"`
	Text  string                 `json:"text,omitempty"`
	ID    string                 `json:"id,omitempty"`
	Name  string                 `json:"name,omitempty"`
	Input map[string]interface{} `json:"input,omitempty"`
}
