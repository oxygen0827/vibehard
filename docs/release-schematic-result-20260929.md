# 2026-09-29 原理图正文校验发布

用户授权合并 PR #27 并发布。PR 与合并提交 `40f4130e53eefdce7c34f3833b499f86d4a31115` 的完整 Verify CI 均通过；14:10（北京时间）平台切换到 `20260929-schematic-result-v1`。CI 包含常规测试、类型、平台/服务构建、Linux standalone PDF 像素验证和隔离 PostgreSQL 权限测试。

## 根因与当前限制

用户单页 PDF 已正常转图；真实 DeepSeek 输出 5590 字符正文，旧的 5500 上限使接口拒绝全部结果。加上声明共 5638 字符，本可容纳于知识库 6000 字符容量。

- 原理图正文硬上限：知识库容量减服务端声明，当前 **5952 字符**。
- 服务端声明：**48 字符**；完整草稿内容上限仍为 **6000 字符**。
- 模型提示目标：**4500 字符**，为实际输出留下余量；不是硬上限。
- 原图上限：5 MiB，PDF 最多 6 页。字符计数沿用应用字符串长度，包括字母、标点、空格、换行和 Markdown 符号。

可容纳正文完整保留；真正超限时显示实际长度和上限，短正文/标题/字段格式分别报错。

## 验收证据

- 原真实失败输出回放后无截断通过；28 项相关测试包含 5590 字符结果通过真实接口进入待审核备选、完整正文 6000 字符边界及超一字符拒绝。
- 云端实际候选的 PDF 原生渲染像素检查通过；同一用户 PDF 经候选 HTTP→PDF 转图→DeepSeek 完成识别，43.9 秒返回完整草稿 4765 字符，原文件 SHA256 和可见器件引用核对通过。
- 正式公网同图验收通过：51.9 秒返回 3848 字符完整草稿，`deepseek-flash`，原文件 SHA256 与可见器件引用匹配；未提交知识库。
- 激活前备份和零活跃方案/Agent 任务检查通过。候选、正式回环与公网均通过 PCB v0.2 详细 renderer、18 个静态资源、Demo 五个 GIF、BOM 和匿名访问保护检查。
- 平台 PID `1027813`、active、NRestarts=0；候选 3211 已关闭。发布后云端/设备 Runner 心跳分别 7/8 秒前，Gateway 有两条实时连接。仅重启平台；Runner、Gateway、VibeBoard、EDA manager、方案 Worker、检索服务和 nginx PID 未变，敏感配置哈希一致。
- 没有数据库迁移、模型配置/凭据变更或知识发布。真实图纸及模型正文未进入 Git/正式知识库。识别验收不等于逐引脚电气正确性验收。

## 工件与回滚

发布包 SHA256：`46d6a99f2807b6bfefa12bc30dcd2ff62fede561fcca6ab3c15c63f2402ad432`。完整源码和发布工具哈希在 release 的 `RELEASE.json`，激活记录在 `ACTIVATED.json`。当前正式发布全部源文件均保留，运行时仅修改 `lib/agent/schematic.ts` 和 `app/api/schematic/route.ts`；PCB、Demo、Next 配置和其他已发布功能源码一致。Linux Canvas 归档按锁文件 SHA512 验证。

旧平台 unit 与已通过 pg_restore 列表核验的数据库备份位于 release 的 root-only `backup/`。数据库 dump SHA256：`4ca982cf4ca00c9ba045e22329885babf2a9a767a696dc1ec2dbc1143d5e08d7`。回滚仅恢复旧平台 unit，不恢复数据库覆盖新记录。

确认无活跃方案/Agent 任务后，在部署主机运行：

```sh
/opt/vibehard/runtime/node-v22.23.1 \
  --env-file=/etc/vibehard/platform.env \
  --env-file=/etc/vibehard/eda-platform.env \
  /opt/vibehard/releases/20260929-schematic-result-v1/scripts/deploy-schematic-result.mjs \
  /opt/vibehard/releases/20260929-schematic-result-v1 rollback
```

回滚目标为 `/opt/vibehard/releases/20260929-integrated-agent-eda-v2/standalone`。
