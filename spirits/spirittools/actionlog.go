package spirittools

import (
	"fmt"
	"sync"
	"time"
)

type ActionEntry struct {
	Time    time.Time
	Action  string // "say", "walk_to", "move_to", "look_at", "set_goal", "rest", "voice_heard"
	Summary string
}

type ActionLog struct {
	mu      sync.Mutex
	entries []ActionEntry
	maxSize int
}

func NewActionLog(maxSize int) *ActionLog {
	return &ActionLog{
		entries: make([]ActionEntry, 0, maxSize),
		maxSize: maxSize,
	}
}

// Add appends a new entry. Evicts oldest entries when maxSize is exceeded (FIFO).
func (al *ActionLog) Add(action, summary string) {
	al.mu.Lock()
	defer al.mu.Unlock()

	al.entries = append(al.entries, ActionEntry{
		Time:    time.Now(),
		Action:  action,
		Summary: summary,
	})

	if len(al.entries) > al.maxSize {
		al.entries = al.entries[len(al.entries)-al.maxSize:]
	}
}

// Render generates the 【最近の記憶】 section for buildPrompt.
// Returns empty string if there are no entries.
func (al *ActionLog) Render() string {
	al.mu.Lock()
	defer al.mu.Unlock()

	if len(al.entries) == 0 {
		return ""
	}

	result := "【最近の記憶】\n"
	for _, e := range al.entries {
		elapsed := time.Since(e.Time)
		var ts string
		if elapsed < 60*time.Second {
			ts = fmt.Sprintf("%d秒前", int(elapsed.Seconds()))
		} else if elapsed < 60*time.Minute {
			ts = fmt.Sprintf("%d分前", int(elapsed.Minutes()))
		} else {
			ts = fmt.Sprintf("%d時間前", int(elapsed.Hours()))
		}
		result += fmt.Sprintf("  [%s] %s\n", ts, e.Summary)
	}
	return result
}
