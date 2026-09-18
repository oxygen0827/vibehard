# 当前状态与交接

最新更新：2026-09-18，北京时间。以下核查结果分别标注时间，不代表持续监控。

## 2026-09-18 19:02 生产网页复测

本次从真实浏览器和生产验收脚本重新检查当前版本，结论覆盖本页更早的同日验收记录：

- 公开首页、Demo、主题切换、登录和退出正常；未登录访问工作台会跳转登录页。
- 使用一次性账号从网页创建项目、创建 Agent 会话、连接 SSE 和中断任务均成功。普通成员访问管理页会得到“仅管理员可以查看平台管理台”。
- 浏览器提交的最小无工具任务连续四次显示 `Reconnecting... waiting for network`，未收到模型回复，随后从网页成功中断。
- 随后运行正式 `verify-cloud-production.mjs`，任务在 5 分钟内未完成并报 `Production task timed out`，因此没有进入文件写入、审批、GCC 编译、二进制运行或 ZIP 下载验证。
- 超时后 `vibehard.service`、`vibehard-gateway.service`、`vibehard-runner.service` 仍为 `active`；`cloud-runner` 和 `device-runner` 心跳新鲜，旧 `mac-local` 离线。当前故障边界位于 Runner 启动任务之后的模型网络/provider 链路，不能用节点 `online` 代替端到端可用性。
- PCB 示例生成、装配/布线视图切换和缩放正常；PNG 已生成并到达 Safari 下载许可提示，未授予浏览器持久下载权限；Gerber 按设计禁用。
- 发布自带的前端校验在服务器回环地址通过：认证保护、PCB v0.2 详细 renderer、15 个前端资源、Demo 页面和五个 GIF 均正确。服务器访问自身公网域名时连接超时，但外部 Safari 和 HTTP 请求可正常访问站点。
- 一次性测试账号、项目及两个精确 Runner 工作目录已清理。验收后生产库恢复为 1 个用户、0 个项目、0 个 thread、0 个 turn、0 个审批。

因此当前状态应表述为：**Web 平台、Gateway、Runner 心跳和 PCB/Demo 可用；云端模型执行链路当前退化，等待修复与重新验收。** 当天早些时候的完整成功验收仍是有效历史证据，但不代表 19:02 时的实时可用性。

## 2026-09-18 云端执行首次上线（历史验收）

- 正式平台、Gateway 和 `cloud-runner` 均已切换到 `/opt/vibehard/releases/20260918-cloud-runner`，systemd 状态为 active。
- 正式数据库已备份到 `/opt/vibehard/backups/20260918-before-cloud/platform.dump` 并应用迁移 `0002_lucky_daimon_hellstrom`。
- 默认执行器为 `cloud-runner`，模型为 `tokenadvent / gpt-5.6-sol`。模型 API Key 只存在于本机忽略文件和服务器 root-only 环境文件。
- 真实生产验收通过：模型回复、工作区文件生成、2 次审批、GCC 编译、二进制运行和 ZIP 下载均成功。验收项目已从业务数据库删除，生成工作区作为 root-only 发布证据归档。
- 正式数据库验收后仍为 1 个用户、0 个项目、0 个任务；没有迁移旧 Mac 项目或覆盖用户内容。
- PCB v0.2、Demo 页面与五个 GIF 通过公网回归；VibeBoard、nginx 的 PID 未改变。
- Mac mini 上的 `device-runner` 已作为 LaunchAgent 常驻，状态 online，声明 USB、串口和烧录能力。它尚未用“小电脑”实机验证。
- “新建项目选择云端／USB 设备执行器”的代码、测试和生产构建已完成，但因 macOS 钥匙串后台授权再次失效，`20260918-device-routing` 尚未发布到正式平台。

本次用户已提供独立云端模型配置中的 Base URL `https://tokenadvent.com`、模型名 `gpt-5.6-sol` 和 API Key。Key 仅保存于被 Git 忽略且权限为 600 的本地 `.env.cloud-runner`，并已通过 SSH 写入服务器 root-only 的 `/etc/vibehard/model.env`，未输出到日志或提交到 Git。

