# 浏览器设备报告发布验收

2026-10-01 12:11 北京时间，正式版本 `20261001-browser-device-report-v1`。

## Git 与发布范围

- 原型 `6345f40`，归档/实读 `98bea38`，候选 unit 清理修正 `5991194`；PR #40 合并 `0c22fd8`，PR 与默认分支 Linux CI 全绿。合并树与发布源 `5991194` 完全一致。
- 完整包 SHA256：`82a8763b2524d74d7e7ede5bce482d77ba53f385d26e30af5d3161fa9a02e478`。保留前一发布全部源码及 PCB/Demo 保护覆盖。
- 仅平台、云端 Runner、必需 Gateway 切到 `/opt/vibehard/releases/20261001-browser-device-report-v1`。平台 PID 1091430、Runner 1091424、Gateway 1091423，均 active / NRestarts=0。
- Worker / 检索继续引用 `20260930-project-material-lock-v1`；EDA 与知识 CLI 仍需要 `20260930-unified-platform-v2`，必须保留这些目录。Worker、检索、EDA、VibeBoard、nginx PID 与配置/凭据哈希未变。
- 平台 unit 增加 `VIBEHARD_PUBLIC_ORIGIN=https://ldcx.tech`。既有环境文件、模型、私有索引、OSS、认证和 Runner 凭据没有变更；没有生产 DDL 或板端写入。

## 验收证据

- 本地与 Linux CI：442 常规通过/30 条件跳过；条件数据库测试另跑 28 项全部通过（15 项设计/项目/锁，1 项共享知识权限，5 项原理图归档，7 项设备报告）。类型、lint、网页/13 服务构建和 Linux PDF 像素通过。
- 新报告测试覆盖跨账号/匿名拒绝、并发同 ID 重放、正文/跨项目/跨类型冲突、旧 Runner、真实文件子进程、体积/时间/配额、数据篡改和反向代理地址校验。
- 初候选合法上传被 Origin 校验错误拒绝，尚未请求模型或切换生产；定位 Next standalone 内部 URL 后改为固定外部 origin，补上不信任 Host/forwarded 的回归测试。配额用例有 20 次跨 SSH 事务，扩大的是整个用例预算，单次事务仍要求 <5 秒；产品限时不变。
- 修正候选 v2：HTTP 归档 14 ms、真实模型/工具回合 7412 ms。最终正式包再跑隔离验收：归档 19 ms、回合 5971 ms、全链 6430 ms。
- 正式公网 → Gateway → 云端 Runner → 真实模型：归档 14 ms、回合 6235 ms、全链 6708 ms，实际只读工具输出含唯一采集编号和序列号；数据库下载、Runner 工作区与工程 ZIP 的报告 SHA256 一致：`c6f614e7fd47e883b03bb2df75d340651d4d2d23de9a5a0c6b687ee4c03b59c2`。
- 正式验收项目 `2bf70c8e-41f5-4692-bcec-6a5278b84c2f`，报告 `e749272e-a84f-4afd-9c38-fd3c2572aeb1`，回合 `fdb430d4-d909-4d6a-bd0c-0ca4b54741be`，均为独立合成成员账号，不冒用原有用户。报告是合成协议数据，不能当成新一次实机测量。
- 候选/正式/公网 PCB renderer、Demo（18 资源/5 GIF 哈希）、BOM 与匿名鉴权通过。切换前无活跃方案或 Agent 任务；切换后云端/设备心跳新鲜、Gateway 两连接，云端新增 `project-device-reports-v1`；未升级的现场 Runner 没有该能力，含报告任务会明确拒绝。
- 本次新集成网页真机点击因 Mac 锁屏未复测；原型 Mac/Chrome 真实 WebUSB 146 ms 等证据见 [原型验证](rv1126b-webusb-probe.md)。Windows/Linux、物理拔线、休眠、应用部署、编译和烧录仍未验收。

## 使用与数据位置

[Agent 项目](https://ldcx.tech/vibehard/app/agent)、AI 调试、嵌入式开发共用入口：选项目 → 项目概览 → USB 设备 · RV1126B → 连接并归档只读报告 → 点击“让 Agent 分析这份设备报告” → 检查预填内容并手动发送。

小型结构报告留 PostgreSQL 既有 `project_documents`；Markdown 在任务开始前经过哈希校验落盘本项目 `documents/device-report-<UUID>-<哈希前16位>.md`，并进入工程下载。没有新建 OSS 原件或公共知识条目，不授权设备写入。浏览器数据可伪造，只反映采集时刻，不是可信设备身份，也不代表 USB 当前在线。

## 备份、清理与回滚边界

- `backup/` 权限 0700、`platform.dump` 0600，`pg_restore --list` 验证可读，SHA256 `7b96f5ac3a90d0de9a56ccadd8bdc0bdf60bc646550f88b21154eb65692eef64`；保存三个旧 unit 及保护状态。仅备份，没有恢复整库。
- 最终候选 unit 已停止并收集，3211 空闲；临时数据库测试 SSH 隧道与本地 3214 原型服务已关闭。隔离测试库和私有测试配置保留，未复制用户数据，无常驻测试处理器。
- 仅清理本轮两个 inactive 候选目录及压缩包（candidate-v1、candidate-v2），先保留清单/验收到正式 release `evidence/`；本机临时候选包也仍在，可重建，不是长期备份承诺。正式与旧正式回滚集合、用户工程/数据库/OSS/索引未删除。根盘约 9.4 GB 可用，75% 使用率；清理后公网保护检查再次通过。
- 旧平台/Runner 不认识新报告 JSON，不能在有新报告后盲目回退旧解析器。日期限定脚本 `scripts/deploy-device-report-20261001.mjs rollback` 会检查任务空闲且报告数量为零才恢复旧 unit；当前已存在正式验收报告，门槛会拒绝。真实用户资料存在时须保留兼容后端并前向修复，不能通过删报告、改类型或恢复整库绕过门槛。
- 不执行更早发布文档中未经新类型兼容审查的回滚命令；备份存在不代表可以无损恢复用户新增数据。

下一阶段是受控应用产物传输/审批/读回/回滚，尚未实现或上板，详见 [应用部署预研](browser-device-project-integration.md)。
