# 当前状态与交接

核查日期：2026-09-16，北京时间。以下是当次核查结果，不代表持续监控。

## 线上版本

- 主站：https://ldcx.tech/vibehard/
- PCB 示例：https://ldcx.tech/vibehard/app/pcb（需要登录）
- 宣传展示：https://ldcx.tech/vibehard/demo
- 活跃发布：`/opt/vibehard/releases/20260916-pcb-restore/standalone`。
- PCB v0.2 已恢复上线，包含精细绘图、装配／布线切换、图层显示、缩放和平移、PNG 下载。它是固定示例预览，并非已接通真实 EDA 自动设计；Gerber 导出仍禁用。
- Demo 保留标题下简介、下方模块说明和五段自动循环 GIF，PCB GIF 使用已裁剪版本。
- 本次发布使用 `96c4991` 加 Demo 与 PCB 前端覆盖文件，未部署当前分支全部后端改动，也未执行数据库迁移。
- 6 项现有 PCB/Demo 测试、生产构建及本地、服务器临时端口、正式端口、公网域名检查通过。Demo 页面主体和五个 GIF 哈希与更新前一致。

发布目录、回滚及检查命令见 [deployment-ldcx.md](deployment-ldcx.md)。可追溯覆盖清单见 [release.json](../deploy/releases/20260916-pcb-restore/release.json)。

## 对话链路：当前不可用

2026-09-16 12:39 左右的只读核查结果：

| 项目 | 观察结果 |
| --- | --- |
| Next.js 平台 | `vibehard.service` 为 active |
| Runner Gateway | `vibehard-gateway.service` 为 active，健康接口返回成功 |
| 默认 Runner | `mac-local`，名称 `Mac Codex Runner` |
| Runner 心跳 | 最后记录为 2026-08-31 19:21:39.843 +08:00，已过期约 15.7 天 |
| 数据库状态 | 仍为 `online`；旧 Gateway 未在断连时更新离线状态，不能据此判断可用 |
| 当前连接与进程 | 未发现 Gateway 的 Runner TCP 连接，也未发现 Mac 上运行中的 VibeHard Runner |
| 对话记录 | 核查时 `agent_turns` 无记录，未取得真实对话成功的验收证据 |
| 自定义模型记录 | `model_profiles` 无记录，线上代码回退至内置模型列表 |

结论：网页可访问不代表对话链路可用。当前缺少执行任务的 Runner，尚未恢复，也没有发送测试对话。

## Mac mini 与模型的位置

平台与数据库位于云服务器，Runner 按原配置应在 Mac mini 执行，并使用 `/Users/hushaohong/vibehard/.runner-workspaces` 存放项目工作区。Runner 启动 Codex CLI、运行工具并转发模型请求；Runner 不是模型推理服务。

核查时本机 Codex 配置为 `model_provider = "custom"`、`model = "gpt-5.6-sol"`，入口为 `http://127.0.0.1:15721`，监听进程为 CC Switch。这里只确认到本地代理入口，未核验其当前上游模型服务或可用性，不能据此宣称模型权重在 Mac 上运行。

线上基线内置 `openai:gpt-5.6-terra` 与 `vibehard:embedded-agent` 两个模型条目。它们与当前 Mac 的默认 provider 配置不同；恢复 Runner 时必须核对实际请求所用 provider 和 model，不能认为选项可见就代表该模型已接通。

## 下一步

1. 找回并核验 `mac-local` 的启动配置与凭据，确认其版本兼容当前线上 Gateway；不要直接把当前分支的新 Runner 当作旧版的替代品。
2. 恢复 Runner，检查新鲜心跳、Gateway 实际连接及 Codex 认证和 provider 映射。
3. 通过平台完成一轮真实对话，确认排队、执行、流式回复及最终完成状态，再更新本文件的可用性结论。
4. 如需长期在线，配置 Runner 常驻运行，或规划服务器迁移；本次记录和提交没有启动或迁移服务。
5. 全量更新后端前，核查并备份数据库、执行所需迁移；前端发布继续保留完整 Demo 和 PCB 覆盖清单。

## 仓库整理边界

- `docs/` 保存状态、运维记录和文档索引；`deploy/releases/` 保存不含密钥的发布清单；`scripts/` 保存构建、素材处理与验收工具。
- 保留现有页面、媒体和运行时目录的位置，避免破坏引用。`.next/`、`dist/`、`node_modules/`、`.runner-workspaces/` 等已由 `.gitignore` 排除。
- SSH 私钥、钥匙串口令、环境密钥、Runner 凭据和运行日志不纳入提交。打包产物及完整发布源码归档保留在服务器发布目录，不放入 Git。
