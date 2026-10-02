# 实用工具嵌入修复

任务确认：用户于 2026-10-02 授权修复并上线。以实际运行的 `20261002-schematic-workspace-ui-v1` / `f4c54a0` 的 1224 个哈希核验源码文件为基线。

允许运行时修改：`next.config.ts` 的 `/zutils/:path*` 安全响应头，以及 `lib/zutils-tools.ts` 的部署前缀与缓存版本。仅工具静态页将 `frame-ancestors` 改为 `self`；其他 CSP 指令与平台页保持原策略。设备工具仍需兼容浏览器和实际硬件。

验证：全部 42 个入口（39 工具页与 3 实验台）、引用脚本/样式、浏览器同站点 iframe、代表计算器交互；候选及正式 PCB/Demo 回归。无数据库迁移，仅切换平台服务；保留前一版本单元和回滚入口。


## 2026-10-02 13:43 实用工具嵌入修复上线

- 正式平台切换为 `/opt/vibehard/releases/20261002-tools-embedding-v1/standalone`，基线为实际上一正式版 `20261002-schematic-workspace-ui-v1` / `f4c54a0`。1224 个旧源码文件完整哈希核对，发布包保留全部源码，运行时只改 `next.config.ts` 与 `lib/zutils-tools.ts`。Git 修复提交 `89bb215`，本地独立分支 `codex/tools-iframe-fix`；GitHub 推送/PR 被自动审批拒绝，需要明确源码外发授权，未绕过。
- 原因：全局 `frame-ancestors 'none'` 阻止 iframe。仅 `/zutils/:path*` 改为 `frame-ancestors 'self'`；所有 42 个入口（39 工具 + 3 实验台）补齐 `/vibehard` 部署前缀与缓存版本 `?v=embed-v1`，其余安全指令/权限保持不变。
- 466 项测试通过、30 项因独立 DB 等条件跳过；7 项沙箱监听限制初败，4 个相关文件提权重跑全部通过。类型/ESLint/Next 构建、候选与正式 42 页面/56 脚本样式状态及哈希核对、PDF 像素渲染通过；切换前当前实际发布、候选、正式回环和公网 PCB 详细 renderer 与 Demo 18 资源/5 GIF 回归通过。本机 Chromium 42 个 iframe 可见，LED 输入 5V→12V 结果 150Ω→500Ω；公网 Chromium 同样验证 42 个 iframe 可见及 LED 150Ω→500Ω 实际交互。
- 仅重启 `vibehard.service`，PID `1130713`，复查 active、NRestarts=0。Runner/Gateway/设计 worker/知识检索/EDA manager/VibeBoard/nginx PID 与环境/模型/配置哈希保持一致，无 DB 迁移/数据写入/模型调用/设备操作。切换后 cloud/device 心跳年龄 2/8 秒，Gateway established 连接 2；候选已停止、3217 空闲。
- 发布归档 SHA256 `0e25b4e6f11e30bd0f4a355bddbf15b1a4f2de0437188e7661aff2dbaefe5e73`。旧平台单元保存在新 release 的 `backup/vibehard.service`；空闲时可用 `source/scripts/deploy-tools-embedding.mjs rollback` 恢复前版，只切平台，不恢复 DB。原静态导出 timestamp/web-serial 在 Chromium 有可恢复 hydration 提示；本轮未更改工具导出或验证真实设备连接。
