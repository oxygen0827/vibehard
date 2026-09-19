# VibeHard Agent Platform

VibeHard 是面向嵌入式与智能硬件研发的项目工作台。平台把用户、项目、会话、审批、审计和 Web UI 放在中心服务器，把真正访问工程目录、运行 Codex、调用模型和操作硬件的能力放在独立 Runner 上。

浏览器只访问平台 REST/SSE，不直接连接 Runner；Runner 主动连接平台 Gateway；Codex `app-server` 只在 Runner 内通过 stdio JSONL 运行，不暴露公网端口。

## 当前状态

截至 2026-09-19（北京时间），[线上平台](https://ldcx.tech/vibehard/)已切换至 `20260918-llm-settings`，应用迁移 `0003_llm_settings`。Gateway 保持 `20260918-cloud-runner`；平台、Gateway 和云端 Runner 服务检查均为 active。

**真实调用与管理员模型设置已上线，正式网页方案生成、Agent 三轮对话及刷新恢复已成功。** 发布当晚现有 provider 返回过 HTTP 429，9 月 19 日 09:33–09:36 复测恢复，未更换 Key，不能断定旧额度已耗尽。新版限制重试、增加空闲超时并将错误回传网页；短时成功不代表长期稳定。管理员可在“管理概览 → LLM 服务设置”分别调整方案生成与 Agent 的 Base URL、模型、API Key 并测试连接，详见 [LLM 配置指南](docs/llm-settings.md)。

此前浏览器实测确认：首页、Demo、主题切换、登录/退出、成员管理页权限、PCB 示例切换和缩放正常；本次发布再次通过 PCB/Demo 资源回归。PCB 仍是固定示例，Gerber 禁用。首页统计和最近项目为展示数据；原理图、资料和嵌入式等旧页面多数仍是演示 UI。**方案生成已移除硬编码 ESP32 结果，改为云端真实 LLM 请求，不依赖知识库，失败不回退假结果。** 输出仅为未核验 AI 草案，不代表真实原理图或 ERC 通过。

本次完整源码发布包含此前的执行器选择代码；小电脑实机仍未接入，不能宣称烧录验收通过。详见[当前状态与交接](docs/current-status.md)和[云端 Runner 说明](deploy/runner/README.md)。

- 现有 WebHUD/VibeBoard 继续占用 `/` 和 `/api`，VibeHard 部署没有修改它的 UI、服务或数据。
- Next.js 平台运行在服务器 `47.102.197.71:3210`，由 `vibehard.service` 管理。
- PostgreSQL 15 运行在同一服务器，只监听本机地址，VibeHard 使用独立数据库和用户。
- Runner Gateway 由 `vibehard-gateway.service` 管理，只监听 Docker 桥接地址 `172.17.0.1:8787`，公网只能通过 `wss://ldcx.tech/vibehard/runner` 访问。
- 默认 Codex Runner 运行在云服务器；Mac 关机不影响普通对话、生成和云端编译。需要 USB、串口或烧录的任务使用 Mac mini 设备 Runner，Mac 离线时这类任务不可执行。
- 云端 Runner 工作区位于服务器 `/var/lib/vibehard-runner/workspaces/`；设备 Runner 工作区位于 Mac mini 的 `/Users/hushaohong/vibehard/.runner-workspaces/`。两端工作区不会自动同步。
- `/app/agent` 使用云端 Codex Runner；`/app/design` 由平台直接请求 LLM。前者要求 Responses 流式与工具调用兼容，后者也支持 Chat Completions。其余旧模块尚未全部接入真实执行。

文档入口见 [docs/README.md](docs/README.md)，脚本用途见 [scripts/README.md](scripts/README.md)。生产部署边界、目录和回滚方式见 [docs/deployment-ldcx.md](docs/deployment-ldcx.md)。

## 系统架构

```text
Browser
  |
  | HTTPS REST + SSE
  v
nginx on ldcx.tech
  |-- / and /api ----------------------> existing VibeBoard/WebHUD
  |-- /vibehard/* ---------------------> Next.js platform :3210
  |                                        |
  |                                        v
  |                                   PostgreSQL
  |                                        |
  |-- /vibehard/runner -- WebSocket --> Runner Gateway :8787
                                             ^
                                             | outbound authenticated WebSocket
                                             |
                                      Codex Runner
                                             |
                              isolated project workspace
                                             |
                                      codex app-server
                                             |
                             OpenAI or Responses API provider
```

### Platform

Next.js 平台负责用户、项目、会话索引、模型 profile、Runner 命令队列、审批、事件持久化、审计和 UI。平台不直接执行 Codex，也不接受浏览器指定任意服务器路径。

### Runner Gateway

Gateway 是平台和 Runner 之间的版本化 WebSocket 通道。它负责 Runner 身份校验、心跳、命令投递、事件接收和断线重连，不运行模型，也不访问工程文件。

### Codex Runner

Runner 是 Agent 执行器，不是模型。它在能访问工程和硬件的机器上运行，负责：

- 为项目创建受控工作目录。
- 启动和管理 `codex app-server` 子进程。
- 执行 `initialize`、`thread/start`、`thread/resume`、`turn/start` 和 `turn/interrupt`。
- 把回复、推理、工具调用、命令输出、文件变更、审批请求和错误转换为平台 `AgentEvent`。
- 在断线后重新连接 Gateway，并从本地 journal 重发尚未 ACK 的事件。

### Workspace isolation

`RUNNER_WORKSPACE_ROOT` 位于 Runner 所在机器，不在 Web 平台服务器中自动生成。每个项目使用服务端生成的子目录，Runner 会拒绝逃逸根目录的路径。

macOS Runner 会用 `sandbox-exec` 阻止 Codex 访问其他 Runner 项目目录；Linux 生产 Runner 默认拒绝弱隔离，必须配置 `RUNNER_CODEX_WRAPPER`（例如容器或 bubblewrap wrapper）。Codex turn 仍默认 `read-only` 且关闭网络。

这些边界不是虚拟机级隔离。正式承载不可信项目或硬件操作前，仍需要独立 Linux 用户、容器、资源配额、网络白名单和设备授权。

## 已实现功能

| 模块 | 当前能力 |
| --- | --- |
| 认证 | 邀请码注册、登录、退出、密码哈希、HttpOnly 签名会话、用户状态复核和登录限流 |
| 租户隔离 | API 从会话获取用户身份，项目、thread、turn 和审批按用户校验 |
| 项目 | 创建和列出项目，服务端生成工作区标识，绑定默认模型与 Runner |
| Agent 会话 | 创建/恢复 thread、单会话单活跃 turn、幂等中断、Codex thread ID 映射 |
| 事件 | SSE 流式输出、事件入库、幂等 event ID、ACK、断线续传和刷新恢复 |
| 审批 | 结构化命令/路径详情、批准/拒绝、并发决策保护和审计 |
| Runner | 注册换取并持久化密钥、实例 ID、心跳/离线、命令队列、磁盘 journal 和重连重发 |
| Codex | stdio JSONL、环境白名单与脱敏、read-only、thread start/resume、真实 turn ID 中断 |
| 模型 | 管理员分别配置方案/Agent 的地址、模型和 Key；加密存储、权限校验、连接测试；cloud-runner 每任务读取配置 |
| 方案 | 真实后端 LLM、结构校验、心跳、取消、错误提示与 Markdown 下载；不接知识库，不伪造原理图/校验结果 |
| 审计 | 项目创建、任务、审批等关键动作入库 |
| 部署 | Next.js standalone、独立服务 bundle、systemd 与 nginx 模板 |

## 数据库

PostgreSQL 迁移会创建 12 张业务表：

- `users`：用户、密码哈希、角色和邀请码记录。
- `projects`：用户项目、工作区标识、Runner 和默认模型。
- `runner_nodes`：Runner 身份、能力、状态和最后心跳。
- `agent_threads`：平台会话与 Codex thread 的映射。
- `agent_turns`：每次请求、模型、状态、耗时和错误。
- `agent_events`：流式事件摘要和恢复游标。
- `approvals`：待审批操作及用户决定。
- `artifacts`：报告、补丁和生成文件的索引。
- `model_profiles`：provider 引用、模型和能力声明。
- `llm_settings`：方案与云端 Agent 配置及加密 API Key。
- `audit_logs`：登录、项目、任务和审批审计。
- `runner_commands`：等待 Gateway 投递的 Runner 命令。

“迁移完成”表示表结构、索引和外键已经创建，不代表迁入了历史用户或项目数据。

## 仓库结构

```text
app/                    Next.js 页面和 Route Handlers
components/app/         工作台 UI
lib/agent/              平台稳定协议和模型 profile
lib/db/                 Drizzle schema 与数据库连接
lib/server/             认证、租户隔离和业务存储层
gateway/                Runner WebSocket Gateway
runner/                 Codex app-server 适配和执行器
drizzle/                PostgreSQL SQL 迁移
deploy/                 systemd 与 nginx 生产模板
docs/                   部署和运维说明
scripts/                构建 bundle 和数据库迁移脚本
vibehard-LLM/           独立模型蒸馏项目，不进入平台运行时
```

## 本地启动

要求：Node.js、pnpm、Docker，以及已安装并认证可用的 `codex` CLI。

```bash
pnpm install
cp .env.example .env.local
pnpm db:up
pnpm db:migrate
```

至少修改 `.env.local` 中的 `SESSION_SECRET`、`INVITE_CODES` 和 `RUNNER_REGISTRATION_TOKEN`。不要提交 `.env.local`、provider API key 或 Runner shared secret。

如果本机 `5432` 已被占用：

```bash
POSTGRES_PORT=55432 pnpm db:up
```

同时把 `DATABASE_URL` 端口改为 `55432`。

分别启动平台、Gateway 和 Runner：

```bash
# terminal 1
pnpm dev

# terminal 2
set -a; source .env.local; set +a
pnpm gateway:start

# terminal 3
set -a; source .env.local; set +a
pnpm runner:start
```

打开 [http://localhost:3000/register](http://localhost:3000/register)，使用配置的邀请码注册，再进入 [http://localhost:3000/app/agent](http://localhost:3000/app/agent)。

## 验证与构建

```bash
pnpm test
pnpm lint
pnpm build
pnpm build:services
```

- `pnpm test` 只扫描仓库测试，不扫描 `.claude/worktrees` 或模型训练目录。
- Gateway 测试会临时监听 `127.0.0.1` 随机端口。
- `__tests__/store-postgres.test.ts` 只在提供 `DATABASE_URL` 时运行，用独立测试数据库验证事务锁、审批并发、事件续传和 Runner 撤销。
- Next.js 生产构建使用 webpack 和 `output: "standalone"`。
- `pnpm build:services` 生成独立的 `gateway.cjs`、`runner.cjs` 和 `migrate.cjs`，生产机不需要 `tsx` 或完整开发依赖。

子路径 standalone 构建：

```bash
NEXT_PUBLIC_BASE_PATH=/vibehard bash scripts/build-standalone.sh
pnpm build:services
```

## 安全边界

- Codex 默认 `read-only`，默认关闭任务网络访问。
- 工作区写入和命令执行通过 Codex 审批协议返回平台。
- 平台 API 不接受客户端传入 `userId` 或任意绝对工作区路径。
- Runner 注册令牌、shared secret、数据库密码和 provider key 不写入仓库或业务日志。
- Runner 只把显式列入 `CODEX_PROVIDER_ENV_ALLOWLIST` 的 provider 环境变量传给 Codex，平台密钥和数据库连接不会进入子进程。
- Gateway 裸端口不直接暴露公网，公网入口由 nginx TLS 终止。
- PostgreSQL、活跃工作区、Codex session 和运行代码必须放块存储，不放 OSS 挂载盘。

## OSS 使用原则

OSS 适合保存训练数据集、上传文件、固件、生成报告、归档产物和备份。数据库、Node.js 服务、正在执行的项目目录和 Codex session 留在服务器或 Runner 本地磁盘，避免对象存储的延迟与文件系统语义影响运行。

当前生产 release 体积不到 100 MB，没有必要为了节省少量服务器磁盘把运行代码放进 OSS。

## 模型与 Codex 升级

平台业务层只依赖 [`lib/agent/protocol.ts`](lib/agent/protocol.ts) 的稳定内部协议，不直接依赖 Codex 原始类型。升级 Codex CLI 后执行：

```bash
codex --version
pnpm codex:generate-types
pnpm runner:test
```

随后核对 `initialize`、thread、turn、审批和事件协议，再更新 [`runner/codex-stdio.ts`](runner/codex-stdio.ts) 适配层。

自研模型需要提供 Responses API 兼容接口，并在 Runner 机器的 Codex 配置中注册 `model_provider`。平台只保存 provider 引用和显示信息，不保存明文 API key，也不负责模型训练、权重和推理服务部署。

## 下一步

1. 定位云端 Runner 到 `tokenadvent / gpt-5.6-sol` 的持续重连与超时，重新通过真实回复、文件写入、审批、GCC、运行和 ZIP 下载验收。
2. 发布项目执行器选择页面，分别验证 `cloud-runner` 与 `device-runner` 路由。
3. 导入“小电脑”基础工程、知识库、构建/烧录/日志命令，完成真实 USB 设备闭环。
4. 把方案生成、原理图识别、资料解析和调试页面统一接入 Agent Task API，并移除或明确标注展示数据。
5. 增加 Runner 凭据撤销/轮换、任务超时与排队、监控告警、设备授权和互斥锁。
