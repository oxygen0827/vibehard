---
license: Apache License 2.0
task:
- text-generation
- question-answering
- reasoning
tags:
- nlp
- sft
- distillation
- chain-of-thought
- reasoning
- deepseek
- reasoning-distill
- synthetic-data
- domain:general
---

# DeepSeek-V4-Distill-8000x (unsloth SFT 训练格式)

本数据集从 [Jackrong/DeepSeek-V4-Distill-8000x](https://modelscope.cn/datasets/Jackrong/DeepSeek-V4-Distill-8000x) 下载并格式转换而来。原始数据为 `conversations` 格式 (`from`/`value` 字段)，转换为标准 OpenAI `messages` 格式，可直接用于 unsloth 的 response-only SFT 训练。

## 源数据集

| 项目 | 值 |
|------|------|
| 原始仓库 | [Jackrong/DeepSeek-V4-Distill-8000x](https://modelscope.cn/datasets/Jackrong/DeepSeek-V4-Distill-8000x) |
| Teacher Model | DeepSeek-V4-Flash |
| 样本数 | 7,716 |
| 原始格式 | `conversations` (`from`/`value`)，含 `input`/`output`/`domain`/`meta` 冗余字段 |
| 特点 | 蒸馏推理数据，含 `<think>...</think>` 思维链标记 |

## 文件说明

| 文件 | 条数 | 大小 | 说明 |
|------|------|------|------|
| `data/train.jsonl` | 7,716 | 135 MB | 原始数据（从 ModelScope 直接下载，未做任何修改） |
| **`train_data.jsonl`** | **7,716** | **71 MB** | **转换后的训练数据（可直接用于微调）** |

## 转换方法

### 1. 模型下载

使用 `modelscope` SDK 直接下载原始数据集：

```python
from modelscope import snapshot_download
snapshot_download("Jackrong/DeepSeek-V4-Distill-8000x", repo_type="dataset", cache_dir="/data/modelscope_cache")
```

### 2. 格式转换

原始数据使用 `conversations` 字段，格式为 `{from, value}`：

| 原始 `from` | 转换后 `role` |
|-------------|--------------|
| `human` | `user` |
| `gpt` | `assistant` |

### 3. Reasoning 提取

Assistant 回复中的 `<think>...</think>` 标签被解析，思维链提取为独立的 `reasoning` 字段：

```json
{
  "messages": [
    {"role": "system", "content": "You are a helpful AI assistant."},
    {"role": "user", "content": "..."},
    {"role": "assistant",
     "content": "...",
     "reasoning": "..."}
  ]
}
```

### 4. 冗余字段丢弃

原始数据每条含 `id`、`domain`、`meta`（`teacher_model`、`input_tokens`、`output_tokens`）、`input`、`output` 等字段，转换时仅保留训练所需的 `messages`，因此文件体积从 **142 MB 缩减到 71 MB**（约 50%）。

## Token 统计 (Qwen3.5-4B tokenizer, vocab=248044)

| 指标 | 值 |
|------|------|
| 总 tokens | 16,959,631 |
| 样本数 | 7,716 |
| 平均 tokens/样本 | 2,198 |
| 中位数 | 2,055 |
| Q1 / Q3 | 940 / 3,289 |
| 最小 / 最大 | 55 / 11,678 |
| P90 / P95 / P99 | 4,119 / 4,533 / 5,302 |
| > 4096 tokens | 795 条 (10.3%) |
| > 8192 tokens | 9 条 (0.1%) |

### 分布

| 范围 | 样本数 | 占比 |
|------|------|------|
| 0-256 | 255 | 3.3% |
| 256-512 | 688 | 8.9% |
| 512-1024 | 1,128 | 14.6% |
| 1024-2048 | 1,776 | 23.0% |
| 2048-4096 | 3,073 | 39.8% |
| 4096-8192 | 787 | 10.2% |
| 8192+ | 9 | 0.1% |

## 使用建议

- 训练时建议调大 `max_seq_length` 至 8192 或 16384，避免过多截断
- 长尾样本 (>8192 tokens) 仅 9 条，是否保留影响极小

## 许可证

Apache License 2.0

## 引用

原始数据集：[Jackrong/DeepSeek-V4-Distill-8000x](https://modelscope.cn/datasets/Jackrong/DeepSeek-V4-Distill-8000x)
