# Skill Registry

在这里记录项目认可的 skills、工具和脚本，方便团队成员和 AI agents 复用同一套工作流。

| 名称 | 用途 | 位置 / 安装说明 | 状态 |
|---|---|---|---|
| embedded-team-sync | 轻量同步团队规则、状态、skills 和任务日志 | project or personal skill install | active |
| embedded-llm-guardrails | 嵌入式 LLM 辅助开发的安全编辑边界 | install when production code edits are expected | optional |
| embedded-change-report | 基于证据的嵌入式变更报告 | install when formal reports are needed | optional |
| embedded-unit-test-generator | 单元测试矩阵和骨架生成 | install when unit tests are needed | optional |
| production status | 当前线上状态和待办 | `docs/current-status.md` | active |
| team cloud delivery | 团队交付包、目标路径和负载约束 | `docs/team-cloud-delivery.md` | active |
| frontend release verifier | 校验认证保护、PCB renderer、Demo 与 GIF | `scripts/verify-frontend-release.mjs` | active |
| cloud production verifier | 一次性真实模型、审批、GCC、运行和 ZIP 验收 | `scripts/verify-cloud-production.mjs` | degraded until provider recovers |
