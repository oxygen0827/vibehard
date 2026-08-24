# Codex 轨迹蒸馏 → Qwen3.8-27B 微调方案

> 目标：用 gpt-5.6-sol（rehdasu.cn 中转）驱动 codex + 领域 skills 执行任务，全量采集其 CoT/回复/工具调用/skills/MCP 轨迹，蒸馏微调 Qwen3.8-27B 小模型。
> 版本：v1.0 ｜ 日期：2026-08-19

---

## 1. 结论先行

- **可行性：高**。关键结论——**不需要写 codex 插件/slots**。codex 原生把每次会话的全量轨迹（含完整 CoT、工具调用、MCP 调用、输出）写入 `~/.codex/sessions/<thread_id>.jsonl`（源码已验证：`app-server-protocol/src/protocol/v2/item.rs` 中 `ThreadItem::Reasoning{content: raw_content}`（完整思考原文）、`ThreadItem::McpToolCall{server, tool, arguments, status}`（MCP 轨迹完整））。采集 = 零侵入，只写一个解析/转换脚本。
- 蒸馏链路：**codex（gpt-5.6-sol + 领域 skills + MCP）→ sessions jsonl → 清洗 → Qwen chatml+tools 格式 → unsloth QLoRA SFT → merge → llama.cpp GGUF 量化 → 部署**。
- 首轮建议 2,000–5,000 条高质量轨迹即可见效；全链路 1–2 周可跑通。
- 微调硬件：optics 3×4090（单卡 24G 跑 27B QLoRA 4bit 足够）；备选 spark1（DGX Spark，但 unsloth 在 ARM 上的依赖兼容性需验证，优先 x86 CUDA 机器）。

---

## 2. 数据采集（codex 侧）—— 已源码验证的现成机制

### 2.1 三个可用的数据来源

| 来源 | 路径/机制 | 内容 | 用途 |
|---|---|---|---|
| **A. 本地会话存储（主方案）** | `~/.codex/sessions/<thread_id>.jsonl` | CoreTurnItem 序列化：Reasoning(raw_content 完整思考)、ToolCall(名称+参数+输出)、McpToolCall(server/tool/arguments/输出)、OutputText、用户输入、审批事件 | **全量轨迹，离线解析** |
| B. 实时协议流 | `codex app-server --stdio` JSON-RPC（ThreadItem 事件流） | 同上，实时推送 | 实时采集/在线监控 |
| C. hooks 补充 | config.toml `[hooks]` 段（HookEventName 事件） | 人工审批决策、打断、自定义事件 | 补充元数据（如标记"人类修正过"的轨迹=高价值） |

### 2.2 推荐采集架构：方案 A（零侵入）+ C（可选增强）

```
┌──────────────┐   config.toml               ┌──────────────────┐
│  codex CLI   │◄──────── model_provider ────│ rehdasu.cn/v1    │
│ (gpt-5.6-sol)│   base_url=https://rehdasu  │ gpt-5.6-sol      │
│  + 领域 skills│     .cn/v1                  └──────────────────┘
│  + MCP server│                             ┌──────────────────┐
└──────┬───────┘                             │ MCP servers       │
       │ 每次会话自动写                      │ (领域工具/API)     │
       ▼                                     └──────────────────┘
┌──────────────────┐
│ ~/.codex/sessions│  ←── 解析脚本 distill_parse.py
│   *.jsonl        │      (离线、增量、幂等)
└──────────────────┘
       ▼
┌──────────────────┐  清洗/过滤/格式化        ┌──────────────────┐
│ train.jsonl      │ ─────────────────────► │ Qwen chatml+      │
│ (原始轨迹)        │                         │ tools 格式 dataset│
└──────────────────┘                         └────────┬─────────┘
                                                      ▼
                                            unsloth QLoRA SFT
```

**配置要点（home 主机 codex config.toml）**：
- `model_provider`：base_url 必须带 `/v1`（`https://rehdasu.cn/v1`），model=`gpt-5.6-sol`（记忆：须带 /v1 才能通）
- skills 接入：codex-rs 有原生 `skills/` 模块，领域 skills 放 `~/.codex/skills/`（或项目 AGENTS.md），随会话轨迹一并记录
- MCP servers：config.toml `mcp_servers` 段注册领域工具
- 采集侧只需保证 sessions 目录不被清理，定期归档

### 2.3 采集内容 → 训练字段映射

