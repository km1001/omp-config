package main

import (
	"gopkg.in/yaml.v3"
)

type Config struct {
	Providers          map[string]*Provider `json:"providers" yaml:"providers"`
	Equivalence        *Equivalence         `json:"equivalence,omitempty" yaml:"equivalence,omitempty"`
	ModelProviderOrder []string             `json:"modelProviderOrder,omitempty" yaml:"modelProviderOrder,omitempty"`
}

type Provider struct {
	BaseURL             string                     `json:"baseUrl,omitempty" yaml:"baseUrl,omitempty"`
	APIKey              string                     `json:"apiKey,omitempty" yaml:"apiKey,omitempty"`
	API                 string                     `json:"api,omitempty" yaml:"api,omitempty"`
	Auth                string                     `json:"auth,omitempty" yaml:"auth,omitempty"`
	Headers             map[string]string          `json:"headers,omitempty" yaml:"headers,omitempty"`
	Models              []*Model                   `json:"models,omitempty" yaml:"models,omitempty"`
	ModelOverrides      map[string]*ModelOverride  `json:"modelOverrides,omitempty" yaml:"modelOverrides,omitempty"`
	DisableStrictTools  *bool                      `json:"disableStrictTools,omitempty" yaml:"disableStrictTools,omitempty"`
	Compat              map[string]interface{}     `json:"compat,omitempty" yaml:"compat,omitempty"`
	Discovery           *Discovery                 `json:"discovery,omitempty" yaml:"discovery,omitempty"`
}

// ModalityList renders as a flow-style YAML array: input: [text, image]
type ModalityList []string

func (m ModalityList) MarshalYAML() (interface{}, error) {
	node := &yaml.Node{Kind: yaml.SequenceNode, Style: yaml.FlowStyle}
	for _, item := range m {
		node.Content = append(node.Content, &yaml.Node{Kind: yaml.ScalarNode, Value: item})
	}
	return node, nil
}

func (m *ModalityList) UnmarshalYAML(node *yaml.Node) error {
	if node == nil || node.Kind != yaml.SequenceNode {
		return nil
	}
	var out []string
	for _, item := range node.Content {
		if item.Kind == yaml.ScalarNode {
			out = append(out, item.Value)
		}
	}
	*m = out
	return nil
}

type Model struct {
	ID                     string        `json:"id" yaml:"id"`
	Name                   string        `json:"name,omitempty" yaml:"name,omitempty"`
	Reasoning              bool          `json:"reasoning,omitempty" yaml:"reasoning,omitempty"`
	Input                  ModalityList  `json:"input,omitempty" yaml:"input,omitempty"`
	ContextWindow          *uint64       `json:"contextWindow,omitempty" yaml:"contextWindow,omitempty"`
	MaxTokens              *uint64       `json:"maxTokens,omitempty" yaml:"maxTokens,omitempty"`
	Cost                   *Cost         `json:"cost,omitempty" yaml:"cost,omitempty"`
	ContextPromotionTarget string        `json:"contextPromotionTarget,omitempty" yaml:"contextPromotionTarget,omitempty"`
}

type Cost struct {
	Input      *float64 `json:"input,omitempty" yaml:"input,omitempty"`
	Output     *float64 `json:"output,omitempty" yaml:"output,omitempty"`
	CacheRead  *float64 `json:"cacheRead,omitempty" yaml:"cacheRead,omitempty"`
	CacheWrite *float64 `json:"cacheWrite,omitempty" yaml:"cacheWrite,omitempty"`
}

type ModelOverride struct {
	ContextWindow          *uint64 `json:"contextWindow,omitempty" yaml:"contextWindow,omitempty"`
	MaxTokens              *uint64 `json:"maxTokens,omitempty" yaml:"maxTokens,omitempty"`
	Cost                   *Cost   `json:"cost,omitempty" yaml:"cost,omitempty"`
	ContextPromotionTarget string  `json:"contextPromotionTarget,omitempty" yaml:"contextPromotionTarget,omitempty"`
}

type Discovery struct {
	Type    string `json:"type" yaml:"type"`
	BaseURL string `json:"baseUrl,omitempty" yaml:"baseUrl,omitempty"`
}

type Equivalence struct {
	Overrides map[string]string `json:"overrides,omitempty" yaml:"overrides,omitempty"`
}

type Constants struct {
	API        []string `json:"api"`
	Auth       []string `json:"auth"`
	Discovery  []string `json:"discovery"`
	Modalities []string `json:"modalities"`
}

var constants = Constants{
	API:        []string{"openai-completions", "openai-responses", "openai-codex-responses", "azure-openai-responses", "anthropic-messages", "google-generative-ai", "google-vertex"},
	Auth:       []string{"apiKey", "none", "oauth"},
	Discovery:  []string{"ollama", "llama.cpp", "lm-studio", "openai-models-list", "proxy"},
	Modalities: []string{"text", "image"},
}
