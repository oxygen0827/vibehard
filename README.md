# VibeHard Agent Platform

VibeHard 是面向嵌入式与智能硬件研发的项目工作台。平台把用户、项目、会话、审批、审计和 Web UI 放在中心服务器，把真正访问工程目录、运行 Codex、调用模型和操作硬件的能力放在独立 Runner 上。

浏览器只访问平台 REST/SSE，不直接连接 Runner；Runner 主动连接平台 Gateway；Codex `app-server` 只在 Runner 内通过 stdio JSONL 运行，不暴露公网端口。

## 当前状态

基础版 P0 已在 2026-08-30 部署到 [https://ldcx.tech/vibehard/](https://ldcx.tech/vibehard/)。

- 现有 WebHUD/VibeBoard 继续占用 `/` 和 `/api`，VibeHard 部署没有修改它的 UI、服务或数据。
- Next.js 平台运行在服务器 `47.102.197.71:3210`，由 `vibehard.service` 管理。
- PostgreSQL 15 运行在同一服务器，只监听本机地址，VibeHard 使用独立数据库和用户。
- Runner Gateway 由 `vibehard-gateway.service` 管理，只监听 Docker 桥接地址 `172.17.0.1:8787`，公网只能通过 `wss://ldcx.tech/vibehard/runner` 访问。
- 当前 Codex Runner 运行在开发 Mac 上，使用本机已认证的 Codex CLI；Mac 关机、休眠或断网时，平台仍可访问，但 Agent 任务暂时不能执行。
- 当前 Runner 工作区位于执行机上的 `/Users/hushaohong/vibehard/.runner-workspaces/`。将 Runner 迁移到服务器后，工作区也必须迁到服务器磁盘，不会自动与 Mac 同步。
- `/app/agent` 已接入真实项目、thread、turn、事件流和 Codex Runner。方案生成、原理图、资料解析、调试、PCB、嵌入式开发等旧页面第一阶段仍保留原 UI，尚未全部接入 Agent Task API。

生产部署边界、目录和回滚方式见 [`docs/deployment-ldcx.md`](docs/deployment-ldcx.md)。

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
- 在断线后重新连接 Gateway，并重发内存中尚未送达的事件。

### Workspace isolation

`RUNNER_WORKSPACE_ROOT` 位于 Runner 所在机器，不在 Web 平台服务器中自动生成。每个项目使用服务端生成的子目录，Runner 会拒绝逃逸根目录的路径。

当前 P0 是“目录边界 + Codex `read-only` 沙盒”，不是虚拟机级强隔离。正式承载不可信项目或硬件操作前，还需要独立 Linux 用户、容器或更强沙盒、资源配额、网络白名单和设备授权。

## 已实现功能

| 模块 | 当前能力 |
| --- | --- |
| 认证 | 邀请码注册、登录、退出、密码哈希、签名会话 Cookie |
| 租户隔离 | API 从会话获取用户身份，项目、thread、turn 和审批按用户校验 |
| 项目 | 创建和列出项目，服务端生成工作区标识，绑定默认模型与 Runner |
| Agent 会话 | 创建/恢复 thread，创建 turn，中断任务，保存 Codex thread ID |
| 事件 | SSE 流式输出、事件入库、幂等 event ID、刷新后恢复历史 |
| 审批 | 命令/文件修改审批请求、批准/拒绝接口和状态记录 |
| Runner | 注册换取密钥、鉴权 WebSocket、心跳、命令队列、断线重连 |
| Codex | stdio JSONL、只读沙盒、thread start/resume、turn start/interrupt |
| 模型 | 官方 Codex profile 与自研 Responses API provider 占位 |
| 审计 | 项目创建、任务、审批等关键动作入库 |
| 部署 | Next.js standalone、独立服务 bundle、systemd 与 nginx 模板 |

## 数据库

PostgreSQL 迁移会创建 11 张业务表：

- `users`：用户、密码哈希、角色和邀请码记录。
- `projects`：用户项目、工作区标识、Runner 和默认模型。
- `runner_nodes`：Runner 身份、能力、状态和最后心跳。
- `agent_threads`：平台会话与 Codex thread 的映射。
- `agent_turns`：每次请求、模型、状态、耗时和错误。
- `agent_events`：流式事件摘要和恢复游标。
- `approvals`：待审批操作及用户决定。
- `artifacts`：报告、补丁和生成文件的索引。
- `model_profiles`：provider 引用、模型和能力声明。
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

1. 将生产 Runner 从开发 Mac 迁移到已安装并认证 Codex 的长期在线服务器。
2. 持久化和轮换 Runner 凭据，增加离线检测与任务超时。
3. 把方案生成、原理图识别、资料解析和调试页面统一接入 Agent Task API。
4. 补齐产物下载、审批超时、重试、监控和告警。
5. 增加容器级工作区隔离，以及串口、J-Link、OpenOCD、ESP-IDF 等设备授权和锁。
