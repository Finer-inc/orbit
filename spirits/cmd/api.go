package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
)

func startMgmtAPI(mgr *SpiritManager) {
	port := os.Getenv("MGMT_PORT")
	if port == "" {
		port = "3002"
	}

	mux := http.NewServeMux()

	mux.HandleFunc("/agents", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			handleListAgents(w, r, mgr)
		case http.MethodPost:
			handleSpawnAgent(w, r, mgr)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})

	// DELETE /agents/{id}
	mux.HandleFunc("/agents/", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodDelete {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		id := strings.TrimPrefix(r.URL.Path, "/agents/")
		if id == "" {
			http.Error(w, "missing agent id", http.StatusBadRequest)
			return
		}
		handleDespawnAgent(w, r, mgr, id)
	})

	addr := ":" + port
	fmt.Printf(">>> 管理API起動: http://localhost%s\n", addr)
	go func() {
		if err := http.ListenAndServe(addr, mux); err != nil {
			fmt.Fprintf(os.Stderr, "管理APIエラー: %v\n", err)
		}
	}()
}

func handleListAgents(w http.ResponseWriter, _ *http.Request, mgr *SpiritManager) {
	agents := mgr.ListSpirits()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(agents)
}

func handleSpawnAgent(w http.ResponseWriter, r *http.Request, mgr *SpiritManager) {
	var req SpawnRequest
	if r.Body != nil && r.ContentLength > 0 {
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, fmt.Sprintf("invalid request: %v", err), http.StatusBadRequest)
			return
		}
	}

	result, err := mgr.SpawnSpirit(req)
	if err != nil {
		http.Error(w, fmt.Sprintf("spawn failed: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(result)
}

func handleDespawnAgent(w http.ResponseWriter, _ *http.Request, mgr *SpiritManager, id string) {
	if err := mgr.DespawnSpirit(id); err != nil {
		http.Error(w, fmt.Sprintf("despawn failed: %v", err), http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"ok": true})
}