接口探测确认实际地址为 `https://tokenadvent.com/v1`，`/v1/models` 返回 200，模型列表包含 `gpt-5.6-sol`。最小 `/v1/responses` 请求到达上游，但约 61 秒后返回 429 `rate_limit_error`（上游限流）；因此仍不能把真实模型对话标记为成功。

## 2026-09-17 云端迁移准备（历史记录）

用户已授权迁移执行工具到云端，并选择**独立云端 API 配置，由用户提供**。不要迁移或复用 CC Switch / Mac Codex 的现有凭据。

已完成：

- 服务器安装固定版 Codex CLI 0.149.1、bubblewrap 0.10.0、GCC/G++、Make、CMake 和 zip。Docker 官方镜像仓库连接超时，改用系统软件源提供的原生 Linux 隔离。
- 建立非 root 账号 `vibehard-runner`，安装隔离脚本和 systemd 单元。Runner bundle 已放入 `/opt/vibehard/cloud-runner/`；服务尚未启用或启动，缺少模型配置时会由 `ConditionPathExists` 阻止启动。
- 隔离自检确认平台环境文件、Runner 凭据、root SSH 目录不可见；实际编译并执行简单原生 C 程序成功。没有验证 MCU SDK 或可烧录固件。
- 补齐“下载工程”按钮与有项目归属校验的 ZIP API，加入链接／隐藏文件过滤及大小限制。40 项测试通过；2 项原有 PostgreSQL 测试因未设置测试数据库 URL 而跳过，另做了下述服务器副本集成检查。
- 当前完整分支的生产构建成功。候选包位于 `/opt/vibehard/releases/20260917-cloud-runner/`，本地构建工作区为 `/tmp/vibehard-cloud-release.eRDpMJ`。
- 正式数据库备份在 `/opt/vibehard/backups/20260917-before-cloud/platform.dump`（root-only）。迁移 `0002` 仅应用在数据库副本 `vibehard_cloud_preflight_20260917`，没有修改正式库。
- 候选平台临时端口 `3211` 与候选 Gateway 临时端口 `8788` 完成注册、项目、模拟 Runner 命令投递／事件 ACK／完成状态、ZIP 下载检查。此检查不调用模型，不能作为真实模型验收。
- 新版 PCB、Demo 文案、五个 GIF 的前端预检通过。正式平台和 Gateway 没有切换；完成预检后临时服务停止，候选包与测试数据库保留供继续验收。

该阶段的限流随后恢复，真实模型、生成和编译验收已经成功。所有 localhost-only 临时服务已停止。当前 SSH 阻塞只影响后续设备路由页面发布，不影响已上线的云端执行链路。

后续继续：恢复 SSH 钥匙串访问，发布 `20260918-device-routing`，验证账号页面能看到两个在线执行器并创建分别绑定云端和设备节点的项目。

## 线上版本

- 主站：https://ldcx.tech/vibehard/
- PCB 示例：https://ldcx.tech/vibehard/app/pcb（需要登录）
- 宣传展示：https://ldcx.tech/vibehard/demo
- 活跃发布：`/opt/vibehard/releases/20260918-cloud-runner/standalone`。
- PCB v0.2 已恢复上线，包含精细绘图、装配／布线切换、图层显示、缩放和平移、PNG 下载。它是固定示例预览，并非已接通真实 EDA 自动设计；Gerber 导出仍禁用。
- Demo 保留标题下简介、下方模块说明和五段自动循环 GIF，PCB GIF 使用已裁剪版本。
- 本次发布包含当前完整平台后端、Gateway、云端 Runner、工程下载以及既有 Demo 和 PCB 页面，已执行数据库迁移 `0002`。
- 41 项测试通过，2 项依赖独立 PostgreSQL 测试库的测试跳过；数据库副本迁移、消息链路、真实模型与生产端到端验收另行通过。

