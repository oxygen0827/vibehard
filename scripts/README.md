# 脚本说明

脚本保留现有位置，以免破坏调用路径。

| 脚本 | 用途 |
| --- | --- |
| `build-standalone.sh` | 构建 Next.js standalone，并补齐 public、static、SWC 运行依赖；按当前脚本约定处理跨平台 sharp 依赖 |
| `build-services.mjs` | 构建 Gateway、Runner、数据库迁移 bundle |
| `migrate.ts` | 执行数据库迁移；只针对明确指定且已备份的目标数据库运行 |
| `verify-frontend-release.mjs` | 只读检查登录保护、PCB v0.2 页面及其实际引用的绘图代码、Demo 文案和五个 GIF 哈希 |
| `generate-demo-gifs.mjs` | 早期 Demo 动图生成工具，保留用于追溯 |
| `prepare-live-demo-gifs.mjs` | 产品实录 GIF 处理工具 |
| `prepare-pcb-reference-gif.mjs` | PCB 参考素材动图处理工具 |
| `prepare-showcase-media.mjs` | 展示媒体转换与准备工具 |

发布检查示例（在服务器执行）：

```bash
node --env-file=/etc/vibehard/platform.env \
  /opt/vibehard/releases/20260916-pcb-restore/verify-frontend-release.mjs \
  https://ldcx.tech /opt/vibehard/releases/20260916-pcb-restore/standalone
```

检查脚本通过环境读取 `SESSION_SECRET`，只为虚构用户签发短时页面渲染会话，不访问账户数据，不输出令牌。它验证页面和资源交付，不等于真实模型对话或 EDA 生成验收。

媒体脚本可能包含历史输入路径；使用前检查配置，避免覆盖用户提供的原始素材。不要为了整理目录重新生成已发布 GIF。
