# 2026-09-30 项目选择与原理图私有归档发布

## 结果与范围

北京时间 13:30 已发布 `20260930-project-archive-v1`：项目概览、统一项目选择、原理图私有归档，以及 Agent 任务前的文档交接。PR #32 经评审、CI 和隔离真实验收后合并为 `de93e6a3f2225c98e617abd910659921dee9bc61`；发布源 `0d0c3458995005a0ad47bbb74b90fc2714d8d8c8` 与合并提交的树一致。默认分支 CI 通过后才激活。主工作区未提交内容未纳入发布。

网页、云端 Runner、Gateway 配套更新；生产应用增量迁移 `0009_project_documents`。原图存既有私有 OSS 的独立项目前缀，正文/状态存 PostgreSQL，任务前校验并将 Markdown 写入所属项目 `documents/`。项目资料不自动成为公共知识，申请和管理员/开发者审核仍独立。使用方式见 [归档说明](project-document-archive.md)。

## 验收证据

- Linux CI：388 常规测试通过、22 条件跳过；其中 20 项数据库测试另在三个隔离库通过（方案/项目/知识 14、共享知识 1、归档 5）。类型检查、网页/服务构建和 standalone PDF 像素检查通过。两条 KiCad 条件测试未在本轮执行，不声称新做 EDA 精度/硬件验收。
- 首次 CI 的 PDF 像素检查因源码与 standalone 两份原生 Canvas 类型混用而失败。本机混用 `Path2D` 最小复现同一 `InvalidArg`；按 diagnose 流程将 PDF 导入规范化为真实路径，增加依赖必须位于 standalone、PDF 与渲染器共用 Canvas 的断言。新 CI 和实际 Linux 发布包像素检查均通过，未关闭检查或修改受保护 Next 配置。
- 隔离数据库 `vibehard_archive_acceptance_20260930` 仅复制加密模型设置和模型 Profile，不复制用户/项目。两个新建普通合成账号通过正常登录 API 验收；一页合成 PDF 真实识别约 12.0 秒，完整链路 20.5 秒。原件下载 SHA、正文归档、同请求重放、跨账号拒绝、旧 Runner 能力拒绝，以及非 root 沙箱真实 Agent 工具读取均通过。
- 正式公网再次使用两个新建普通合成账号完成同一链路：识别 13.0 秒，合计 19.9 秒；实际云端 Runner/Gateway 执行工具读到文件随机标识，资料同步回执入库，项目 ZIP 包含相同 SHA 的 Markdown。原图下载 SHA 匹配；跨账号列表/下载/识别 404、Agent 请求 403；匿名项目接口 401、OSS 原件匿名 HEAD 403；同请求重放没有第二次模型调用。
- 本轮共两次真实视觉识别、两次真实 Agent 回合，无自动付费重试；合成账号/项目/原件及验收记录保留用于审计，没有操作既有用户工程或设备。
- 候选、正式回环与公网均通过 PCB v0.2 详细 renderer、Demo 18 个资源/5 个 GIF 哈希、BOM 和匿名鉴权检查。生产登录态人工视觉点击本轮未做；组件测试与前一轮本地浏览器交互证据不冒充生产人工验收。

正式合成项目 `721cbe08-5a11-4726-b051-28ce3606f789`；资料 `027065ab-5700-46d8-b74b-76869e3e23ad`；Agent 回合 `a89148eb-e10c-461e-97b3-302e124989a7`。原图 SHA256 `e42b93f51f2c894e3882dda597f31a2f6779126a344ae425b84596d64450cf1a`；Markdown SHA256 `eca6d741d91b4ee10a24d7da28f2dc45d28839e66a765f468edb2438686fb9ab`。这些是链路证据，不代表原理图精度或硬件验证。

## 发布保护与容量

- 正式网页目录：`/opt/vibehard/releases/20260930-project-archive-v1/standalone`；Runner/Gateway bundle 在同一 release 的 `services/`。1156 个跟踪源文件及四个服务 bundle 哈希记录在 `RELEASE.json`，完整保留此前发布源码及 PCB/Demo 覆盖。
- 归档 `/opt/vibehard/releases/20260930-project-archive-v1.tar.gz`，SHA256 `c5d3cf56733b661ad6cf39a87664d3304cdc1ef664394ab92d1e63bf5c7e883e`。
- 切换前设计和 Agent 活跃任务为零，数据库 dump 已通过 `pg_restore --list` 校验。仅重启平台、Runner、Gateway；13:32 验证 PID 分别 `1055481/1055475/1055474`、NRestarts 均 0。方案 Worker、检索、EDA manager、VibeBoard、nginx PID 未变，既有平台/模型/Runner 配置和 credential SHA 未变。
- 新增 root-only `0600` 的 `/etc/vibehard/project-archive.env`，仅平台加载 OSS 归档配置；不将 OSS 凭据交给 Runner/Gateway/浏览器，不修改 bucket ACL 或重注册 Runner。
- 13:32 云端/设备 Runner 心跳分别为 8/6 秒，Gateway 有两条活连接。仅云端 Runner 已具备 `project-documents-v1`；旧设备节点仍可做原有任务，但含新归档的 Agent 任务会明确要求更新节点。
- 候选已停，3211 无监听；隔离库保留，不再运行候选进程。根盘约 2.1 GB 可用、95% 已用；没有擅自删除旧 release。原图继续放 OSS，不向服务器复制大批原件。后续发布前应规划可回滚的旧包清理或扩容。

## 回滚与未覆盖边界

备份在新 release 的 root-only `backup/`，包含三份旧 unit 和 PostgreSQL dump；dump SHA256 `9e3c6f0ada2e8a8cc4f861e47b4bcb950e546220a98b7acbcbac75bcf8df1868`。候选、正式验收和检查记录位于 `evidence/`，激活信息在 `ACTIVATED.json`。

确认没有进行中任务后，使用已发布脚本恢复三个旧单元：

```sh
/opt/vibehard/runtime/node-v22.23.1 /opt/vibehard/releases/20260930-project-archive-v1/source/scripts/deploy-project-archive-release.mjs rollback
```

旧平台回到 `20260929-platform-ui-v1`，旧 Runner 回到 `20260929-integrated-agent-eda-v2`，Gateway 回到 `20260918-cloud-runner`。保留新增表、原图、Markdown 和新数据，不用旧 dump 覆盖生产；旧 UI 不支持新归档，不表示资料被删除。

首版仍限制每项目 20 次归档尝试、单文件 5 MiB、PDF 6 页；没有识别后台恢复队列/自助删除，意外退出可能需人工核查处理中记录。历史仅留在浏览器的识别结果无法自动补归档。仅打通原理图与 Agent，AI 调试/嵌入式开发模块尚未统一此选择与资料链路。两次合成成功不构成长时间稳定性保证。