发布目录、回滚及检查命令见 [deployment-ldcx.md](deployment-ldcx.md)。可追溯覆盖清单见 [release.json](../deploy/releases/20260916-pcb-restore/release.json)。

## 对话与执行节点

| 节点 | 当前用途 | 2026-09-18 状态 |
| --- | --- | --- |
| `cloud-runner` | 长期在线对话、代码生成、原生 C/C++ 编译、工程下载 | 心跳 online；早期验收通过，19:02 复测模型任务超时 |
| `device-runner` | Mac mini 本地 USB、串口、烧录和实机日志 | online，尚未接入小电脑基础工程和实机 |
| `mac-local` | 旧开发 Runner | offline，不再作为默认节点 |

云端执行架构不依赖 Mac mini，但当前模型请求链路处于退化状态。需要实体数据线的任务必须选择 `device-runner`，并在现场 Mac mini 在线、产品工具链与设备均已准备的情况下运行。

## Mac mini 与模型的位置

平台、数据库与默认 Runner 位于云服务器。设备 Runner 位于 Mac mini，使用 `/Users/hushaohong/vibehard/.runner-workspaces` 存放现场项目。Runner 启动 Codex CLI、运行工具并转发模型请求；Runner 不是模型推理服务。

核查时本机 Codex 配置为 `model_provider = "custom"`、`model = "gpt-5.6-sol"`，入口为 `http://127.0.0.1:15721`，监听进程为 CC Switch。这里只确认到本地代理入口，未核验其当前上游模型服务或可用性，不能据此宣称模型权重在 Mac 上运行。

正式平台当前仅启用经过验收的 `tokenadvent:gpt-5.6-sol` 模型条目。云端和设备 Runner 都使用独立配置连接该 provider。

## 下一步

### 四天演示目标与分工

用户确定的重点是把“小电脑”产品的已验证开发知识库迁入平台，通过对话开发 APP，再经数据线部署到真实设备；同时展示已有模块。原理图识别为重点功能，分析后须在开发者／开发文档页面展示 AI 可读文档，供后续任务使用。原理图识别、知识库迁移和该页面的整合尚未实施，不能标记为已完成。

三人分工已规划：A 负责产品知识库、基础工程和两个稳定 APP 案例；B 负责云端对话、执行链路与本地数据线部署；C 负责原理图识别、证据定位和可查看／编辑／确认／下载的开发文档。四天按基础整理、打通主线、稳定性验证、冻结彩排推进，首要验收为真实设备运行和可重复成功。

详细规划按用户要求移至桌面：`/Users/hushaohong/Desktop/最终演示四天分工规划.md`，未保留在仓库；本节保存团队目标摘要供远程协作使用。还需交接实际产品工程、原理图、已验证知识库、设备连接与部署步骤。

### 云端执行后续步骤

1. 排查云端 Runner 到 provider 的持续重连，恢复后重新运行完整生产验收。
2. 发布新建项目的执行器选择页面，分别验证 `cloud-runner` 和 `device-runner` 项目路由。
3. 接收“小电脑”基础工程、产品知识库、构建／烧录／日志命令，在设备 Runner 工作区中落盘。
4. 连接真实数据线，验证设备识别、编译、烧录、重启、日志回传和失败恢复。
5. 用两个固定 APP 做至少三轮全链路彩排，记录成功率和剩余人工步骤。

## 仓库整理边界

- `docs/` 保存状态、运维记录和文档索引；`deploy/releases/` 保存不含密钥的发布清单；`scripts/` 保存构建、素材处理与验收工具。
- 保留现有页面、媒体和运行时目录的位置，避免破坏引用。`.next/`、`dist/`、`node_modules/`、`.runner-workspaces/` 等已由 `.gitignore` 排除。
- SSH 私钥、钥匙串口令、环境密钥、Runner 凭据和运行日志不纳入提交。打包产物及完整发布源码归档保留在服务器发布目录，不放入 Git。
