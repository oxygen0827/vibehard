# 2026-09-30 完整版本统一发布与保留策略

## 历史清理结果：2026-09-30 18:04 已完成

- 用户明确允许下载完整 releases 到本机私有目录后，先完成备份、校验、引用盘点及无删除预演，再精确清理。完整归档 7,054,646,269 字节（约 6.57 GiB），远端/本机 SHA256 均为 `f157c9a8a1f9a5a486a5a6105e70a78d548de28ceae66edaddc506159f20b4aa`，完整解码通过，逐成员清单 222,487 项。待删集合 75 项、191,608 条目录/文件/链接、9,823,275,318 文件内容字节与源端一致。
- 已删除 42 个旧目录和 33 个旧压缩包，包含从未激活的本轮 v1。清理前后根盘可用 1,487,192,064→11,903,438,848 字节（约 1.4→11.1 GiB），97%→71%；releases 从 12,291,575,808 降为 1,875,193,856 字节（约 11.45→1.75 GiB）。细微差值来自验证记录/正常日志写入。
- 当前版及全部上一版回滚依赖如下；另外保留 4 个对应当前/回滚压缩包和未纳入清理的少量零散脚本/元数据文件。没有删除 releases 根目录。

| 保留目录 | 原因 |
| --- | --- |
| `20260930-unified-platform-v2` | 当前六服务、知识 CLI、验收证据和回滚入口 |
| `20260930-project-archive-v1` | 上一版网页/Runner/Gateway |
| `20260928-bom-price-freeze-v1` | 上一版方案 Worker |
| `20260928-audit-fixes-v1` | 上一版受限检索 |
| `20260929-integrated-agent-eda-v2` | 上一版 EDA manager |
| `20260925-eda-isolated-v2` | 回滚备份中的 EDA 辅助链接目标 |
| `20260928-knowledge-control-v2` | 上一版知识管理 CLI |
| `20260927-controlled-ingestion-v1` | 已停止且 disabled 的旧入库预检单元仍引用；保守保留约 41 MiB，未启动它 |

- systemd（含临时单元）、进程 cwd/映射/打开文件、容器挂载、cron、辅助脚本、外部和保留目录内部软链接均检查过。预演拦住纳秒时间戳在 JavaScript JSON 中舍入的问题，改为字符串无损传递，新增回归后 6 项保护测试通过；重新预演和正式校验通过才删除，没有放宽保护。
- 18:05 实际发布源码/bundle SHA、PCB 详细 renderer、18 个资源、5 个 Demo GIF、BOM 与匿名鉴权、私有检索、授权 EDA 健康、回滚 unit 引用路径/EDA 旧链接及配置/凭据/索引保护均通过。六服务、VibeBoard、nginx PID 未变，六服务 NRestarts=0；云端/设备心跳约 4.9 秒，Gateway 两条实时连接。生产证据为当前 release 的 `evidence/retention.json` 和 `evidence/retention-verification.json`。
- 本次没有服务重启、数据库迁移、付费模型或硬件任务；不清理数据库、OSS、知识索引、用户工程、Runner 状态、Docker、独立 VibeBoard、测试库或其他备份目录。首次与备份并行的前端复核失败（外层日志未保留具体原因），暂停备份后和清理后完整复核通过，未把它擅自定性为代码缺陷。

### 备份与恢复边界

完整归档及 `BACKUP.json`、逐文件清单、删除清单、预演结果、操作脚本和恢复说明保存在负责人 Mac 的私有目录 `/private/tmp/vibehard-retention-backup.gw9sFO/`。目录 0700、归档 0600；可能包含私密配置/凭据/历史数据库备份，禁止提交 Git 或发给同伴。该临时目录不是永久保存承诺，应由负责人迁入私有、加密的长期备份介质。

