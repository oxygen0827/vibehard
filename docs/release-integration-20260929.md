# 2026-09-29 PR 整合发布

## 任务范围与发布闸门

用户授权合并全部现有 PR，测试通过后上线。整合 PR #8（EDA 公测）、#23（PDF 图片输入）和 Agent 方案文件交接/推理折叠。仅在独立工作树修改；主工作区未提交内容不纳入发布。

允许本次必要的增量迁移 0008、新版平台、云端 Runner、EDA manager/worker 版本化更新。禁止更换模型/密钥/Runner 凭据、修改知识索引/OSS、操作用户设备或覆盖用户工程。不重启 Gateway、nginx、VibeBoard、方案 worker 和知识检索。

先完整 CI、常规/隔离数据库测试，再 Linux PDF 原生依赖和 EDA 多账号候选、真实布线（原件不变）、真实 Agent 读取方案文件。激活前备份数据库和 unit、确认无活跃任务与 EDA 桌面。迁移仅新增模块表/约束；回滚保留新表，不恢复旧数据覆盖新记录。EDA 仅公开测试版，未审核模块仍不得进入正式目录。

## 发布结果

2026-09-29 13:24（北京时间）已切换 `20260929-integrated-agent-eda-v2`。PR #24 将 #8/#23 和 Agent 修复整合，#25 修正候选实际发现的 PDF 动态 worker 漏包。两个最终 PR 和默认分支 CI 通过；发布源 `4d76d49804e1d73797644adb9dc425e4fd348782` 与最终合并提交 `c5af477210e07378e93e4aa583e34d798b7f024b` 的树完全相同。

- 358 常规测试通过、17 条条件跳过，其中 15 条真实 PostgreSQL 专项单独通过；两条旧 KiCad TS 条件项未单独运行，原生能力由实际镜像/HTTP 验收覆盖。类型、Next `/vibehard` 生产构建和服务打包通过。Linux 实际 EDA 镜像 36 项 Python 测试全部通过。
- v1 精简发布包缺 `pdf.worker.mjs`，实际 Linux 和本机 standalone 均复现；按 diagnose 流程补显式追踪和构建后像素验证，并加入 CI。v1 **从未激活**。v2 在实际 Linux 包渲染 PNG 且像素校验通过；Linux Canvas 1.0.9 归档按 lockfile SHA-512 核验。
- 隔离库 `vibehard_eda_acceptance_20260929` 迁移 0000–0008，三个账号独立桌面、RFB 握手、跨账号 404、错 Cookie 403、票据重放 401、原生检查/ZIP 通过。布线样板 2→0 未连接、原理图一致性 0，源板 SHA 不变，候选另存新工程后逐文件一致。
- 独立非 root 沙箱真实 Agent 2.646 秒完成工具回合，先物化方案再实际读取文件校验码，产物回执一致。未修改用户工程。
- 备份、零活跃方案/Agent 任务及零正式 EDA 桌面后，应用新增模块表，更新平台、云端 Runner、EDA manager/image。正式回环及公网 PCB 详细 renderer、Demo 18 资源/5 GIF、BOM、匿名权限通过；Runner 新能力/新鲜心跳与 Gateway 实时连接正常。
- 上线后使用单独合成账号完成公网真实 Agent 读取方案及 ZIP 回读、跨账号 403；省略项目 ID 的 EDA 真实模型提案成功，未应用提案；真实 PDF→图片→模型识别到 R7/D2，未提交知识库。验收脚本前两次缺少合成记录的 `deadline_at`，只在数据准备阶段失败、未请求模型；修正后完整通过。
- 正式 EDA 新容器另做真实布线：2→0 未连接、原件不变、跨账号 404，验收结束后已停止该测试桌面。软件规则通过不等于硬件电气/制造通过；正式模块目录仍空、未发布未审核样板。
- 5 份历史完成方案与 1 份合成方案均自动保存到所属项目 `designs/`，6/6 文件存在且哈希匹配。合成项目 `27c983f9-5332-44b6-873b-8f3031f0d556`、真实 Agent 回合 `58db0567-753b-448f-a395-943f5eed1f92` 保留可复核。

## 工件、资源和保护

- v2 归档 SHA-256：`7e73446297bbebb6a2c24088063d277c331d5b12ea524f507c25c75d420eb9ee`。完整源文件与服务 bundle 指纹在 release 的 `RELEASE.json`；实际激活时间/保护服务 PID 在 `ACTIVATED.json`。
- EDA 镜像 `vibehard-eda-worker:20260929-integrated-v1`，镜像 ID 前缀 `9a6e2b863edc`；复用固定 KiCad 9 基础镜像并增加 Java/Freerouting 与新代码，完整从零 Dockerfile 另外由 CI 验证。候选和正式实际运行的是同一镜像；每桌面仍 1280 MiB/0.5 CPU、最多 3 个。
- 平台/Runner/EDA manager 发布后 PID `1025977/1025976/1025975`，均 active、NRestarts 0。方案 Worker/检索/Gateway/VibeBoard PID `1006630/1002794/727637/980049` 未变，nginx 未重启；模型/凭据、知识索引/OSS、设备和真实用户工程未改。
- 候选 3211/6084 已关闭，隔离数据和成功合成证据保留。磁盘约 3.2 GB 可用，不能放大资料原件。Mac 浏览器自动化超时，未声称已做生产登录态人工点击；reasoning 默认折叠及点击展开由组件回归覆盖。

## 回滚

数据库 dump SHA-256 `c7a51dd0ef09f9dad99c238c9b60ce2277becd6495829a6725c1c08d79600ef2`；旧平台/Runner/manager unit 和 EDA manager 配置位于 release 的 root-only `backup/`。备份已通过 pg_restore 列表验证。

确认没有活跃方案/Agent 任务和 EDA 桌面后，运行部署主机上的受控脚本：

```sh
/opt/vibehard/runtime/node-v22.23.1 /opt/vibehard/releases/20260929-integrated-agent-eda-v2/activate.mjs rollback
```

恢复旧单元和旧 EDA 镜像，不恢复旧数据库覆盖新数据；新增模块表和已生成方案文件保留。源码版在 `scripts/deploy-integration-20260929.mjs`。
