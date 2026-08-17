# omp-models-editor

桌面端模型配置编辑器，用于编辑 OMP agent 的模型配置文件 `~/.omp/agent/models.yml`。

基于 Wails v2 构建的 Windows 桌面应用：Go 后端 + 原生 HTML/JS 前端，构建过程无需 Node.js。

## 功能

- Provider 管理：`baseUrl`、`apiKey`、`api`、`auth`、`headers`
- 模型管理：`id`、`name`、`reasoning`、`input`（text/image）、`contextWindow`、`maxTokens`、`cost`、`contextPromotionTarget`
- 高级配置：`modelOverrides`、`disableStrictTools`、`compat`、`discovery`、`equivalence.overrides`、`modelProviderOrder`
- 连接测试：调用 `{baseUrl}/models` 探测连通性，支持 `Authorization: Bearer` 与 Anthropic `x-api-key` 两种鉴权
- `apiKey` 支持直接填写密钥或环境变量名（测试时自动解析）
- 保存前校验，发现问题以 warning 形式提示，不阻止保存
- 兼容旧版 `models.json`，读取时自动迁移

## 配置文件

默认路径：`~/.omp/agent/models.yml`（Windows 为 `%USERPROFILE%\.omp\agent\models.yml`）。

加载优先级：

1. `models.yml` 存在 → 直接读取
2. `models.yml` 不存在但 `models.json` 存在 → 读取旧配置（JSON 是 YAML 子集，直接解析）
3. 均不存在 → 返回空配置

保存时先将现有 `models.yml` 备份为 `models.yml.bak`，再写入新内容。

结构示例：

```yaml
providers:
  openai:
    baseUrl: https://api.openai.com/v1
    apiKey: sk-xxxx
    api: openai-responses
    auth: apiKey
    models:
      - id: gpt-5.6
        name: GPT-5.6
        reasoning: true
        input: [text, image]
        contextWindow: 128000
        maxTokens: 16384
        cost:
          input: 1.25
          output: 10
modelProviderOrder:
  - openai
```

## 构建

环境要求：

- Go 1.25+
- Wails CLI（`go install github.com/wailsapp/wails/v2/cmd/wails@latest`）
- Windows 10/11（依赖 WebView2 运行时）

一键构建：

```powershell
powershell -File build.ps1
```

产物为 `build/bin/omp-models-editor.exe`；若系统装有 UPX 会自动压缩体积。

手动构建：

```powershell
wails build -clean
```

## 技术栈

- [Wails v2](https://wails.io)（v2.14.0）— 桌面应用框架
- Go 1.25 — 后端
- [gopkg.in/yaml.v3](https://github.com/go-yaml/yaml) — 配置读写
- 原生 HTML/CSS/JS + wailsjs 绑定 — 前端，无 npm 依赖
