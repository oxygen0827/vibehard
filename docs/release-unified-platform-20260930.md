# 2026-09-30 完整版本统一发布与保留策略

## 实际发布结果：已上线，历史清理尚未执行

- 15:44 正式切换 `20260930-unified-platform-v2`。发布源 `d0c7683dac3f64802a49634bb4dac8896d164cd7`；PR #34 合并为 `8ea2808bf5519f1c3fbb8ecc8fac7f050618f6bc`，树完全一致。PR 与合并后默认分支 CI 均成功，含 394 常规测试、20 项独立数据库测试和 Linux PDF 像素验收。
- 发布压缩包 SHA256：`c787e98a74393f940e4d881661ad5fecf7c7c16ab47d5d56c40127de90a1ea00`。包内包含 9 个服务/验收 bundle、完整源码和 standalone；知识 CLI 入口现在为新 release 的 `services/knowledge-batch-control.cjs`。
- 隔离检索 60 次双并发，P95 32.75 ms、最大 51.39 ms、零失败，MemoryPeak 39,268,352 字节。候选真实方案 21.933 秒、2 条引用，原理图识别 9.332 秒，完整验收 43.937 秒。
- 正式公网真实方案 21.066 秒、2 条自动索引引用，原件 SHA/页/片段与索引可回查；识别 12.120 秒，全链路 43.096 秒。两个新合成普通账号正常登录，BOM/方案/原图/正文/Agent 跨账号拒绝、重放不重复模型、真实工具读取文件及 ZIP 哈希一致性通过。没有编辑既有用户项目，没有操作设备，没有自动重试付费任务。
- 正式合成项目 `daa27a9c-f208-4679-a60d-9cddfabe7d9c`，方案任务 `54d87420-c487-4dc6-bf24-a7f9db01748d`，Agent 回合 `bd40590b-7da2-44a2-855f-12778445ca17`；完整证据留在新 release 的 `evidence/production-acceptance.json`。
- EDA manager 的新旧源码 SHA 均为 `0d344c588dcc6c9fed580b984abcbe7efd62ab6b224cec78606288406c768205`，现用镜像 ID `sha256:9a6e2b863edc70d7a35025efa2219a25caa9a9b2dbeade89268a9b31909edc9e` 未改。实际 Python 环境下 manager 13 项测试通过、切换后授权健康检查通过；本轮未重新执行真实布线/硬件精度验收。
- 平台/设计 Worker/Runner/Gateway/检索/EDA manager PID 分别为 `1059304/1059303/1059297/1059296/1059295/1059294`，六个服务 active、NRestarts=0，代码均引用新 release。Runner 工作目录依旧 `/opt/vibehard/cloud-runner`，其代码 bundle 已统一；运行状态和项目文件不搬入发布目录。EDA 辅助链接也已更新。
- 15:46 云端/设备 Runner 心跳年龄 3/2 秒、Gateway 有两条连接。VibeBoard/nginx PID、私密配置、Runner credential、索引和控制文件哈希未变。候选已停、3211 空闲；候选网页 SIGTERM 返回 143 留下的失败标记在核对 PID=0 后清除，不是生产崩溃或 OOM。
- 无生产数据库迁移。新 release `backup/` 保存六个旧单元、EDA 旧链接及数据库 dump（485743 字节，SHA256 `ebb10750a3d1c0a2cad154dfad92f21e6c844e4923bd283dfe801d53e9696fde`），`pg_restore --list` 可读；没有执行正式库恢复。
- **历史版本未删除**。完整旧 release 下载包含潜在敏感备份，安全审核要求用户明确批准本机目的地；已询问、尚未收到该项回复，未通过其他通道绕过。当前根盘约 1.4 GiB 可用/97% 已用，包含本轮未激活 v1 和正式 v2 工件；需要后续完成授权备份与精确保留清理，不应继续堆积发布包。

回滚入口（先确认任务与 EDA 桌面空闲）：

```sh
/opt/vibehard/runtime/node-v22.23.1 /opt/vibehard/releases/20260930-unified-platform-v2/source/scripts/deploy-unified-platform-20260930.mjs rollback
```

当前保留全部旧目录，回滚依赖尚完整。后续保留集合必须包含旧平台/Runner/Gateway `20260930-project-archive-v1`、旧 Worker `20260928-bom-price-freeze-v1`、旧检索 `20260928-audit-fixes-v1`、旧 EDA manager `20260929-integrated-agent-eda-v2`，以及备份 EDA 链接所指的 `20260925-eda-isolated-v2`；不要只留旧网页目录。CLI 的上一份运行包 `20260928-knowledge-control-v2` 也应先保留。

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
