# Repository Guidelines

## Project Structure & Module Organization

This repository currently contains the distillation design document [`codex-distill-plan.md`](codex-distill-plan.md). It describes a planned pipeline, rather than shipping implementation code. When implementation begins, keep responsibilities separated so the layout mirrors the plan:

- `src/` or `scripts/` for session parsing, cleaning, and ChatML/tool conversion.
- `train/` for Unsloth/QLoRA training and merge scripts.
- `eval/` for the 50-task comparison suite and regression reports.
- `configs/` for checked-in, secret-free example configuration.
- `data/` for local or ignored JSONL artifacts; do not commit raw sessions or model weights.

## Build, Test, and Development Commands

No build, test, or package manager command is defined yet. Do not invent a project-wide entry point without adding it to the repository. For future Python tooling, prefer documented commands such as:

```bash
python scripts/distill_parse.py --input <sessions-dir> --output data/train.jsonl
python -m pytest
```

Document required virtual-environment setup and GPU assumptions alongside any new executable script.

## Coding Style & Naming Conventions

Use Python 3 with 4-space indentation, type hints on public functions, and small, composable stages (parse, filter, transform, validate). Name modules and scripts in `snake_case`; use `PascalCase` for classes and `UPPER_SNAKE_CASE` for constants. Keep JSONL schemas explicit and validate records before writing output. Add formatting/linting tools (for example, Ruff) only when they are configured in the repository.

## Testing Guidelines

There is no test suite or coverage requirement at present. New parsers and converters should add `tests/` cases using `pytest`, including malformed JSONL, truncated reasoning, failed tool calls, PII redaction, deduplication, and ChatML/tool-schema validation. Keep small fixtures in `tests/fixtures/`; never use real credentials or private session exports.

## Commit & Pull Request Guidelines

Git history is not available in this checkout, so no existing commit convention can be verified. Use imperative, scoped subjects such as `parser: preserve MCP tool results` and keep commits focused. Pull requests should explain the data/schema impact, include validation commands and representative fixture output, link the relevant plan or issue, and call out GPU, dependency, or migration requirements. Never include raw traces, secrets, tokens, or model artifacts in commits.

## Security & Configuration

Treat Codex sessions, API endpoints, MCP arguments, and training data as sensitive. Load credentials from environment variables or an untracked local config; commit only redacted examples. Review generated datasets for keys, tokens, personal data, and internal hostnames before sharing or training.