| 轨迹元素 | jsonl 中的对应 | 蒸馏到小模型的角色 |
|---|---|---|
| 用户任务 | UserInput | 指令 (human) |
| CoT 思考 | Reasoning.raw_content | 思维链（可蒸馏为 reasoning） |
| 最终回复 | OutputText | 答案 (gpt) |
| 工具调用 | ToolCall（名称/参数/结果） | 工具调用轨迹 |
| skills 使用 | ToolCall 中的 skill 工具 / AGENTS 上下文 | 领域技能调用模式 |
| MCP 调用 | McpToolCall（server/tool/arguments/result） | MCP 工具调用轨迹 |
| 审批/修正 | Hook/审批事件 | 正负样本标记（人类改过的=高质量） |

---

## 3. 数据清洗与格式转换

### 3.1 过滤规则（按优先级）
1. **失败轨迹**：工具报错后未成功收敛的任务 → 丢弃（或保留少量作负样本）
2. **截断思考**：reasoning 被 max_tokens 截断的 → 丢弃或截尾标记
3. **审批中断**：被用户打断/拒绝的轨迹 → 单独标记
4. **去重**：相似任务/重复轨迹（embedding 或 minhash 去重）
5. **PII/敏感**：过滤密钥、token、内网凭据（正则 + 人工抽检）
6. **长度过滤**：超长轨迹（>32k token）截断或分段

### 3.2 Qwen 格式（chatml + 原生 tools）

Qwen3 系原生 agent 格式，工具调用用 `<|tool_call|>` 内嵌 JSON，与 codex 轨迹 1:1 映射：

```json
{
  "messages": [
    {"role": "system", "content": "你是领域助手。可用工具：...（工具schema）"},
    {"role": "user", "content": "查询订单 A123 的状态"},
    {"role": "assistant", "content": "<|tool_call|>{\"name\":\"mcp__order.query\",\"arguments\":{\"order_id\":\"A123\"}}"},
    {"role": "tool", "content": "{\"status\":\"shipped\"}"},
    {"role": "assistant", "content": "订单 A123 已发货"}
  ]
}
```

- **CoT 策略**：两种可选（建议先做 B 对比 A）
  - A. 全量 CoT 蒸馏：把 raw_content 作为 assistant 消息前的 thinking 段（`<|im_start|>assistant<|im_end|>` 内嵌思考，或 Qwen3 的 reasoning_content 格式）——最忠实，但 5.6 模型的超长思考（几万 token）超出 27B 能力时易学崩
  - B. **关键步骤抽取（推荐）**：只保留与工具调用决策/最终结论直接相关的推理链（按工具调用分段切分，每段保留"为什么调这个工具"的 1-3 句）——仿 STILL-2 做法，小模型学得动
- **MCP 工具名映射**：`server__tool` → 统一工具名（如 `mcp__order.query`），并在 system prompt 中给出完整 schema

---

## 4. 微调（unsloth）

### 4.1 硬件与环境
- **推荐**：optics（3×4090，x86 + CUDA 12.x）——单卡 24G 跑 27B QLoRA 4bit（unsloth 实测峰值约 18–20G 显存）
- 备选：spark1 DGX Spark（121G 统一内存，但 ARM 架构需先验证 unsloth/xformers 兼容性，不推荐首跑）
- 环境（venv）：
  ```bash
  pip install unsloth
  pip install --upgrade "unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git"  # 或走 ModelScope 镜像
  pip install trl peft bitsandbytes datasets accelerate
  ```

### 4.2 训练配置（起点参数，可迭代）
| 参数 | 值 | 说明 |
|---|---|---|
| 基座 | Qwen3.8-27B（HF 版，safetensors） | 用 27B 全精度底座，而非 GGUF |
| 量化 | bitsandbytes 4bit（QLoRA） | 省显存 |
| LoRA r / alpha | 32 / 64 | 能力蒸馏可稍大 |
| target_modules | q/k/v/o/gate/up/down 全线性层 | 默认全套 |
| max_seq_length | 8192（首轮）→ 16384 | CoT 长则加大 |
| learning_rate | 2e-4，warmup 3%，cosine | 标准 SFT 配置 |
| epochs | 1–2（数据 2k–5k 条时 2 epoch） | 防过拟合 |
| batch / grad_accum | 2 × 8（24G 卡 27B 4bit） | 视显存调 |
| loss 关注 | SFT loss + 保留集 loss | 每 500 步存 checkpoint |

### 4.3 训练流程
1. `unsloth` 加载 4bit 基座 → `get_peft_model` 挂 LoRA
2. `trl.SFTTrainer`（formatting_func 直接吃上面 chatml 数据）
3. 保留集（5–10% 数据）做 loss 监控，选最优 checkpoint
4. 导出：LoRA merge 回全精度 → 存 safetensors → 交 llama.cpp 量化管线

