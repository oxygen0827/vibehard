# 当前状态与交接

最新更新：2026-09-17，北京时间。以下核查结果分别标注时间，不代表持续监控。

本次用户已提供独立云端模型配置中的 Base URL `https://tokenadvent.com` 和模型名 `gpt-5.6-sol`；API Key 尚未填写，真实模型验收和正式切换仍未开始。

## 2026-09-17 云端迁移准备（尚未正式切换）

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

当前阻塞：缺少 API Key，且需要验证 `https://tokenadvent.com` 的实际 API 路径和 Responses API 兼容性。本地已准备 `.env.cloud-runner` 模板（Git 忽略，权限 600），其中 Base URL 和模型名已填写，等待用户填写 Key。不要把占位配置接入正式服务，也不要把模拟消息当作模型输出。

下一次继续：先读取本文件和 [云端 Runner 说明](../deploy/runner/README.md)，检查用户的 API 配置是否填写。补齐真实模型配置后，在隔离环境验证 Codex 会话、工具审批、生成、编译、下载；通过后刷新正式数据库备份，执行迁移，切换平台／Gateway，注册并启用 `cloud-runner`，核对新鲜心跳和真实完成事件。正式切换前后仍须运行前端检查，保留 PCB 与 Demo。已有 Mac 项目是否有工作区内容必须核对后再迁移，不能仅改 Runner 名称造成文件丢失。

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

### 四天演示目标与分工

用户确定的重点是把“小电脑”产品的已验证开发知识库迁入平台，通过对话开发 APP，再经数据线部署到真实设备；同时展示已有模块。原理图识别为重点功能，分析后须在开发者／开发文档页面展示 AI 可读文档，供后续任务使用。原理图识别、知识库迁移和该页面的整合尚未实施，不能标记为已完成。

三人分工已规划：A 负责产品知识库、基础工程和两个稳定 APP 案例；B 负责云端对话、执行链路与本地数据线部署；C 负责原理图识别、证据定位和可查看／编辑／确认／下载的开发文档。四天按基础整理、打通主线、稳定性验证、冻结彩排推进，首要验收为真实设备运行和可重复成功。

详细规划按用户要求移至桌面：`/Users/hushaohong/Desktop/最终演示四天分工规划.md`，未保留在仓库；本节保存团队目标摘要供远程协作使用。还需交接实际产品工程、原理图、已验证知识库、设备连接与部署步骤。

### 云端执行后续步骤

1. 按上面的 9 月 17 日迁移准备状态，接入用户提供的独立云端 API。
2. 完成云端真实对话、工具审批、编译与下载验收，再切换正式服务。
3. 更新真实运行状态，确认即使 Mac mini 不参与链路也能完成任务。
4. 本地 Runner 以后用于 USB、串口及烧录等连接实体硬件的操作；本轮不恢复旧 Mac Runner。

## 仓库整理边界

- `docs/` 保存状态、运维记录和文档索引；`deploy/releases/` 保存不含密钥的发布清单；`scripts/` 保存构建、素材处理与验收工具。
- 保留现有页面、媒体和运行时目录的位置，避免破坏引用。`.next/`、`dist/`、`node_modules/`、`.runner-workspaces/` 等已由 `.gitignore` 排除。
- SSH 私钥、钥匙串口令、环境密钥、Runner 凭据和运行日志不纳入提交。打包产物及完整发布源码归档保留在服务器发布目录，不放入 Git。
