# 项目状态

## 当前阶段

- Phase: 云端 Agent 平台内测与设备闭环准备
- Active focus: 修复模型 provider 超时；建立三人协作与项目知识导入规范
- Last updated: 2026-09-18 19:21 CST

## 构建

- Command: `NEXT_PUBLIC_BASE_PATH=/vibehard pnpm build`、`pnpm build:services`
- Last result: 已验证（2026-09-18 发布前记录；本次文档任务未重跑构建）
- Evidence: `docs/current-status.md`、`deploy/releases/20260918-cloud-runner/release.json`

## 测试

- Unit test: 已验证，41 项通过、2 项因缺少独立 PostgreSQL 测试库跳过
- Production web: 部分完成；登录、项目/会话、SSE、中断、PCB/Demo 已验证
- Cloud model E2E: 阻塞；浏览器持续重连，正式验收 5 分钟超时
- Hardware test: 未验证；`device-runner` 在线但未连接“小电脑”完成实机闭环
- Evidence: `docs/current-status.md`

## 当前风险

- `cloud-runner` 心跳正常不等于模型可用；provider/出口链路当前超时。
- 生产默认并发为 1，未经队列与配额控制的大批量导入/任务会阻塞其他用户。
- `/opt/vibehard/releases` 约 1.3 GB，旧 release 与 `/opt/vibehard/incoming` 尚无明确保留/清理策略。
- 当前没有受控的项目知识上传 API；禁止把旧 `incoming` 目录当作团队公共投递箱。

## 阻塞项

- 云端模型请求持续重连并超时。
- 项目知识导入工具/API 尚未实现。
- 小电脑工程、工具链、接线和烧录步骤尚未交接。

## 下一步

1. 修复 provider 网络链路并重跑完整生产验收。
2. 实现按项目 ID 解析 workspace 的受控文档导入工具或 API。
3. 发布执行器选择页面并验证云端/设备路由。
4. 导入小电脑基础工程，完成编译、烧录、重启和日志回传。