上一套完整回滚依赖仍在服务器，可用下方统一回滚入口，不恢复旧数据库。更早版本仅从完整备份恢复：先校验归档 SHA，再把明确的 `releases/<版本>` 解到新的私有暂存目录，逐文件核验后由发布负责人恢复其版本路径、核对依赖并单独安排切换；不要整体覆盖活动目录，也不要直接执行下方其他历史文档中的旧回滚命令。本备份不包含整套数据库/用户工程/OSS/知识索引/Docker，不能当作整机灾备。

## 实际发布结果：15:44 已上线

- 15:44 正式切换 `20260930-unified-platform-v2`。发布源 `d0c7683dac3f64802a49634bb4dac8896d164cd7`；PR #34 合并为 `8ea2808bf5519f1c3fbb8ecc8fac7f050618f6bc`，树完全一致。PR 与合并后默认分支 CI 均成功，含 394 常规测试、20 项独立数据库测试和 Linux PDF 像素验收。
- 发布压缩包 SHA256：`c787e98a74393f940e4d881661ad5fecf7c7c16ab47d5d56c40127de90a1ea00`。包内包含 9 个服务/验收 bundle、完整源码和 standalone；知识 CLI 入口现在为新 release 的 `services/knowledge-batch-control.cjs`。
- 隔离检索 60 次双并发，P95 32.75 ms、最大 51.39 ms、零失败，MemoryPeak 39,268,352 字节。候选真实方案 21.933 秒、2 条引用，原理图识别 9.332 秒，完整验收 43.937 秒。
- 正式公网真实方案 21.066 秒、2 条自动索引引用，原件 SHA/页/片段与索引可回查；识别 12.120 秒，全链路 43.096 秒。两个新合成普通账号正常登录，BOM/方案/原图/正文/Agent 跨账号拒绝、重放不重复模型、真实工具读取文件及 ZIP 哈希一致性通过。没有编辑既有用户项目，没有操作设备，没有自动重试付费任务。
- 正式合成项目 `daa27a9c-f208-4679-a60d-9cddfabe7d9c`，方案任务 `54d87420-c487-4dc6-bf24-a7f9db01748d`，Agent 回合 `bd40590b-7da2-44a2-855f-12778445ca17`；完整证据留在新 release 的 `evidence/production-acceptance.json`。
- EDA manager 的新旧源码 SHA 均为 `0d344c588dcc6c9fed580b984abcbe7efd62ab6b224cec78606288406c768205`，现用镜像 ID `sha256:9a6e2b863edc70d7a35025efa2219a25caa9a9b2dbeade89268a9b31909edc9e` 未改。实际 Python 环境下 manager 13 项测试通过、切换后授权健康检查通过；本轮未重新执行真实布线/硬件精度验收。
- 平台/设计 Worker/Runner/Gateway/检索/EDA manager PID 分别为 `1059304/1059303/1059297/1059296/1059295/1059294`，六个服务 active、NRestarts=0，代码均引用新 release。Runner 工作目录依旧 `/opt/vibehard/cloud-runner`，其代码 bundle 已统一；运行状态和项目文件不搬入发布目录。EDA 辅助链接也已更新。
- 15:46 云端/设备 Runner 心跳年龄 3/2 秒、Gateway 有两条连接。VibeBoard/nginx PID、私密配置、Runner credential、索引和控制文件哈希未变。候选已停、3211 空闲；候选网页 SIGTERM 返回 143 留下的失败标记在核对 PID=0 后清除，不是生产崩溃或 OOM。
- 无生产数据库迁移。新 release `backup/` 保存六个旧单元、EDA 旧链接及数据库 dump（485743 字节，SHA256 `ebb10750a3d1c0a2cad154dfad92f21e6c844e4923bd283dfe801d53e9696fde`），`pg_restore --list` 可读；没有执行正式库恢复。
- 当时历史版本尚未删除、根盘约 1.4 GiB/97%；后续已取得用户对本机私有目的地的明确授权，18:04 清理完成，以顶部清理记录为准。

回滚入口（先确认任务与 EDA 桌面空闲）：

