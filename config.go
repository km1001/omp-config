package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"gopkg.in/yaml.v3"
)

type LoadResult struct {
	Config       *Config `json:"config"`
	Path         string  `json:"path"`
	Exists       bool    `json:"exists"`
	MigratedFrom string  `json:"migratedFrom"`
}

type SaveResult struct {
	Path     string   `json:"path"`
	Warnings []string `json:"warnings"`
}

func configDir() string {
	home, err := os.UserHomeDir()
	if err != nil {
		home = "."
	}
	return filepath.Join(home, ".omp", "agent")
}

func modelsYmlPath() string {
	return filepath.Join(configDir(), "models.yml")
}

func modelsJsonPath() string {
	return filepath.Join(configDir(), "models.json")
}

func loadConfig() (*LoadResult, error) {
	yml := modelsYmlPath()
	json := modelsJsonPath()
	if _, err := os.Stat(yml); err == nil {
		data, err := os.ReadFile(yml)
		if err != nil {
			return nil, fmt.Errorf("read %s: %w", yml, err)
		}
		var cfg Config
		if err := yaml.Unmarshal(data, &cfg); err != nil {
			return nil, fmt.Errorf("parse %s: %w", yml, err)
		}
		normalize(&cfg)
		return &LoadResult{Config: &cfg, Path: yml, Exists: true}, nil
	}
	if _, err := os.Stat(json); err == nil {
		data, err := os.ReadFile(json)
		if err != nil {
			return nil, fmt.Errorf("read %s: %w", json, err)
		}
		var cfg Config
		if err := yaml.Unmarshal(data, &cfg); err != nil {
			return nil, fmt.Errorf("parse %s: %w", json, err)
		}
		normalize(&cfg)
		return &LoadResult{Config: &cfg, Path: yml, MigratedFrom: json}, nil
	}
	cfg := Config{Providers: map[string]*Provider{}}
	return &LoadResult{Config: &cfg, Path: yml}, nil
}

func normalize(cfg *Config) {
	if cfg.Providers == nil {
		cfg.Providers = map[string]*Provider{}
	}
}

func saveConfig(cfg *Config) (*SaveResult, error) {
	warnings := validate(cfg)
	yml := modelsYmlPath()
	if err := os.MkdirAll(filepath.Dir(yml), 0o755); err != nil {
		return nil, fmt.Errorf("mkdir: %w", err)
	}
	if _, err := os.Stat(yml); err == nil {
		_ = os.Rename(yml, yml+".bak")
	}
	var buf strings.Builder
	enc := yaml.NewEncoder(&buf)
	enc.SetIndent(2)
	if err := enc.Encode(cfg); err != nil {
		return nil, fmt.Errorf("serialize: %w", err)
	}
	enc.Close()
	if err := os.WriteFile(yml, []byte(buf.String()), 0o644); err != nil {
		return nil, fmt.Errorf("write %s: %w", yml, err)
	}
	return &SaveResult{Path: yml, Warnings: warnings}, nil
}

func validate(cfg *Config) []string {
	var warnings []string
	for name, p := range cfg.Providers {
		if strings.TrimSpace(name) == "" {
			warnings = append(warnings, "provider name must not be empty")
		}
		if p.API != "" && !contains(constants.API, p.API) {
			warnings = append(warnings, fmt.Sprintf("provider '%s': unknown api '%s'", name, p.API))
		}
		if p.Auth != "" && !contains(constants.Auth, p.Auth) {
			warnings = append(warnings, fmt.Sprintf("provider '%s': unknown auth '%s'", name, p.Auth))
		}
		if p.Discovery != nil && !contains(constants.Discovery, p.Discovery.Type) {
			warnings = append(warnings, fmt.Sprintf("provider '%s': unknown discovery type '%s'", name, p.Discovery.Type))
		}
		for _, m := range p.Models {
			if strings.TrimSpace(m.ID) == "" {
				warnings = append(warnings, fmt.Sprintf("provider '%s': model id must not be empty", name))
			}
			for _, modality := range m.Input {
				if modality != "text" && modality != "image" {
					warnings = append(warnings, fmt.Sprintf("provider '%s' model '%s': unknown input modality '%s'", name, m.ID, modality))
				}
			}
			if m.ContextWindow != nil && m.MaxTokens != nil && *m.MaxTokens > *m.ContextWindow {
				warnings = append(warnings, fmt.Sprintf("provider '%s' model '%s': maxTokens (%d) > contextWindow (%d)", name, m.ID, *m.MaxTokens, *m.ContextWindow))
			}
		}
	}
	if cfg.Equivalence != nil {
		for from, to := range cfg.Equivalence.Overrides {
			if strings.TrimSpace(from) == "" || strings.TrimSpace(to) == "" {
				warnings = append(warnings, "equivalence.overrides entries must not be empty")
			}
		}
	}
	return warnings
}

func contains(list []string, v string) bool {
	for _, item := range list {
		if item == v {
			return true
		}
	}
	return false
}
