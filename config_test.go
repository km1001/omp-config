package main

import (
	"os"
	"testing"
)

func setupHome(t *testing.T) {
	t.Helper()
	t.Setenv("USERPROFILE", t.TempDir())
}

func TestSaveLoadRoundTrip(t *testing.T) {
	setupHome(t)
	cfg := &Config{
		Providers: map[string]*Provider{
			"myco": {
				BaseURL: "https://llm.internal.myco.dev/v1",
				APIKey:  "MYCO_API_KEY",
				API:     "openai-responses",
				Auth:    "apiKey",
				Models: []*Model{
					{
						ID:            "myco-large",
						Name:          "MyCo Large",
						Reasoning:     true,
						Input:         ModalityList{"text", "image"},
						ContextWindow: u64ptr(200000),
						MaxTokens:     u64ptr(32000),
						Cost: &Cost{
							Input:      f64ptr(3),
							Output:     f64ptr(15),
							CacheRead:  f64ptr(0.3),
							CacheWrite: f64ptr(3.75),
						},
					},
				},
			},
			"llama.cpp": {
				BaseURL: "http://127.0.0.1:8080",
				API:     "openai-responses",
				Auth:    "none",
				Discovery: &Discovery{
					Type: "llama.cpp",
				},
			},
		},
		Equivalence: &Equivalence{
			Overrides: map[string]string{"myco/myco-large": "claude-sonnet-4-6"},
		},
		ModelProviderOrder: []string{"anthropic", "myco"},
	}
	res, err := saveConfig(cfg)
	if err != nil {
		t.Fatal(err)
	}
	if res.Warnings != nil {
		t.Fatalf("unexpected warnings: %v", res.Warnings)
	}
	data, err := os.ReadFile(res.Path)
	if err != nil {
		t.Fatal(err)
	}
	t.Logf("saved yaml:\n%s", string(data))
	loaded, err := loadConfig()
	if err != nil {
		t.Fatal(err)
	}
	got := loaded.Config
	if got.Providers["myco"].Models[0].ID != "myco-large" {
		t.Errorf("model id mismatch: %v", got.Providers["myco"].Models[0].ID)
	}
	if *got.Providers["myco"].Models[0].ContextWindow != 200000 {
		t.Errorf("contextWindow mismatch")
	}
	if got.Providers["llama.cpp"].Discovery.Type != "llama.cpp" {
		t.Errorf("discovery mismatch")
	}
	if got.Equivalence.Overrides["myco/myco-large"] != "claude-sonnet-4-6" {
		t.Errorf("equivalence mismatch")
	}
	if len(got.ModelProviderOrder) != 2 || got.ModelProviderOrder[0] != "anthropic" {
		t.Errorf("order mismatch: %v", got.ModelProviderOrder)
	}
}

func TestLoadMissingDefaults(t *testing.T) {
	setupHome(t)
	loaded, err := loadConfig()
	if err != nil {
		t.Fatal(err)
	}
	if loaded.Exists {
		t.Error("expected missing file")
	}
	if loaded.Config.Providers == nil {
		t.Error("providers map should not be nil")
	}
}

func TestValidateWarnings(t *testing.T) {
	cfg := &Config{
		Providers: map[string]*Provider{
			"bad": {
				API:  "unknown-transport",
				Auth: "wrong",
				Models: []*Model{
					{ID: "", ContextWindow: u64ptr(100), MaxTokens: u64ptr(500)},
				},
			},
		},
	}
	w := validate(cfg)
	if len(w) != 4 {
		t.Errorf("expected 4 warnings, got %d: %v", len(w), w)
	}
}

func TestLoadEmptyFile(t *testing.T) {
	setupHome(t)
	dir := os.Getenv("USERPROFILE")
	os.MkdirAll(dir+`\.omp\agent`, 0o755)
	os.WriteFile(dir+`\.omp\agent\models.yml`, []byte(""), 0o644)
	loaded, err := loadConfig()
	if err != nil {
		t.Fatal(err)
	}
	if !loaded.Exists {
		t.Error("expected file to be seen")
	}
	if loaded.Config.Providers == nil {
		t.Error("providers map should be initialized")
	}
}

func u64ptr(v uint64) *uint64 { return &v }
func f64ptr(v float64) *float64 { return &v }