---

## 5. 评估（沿用你要求的全面标准）

1. **保留集 loss / 困惑度**（对比基座 + 微调版）
2. **50 项领域任务由简到难实测**：原版 gpt-5.6-sol vs 微调版 Qwen3.8-27B，记录：任务完成率、工具调用正确率、MCP 调用正确率、CoT 质量（人工抽样）、首轮成功率
3. **量化对比**：微调版 f16 GGUF vs Q4_K_M vs Q4_K_M+imatrix——报告 BPW/体积/各档 loss 增量，确认量化后受损任务（沿用既有对比方法）
4. **回归**：基座原有能力（通用问答）不显著退化

---

## 6. 部署

- merge 后的 safetensors → llama.cpp（buun fork）→ `imatrix f16` → Q4_K_M（Qwen3.5/3.8 量化 q2/q3 需 buun 版；MTP 版按需）
- 部署到 optics：新开实例（不动现有 8099 服务），llama-server 端口错开
- 接入验证：API 实测领域任务 + 微信链路（如需要）

---

## 7. 工作计划

| 阶段 | 内容 | 产出 | 验证节点 | 预估 |
|---|---|---|---|---|
| **P0 采集链路** | home 配好 codex config（rehdasu/v1 gpt-5.6-sol + 领域 skills + MCP），跑 10 个代表性任务 | sessions jsonl 样例 | 解析脚本能还原出 CoT/工具/MCP 全字段 | 0.5–1 天 |
| **P1 数据管线** | distill_parse.py：jsonl→清洗→chatml+tools→train.jsonl；先人工核对 50 条 | 2k–5k 条训练集 + 保留集 | 格式抽样 50 条人工审查通过 | 2–3 天 |
| **P2 微调** | optics 上 unsloth QLoRA 训练脚本 + 跑通 | LoRA checkpoint + merge 模型 | SFT loss 收敛、保留集 loss 低于基座 | 1–2 天 |
| **P3 评估** | 50 项任务对比 + 量化对比报告 | 评估报告 | 完成率/工具调用正确率达标 | 2 天 |
| **P4 部署** | GGUF 量化 + optics 新实例 + 实测 | 可调用服务 | API 实测通过、性能指标达标 | 1–2 天 |

**总计约 1–2 周**（含数据收集等待时间；数据量不够可延长 P1 收集期）

---

## 8. 风险与对策

| 风险 | 对策 |
|---|---|
| gpt-5.6-sol 超长 CoT（几万 token）超出 27B 学习能力 | 关键步骤抽取（方案 3.2-B）；限制 max_tokens；按工具调用切段 |
| 数据质量参差（失败轨迹/半截任务） | 严格过滤 + 人类修正轨迹加权 |
| 工具/MCP 格式错位导致学坏 | system prompt 固化 schema；MCP 名统一映射；格式校验 |
| 27B 在单卡 24G 上 OOM | 降 seq_len / batch；用 spark1 兜底 |
| 蒸馏数据合规（OpenAI 输出重训） | 仅自用私有部署研究，不对外分发模型 |
| codex 新版本会话格式变化 | 解析脚本做 schema 兼容层；锁定 codex 版本 |

---

## 9. 工具清单汇总

| 环节 | 工具 |
|---|---|
| 任务执行/数据生成 | openai/codex（源码编译版）、gpt-5.6-sol（rehdasu.cn/v1）、领域 skills、MCP servers |
| 轨迹解析/清洗 | Python（jsonl + jq）、正则过滤、minhash/embedding 去重 |
| 微调 | **unsloth**（QLoRA）+ transformers + trl(SFTTrainer) + peft + bitsandbytes + datasets + accelerate |
| 评估 | 自写评测脚本（50 项任务）、vLLM/llama.cpp 本地推理对比 |
| 部署 | llama.cpp（buun fork）+ imatrix + GGUF 量化（f16 → Q4_K_M）|
| 版本管理 | git + 自建 gitea（ldcx.tech） |

---

## 10. 待确认事项
1. Qwen3.8-27B 的 HF safetensors 底座从哪拿（ModelScope 直连下载，注意 650M+ 大文件走长超时+续传）
2. 领域 skills 清单与 MCP server 列表（P0 前提供）
3. 训练机确认：optics 单卡 4090（推荐）还是 spark1
4. 数据收集期：任务来源/批量脚本还是人工喂任务
