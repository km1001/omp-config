package main

import (
	"context"
	"os"
	"strings"
)

// App is the root application struct bound to the frontend.
type App struct {
	ctx context.Context
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// GetConstants returns the enum constants for dropdowns.
func (a *App) GetConstants() Constants {
	return constants
}

// LoadConfig reads ~/.omp/agent/models.yml (migrating models.json if needed).
func (a *App) LoadConfig() (*LoadResult, error) {
	return loadConfig()
}

// SaveConfig writes the config back to ~/.omp/agent/models.yml.
func (a *App) SaveConfig(cfg *Config) (*SaveResult, error) {
	return saveConfig(cfg)
}

// TestProvider probes {baseUrl}/models with curl and reports connectivity.
func (a *App) TestProvider(baseURL, apiKey, api string) *TestResult {
	key := strings.TrimSpace(apiKey)
	if key != "" {
		if v := os.Getenv(key); v != "" {
			key = v
		}
	}
	return testProvider(baseURL, key, api)
}
