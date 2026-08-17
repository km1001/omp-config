package main

import (
	"os/exec"
	"strconv"
	"strings"
)

type TestResult struct {
	OK     bool   `json:"ok"`
	Status *int   `json:"status"`
	Detail string `json:"detail"`
}

func testProvider(baseURL, apiKey, api string) *TestResult {
	base := strings.TrimRight(strings.TrimSpace(baseURL), "/")
	if base == "" {
		return &TestResult{Detail: "baseUrl is empty"}
	}
	url := base + "/models"
	args := []string{"-sS", "-m", "6", "-o", "-", "-w", "\n%{http_code}"}
	if key := strings.TrimSpace(apiKey); key != "" {
		if strings.HasPrefix(api, "anthropic") {
			args = append(args, "-H", "x-api-key: "+key, "-H", "anthropic-version: 2023-06-01")
		} else {
			args = append(args, "-H", "Authorization: Bearer "+key)
		}
	}
	args = append(args, url)
	out, err := exec.Command("curl.exe", args...).Output()
	if err != nil {
		if ee, ok := err.(*exec.ExitError); ok {
			parts := strings.SplitN(string(ee.Stderr), "\n", 2)
			detail := ""
			if len(parts) > 1 {
				detail = strings.TrimSpace(parts[1])
			} else if len(parts) == 1 {
				detail = strings.TrimSpace(parts[0])
			}
			if detail == "" {
				detail = "curl exited with an error"
			}
			if len(detail) > 220 {
				detail = detail[:220]
			}
			return &TestResult{Detail: detail}
		}
		return &TestResult{Detail: "curl failed: " + err.Error()}
	}
	text := string(out)
	idx := strings.LastIndex(text, "\n")
	codeStr := strings.TrimSpace(text[idx+1:])
	body := ""
	if idx >= 0 {
		body = strings.TrimSpace(text[:idx])
		if len(body) > 220 {
			body = body[:220]
		}
	}
	code, cerr := strconv.Atoi(codeStr)
	if cerr != nil {
		return &TestResult{Detail: "curl: unexpected output"}
	}
	return &TestResult{OK: code < 400, Status: &code, Detail: body}
}