```sh
/opt/vibehard/runtime/node-v22.23.1 /opt/vibehard/releases/20260930-unified-platform-v2/source/scripts/deploy-unified-platform-20260930.mjs rollback
```

旧平台/Runner/Gateway `20260930-project-archive-v1`、旧 Worker `20260928-bom-price-freeze-v1`、旧检索 `20260928-audit-fixes-v1`、旧 EDA manager `20260929-integrated-agent-eda-v2`、备份 EDA 链接所指的 `20260925-eda-isolated-v2` 和上一份 CLI `20260928-knowledge-control-v2` 均已保留，且清理后检查可用；不是只保留旧网页目录。

## 任务范围

用户确认将固定聊天区一并上线，并将 VibeHard 的网页/API、Runner、Gateway、方案 Worker、检索 Worker、EDA manager 与批量知识管理 CLI 收敛到同一个不可变 release。数据库、OSS 原件、索引版本、用户工作区、模型配置及 Runner 凭据不变；不清理 Docker 或独立 VibeBoard。

以下为发布准备与约束记录，实际结果以上节为准。v1 停在隔离准备阶段，从未激活：共享知识创建者外键指向未复制的用户；v2 仅清空隔离副本的可空创建者字段，保留正文版本与审核记录，不复制真实账号。只允许恢复没有用户或项目的已知隔离准备库。

## 代码与验收

- 固定聊天区、固定输入框、上翻历史暂停跟随、返回最新；推理展开在原生布局前暂停跟随。手机项目/审批面板独立切换。
- 完整打包全部在用服务和知识 CLI，沿用已发布完整源码和 PCB/Demo 保护清单；Linux Canvas 包按锁文件 SHA512 校验。
- 常规测试 394 通过/22 条件跳过；类型、定向 lint 及全部服务 bundle 通过。聊天 UI 四种视口 Chromium 验收和 `/vibehard` 生产构建已通过；最终源提交 CI、云端候选与正式验收另行记录。
- 候选使用独立 `vibehard_unified_acceptance_20260930`，只复制模型配置/Profile 和平台共享知识；不复制用户或私有项目。候选 Worker 不接生产队列，检索通过独立 Unix socket，保持 384 MiB/50% CPU 限额。验证 60 次双并发检索与真实方案引用、原理图归档、真实 Agent 工具读文件及两账号权限。
- EDA manager/worker 源码及 Docker 镜像不做业务改动；配套 Python 测试、镜像/健康检查及切换后路径核验另记。公网前后验证 PCB renderer、Demo、BOM、匿名鉴权。

## 激活及回滚

发布脚本：`scripts/deploy-unified-platform-20260930.mjs`；准备、候选、激活、正式验证、候选清理及回滚分开执行。

切换前要求方案/Agent 任务和 EDA 桌面空闲，备份六个 systemd 单元、EDA 辅助链接目标与数据库；保留限额、服务身份、配置、密钥和知识索引哈希。仅本次六个 VibeHard 服务重启，VibeBoard/nginx 不重启。没有生产数据库迁移。

回滚按新 release 的 `backup/` 恢复六个原单元及 EDA 链接，不用旧数据库覆盖新数据。必须保留旧单元涉及的所有 release；“一套回滚版本”目前是一个跨组件版本集合，不是只留旧网页目录。

## 清理闸门

1. 新版候选、CI、激活和正式真实验收都通过。
2. 原发布目录有独立、校验可读的备份。完整备份可能含私密信息，下载到本机需用户明确确认；确认前不下载、不删除。
3. 精确枚举目录/压缩包；保留新版本、全部回滚依赖、符号链接/服务仍引用的目录。拒绝路径逃逸、目录集合漂移和活动引用。
4. 仅清理明确列出的 `/opt/vibehard/releases/` 直接子项；不触碰知识、数据库、用户文件、设备状态、其他应用或 Docker。
5. 清理后再次核对服务、前端保护、磁盘和回滚文件可读性，记录实际释放容量。未满足闸门时停止清理，而非扩大删除范围。
