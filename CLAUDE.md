# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

This is **VibeHard AI**，一个面向智能硬件研发的 Agent 工具平台前端项目。第一阶段目标是复刻 `https://www.hellozhi.com/` 的落地页视觉与结构，后续会逐步接入提示词模板库、原理图识别、硬件方案生成、芯片资料解析以及 MCP Server/嵌入式工具链能力。

- **框架**：Next.js 16 + App Router + React 19 + TypeScript
- **样式**：Tailwind CSS 4
- **UI 组件**：shadcn/ui（`@base-ui/react` 风格）
- **图标**：lucide-react
- **主题**：next-themes（深色/亮色切换，默认深色）
- **包管理器**：pnpm

## Common commands

```bash
# 安装依赖
pnpm install

# 本地开发服务器（默认 http://localhost:3000）
pnpm dev

# 生产构建
pnpm build

# 启动生产服务
pnpm start

# 代码检查
pnpm lint

# 运行测试（一次性）
pnpm test

# 交互式测试监听模式
pnpm test:watch
```

> 测试基于 **Vitest** + `@testing-library/react` + `jsdom`。配置见 `vitest.config.ts`，全局 mock 见 `vitest.setup.ts`。示例测试在 `__tests__/theme-toggle.test.tsx`。

## Project structure

```
app/
  layout.tsx          # 根布局，注入 ThemeProvider、Geist 字体、全局 metadata
  page.tsx            # 首页，组装 Hero/Stats/Workflow/CTA/Footer
  globals.css         # Tailwind 入口 + shadcn CSS 变量 + VibeHard 背景装饰
  login/page.tsx      # 登录页（演示账号 demo@vibehard.ai / demo1234）
  register/page.tsx   # 邀请码注册页（演示邀请码 VIBE2026）
  app/                # 工作台（受 proxy.ts 会话守卫保护）
    layout.tsx        # 工作台共享布局：AppNav + AppSidebar
    page.tsx          # 工作台首页 DashboardGrid
    prompts/          # 提示词模板库
    schematic/        # 原理图识别
    design/           # 硬件方案生成（含原理图/电路图生成与 SVG 预览）
    datasheets/       # 芯片资料解析（全网检索 → AI Skills 分析 → 器件档案 JSON；兼容 PDF 上传）
    pcb/              # PCB 生成（布局布线流水线 + 2D 预览 + Gerber/下单/SMT）
    bom/              # 物料与 BOM（自动选型、库存、导出、立创下单/SMT）
    debug/            # AI 调试（连接开发板 → AI 逐项调试外设，终端流式输出，异常自动修复）
    embedded/         # 嵌入式开发（连接开发板、自然语言生成 LVGL APP、屏幕模拟器、烧录）
    tools/            # 实用工具箱（zutils 工具集目录页）
    tools/[slug]/     # 单个工具的 iframe 嵌入查看页
    mcp/              # MCP Server 列表
    mcp/[id]/         # MCP Server 详情
components/
  theme-provider.tsx  # next-themes 客户端包装
  theme-toggle.tsx    # 深色/亮色切换按钮
  footer.tsx          # 页脚
  home/               # 首页各区块组件
    home-nav.tsx
    hero-section.tsx
    stats-section.tsx
    workflow-section.tsx
    cta-section.tsx
  app/                # 工作台组件
    app-nav.tsx
    app-sidebar.tsx
    dashboard-grid.tsx
    page-header.tsx
  ui/                 # shadcn/ui 组件（button、input、textarea）
lib/
  utils.ts            # cn()
  auth.ts             # Mock 认证：Cookie 会话、login/register/logout
  zutils-tools.ts     # 实用工具箱目录数据（9 大分类、42 个工具/实验台的元信息）
proxy.ts              # Next.js Proxy（原 middleware）：/app 未登录重定向到 /login
public/
  vibehard-icon.svg   # Logo
  zutils/             # zutils.cn 工具集静态镜像（39 工具 + 3 仿真实验台，iframe 嵌入用）
skills/               # Agent 技能包（供原理图自动化等能力使用）
  easyeda-api-skill/            # 嘉立创 EDA 专业版 API 参考（format/references/guide）
  easyeda-enhanced-schematic-skill/  # 增强原理图生成技能
__tests__/            # 测试文件
  theme-toggle.test.tsx
  auth.test.ts
vitest.config.ts      # Vitest 配置
vitest.setup.ts       # 测试全局 mock
vitest-env.d.ts       # Vitest 类型声明
```

## Architecture notes

- **首页为纯静态页面**：`page.tsx` 组合多个 Server/Client 组件，无数据获取逻辑。
- **认证（当前为前端 Mock）**：`lib/auth.ts` 通过 `vibehard_session` Cookie 管理会话；`proxy.ts`（Next.js 16 的 Proxy 约定，取代 middleware.ts）拦截 `/app/:path*`，无会话时重定向到 `/login`。登录/注册成功后 `router.push("/app")` + `router.refresh()`；AppNav 的"退出"调用 `logout()` 清除 Cookie。演示账号 `demo@vibehard.ai / demo1234`，演示邀请码 `VIBE2026`。接入真实后端时只需替换 `lib/auth.ts` 中的实现。
- **MCP Server 数据**：列表与详情页共用 `app/app/mcp/page.tsx` 中导出的 `mcpServers` mock 数据；详情页通过 `use(params)` 解包动态路由参数。
- **实用工具箱（zutils 镜像）**：`public/zutils/` 是 zutils.cn 的静态镜像（原版为 Next.js 静态导出），以 iframe 方式嵌入 `/app/tools/[slug]`。已做两处适配：工具页 HTML 中的 `/_next/` 等绝对路径改写为 `../../` 相对路径；`public/zutils/_next/static/chunks/webpack-*.js` 中的 webpack publicPath 由 `r.p="/_next/"` 改为 `r.p="/zutils/_next/"`（动态 chunk 加载依赖它）。镜像内的导航链接已失效化（`href="#"`），外部链接保留。**更新镜像后需要重新执行这两处改写**。该目录为第三方资源，已在 `eslint.config.mjs` 中加入 ignore。
- **主题系统**：`layout.tsx` 通过 `ThemeProvider` 注入，`html` 带 `suppressHydrationWarning`。切换逻辑在 `theme-toggle.tsx`，通过 `useSyncExternalStore` 避免挂载闪烁。
- **样式约定**：颜色全部通过 CSS 变量（`--primary`、`--background`、`--card` 等）驱动，`globals.css` 中同时定义了深色/亮色两套变量。毛玻璃卡片、顶部辉光、网格背景也在 `globals.css` 中统一维护。
- **组件按钮**：shadcn 生成的 `Button` 基于 `@base-ui/react/button`，**不支持 `asChild`**。需要同时作为链接和按钮样式时，直接用 Next.js `Link` 并复刻按钮的 Tailwind class，不要包在 `Button` 里。
- **图标 Logo**：`public/vibehard-icon.svg` 是填充 `currentColor` 的 SVG，通过 `text-primary` 控制颜色；使用 Next.js `Image` 渲染并设置 `unoptimized`。

## Adding new pages

新增路由直接在 `app/` 下创建目录即可。如果页面需要主题背景装饰，可复用 `login/page.tsx` 中的 `pointer-events-none fixed inset-0` 背景结构。

## shadcn/ui components

```bash
# 添加新组件
pnpm dlx shadcn@latest add <component-name>
```

当前 registry 使用 `style: base-nova`。添加组件后检查它是否依赖尚未安装的包，必要时运行 `pnpm install`。

## Deployment notes

生产环境部署在 ldcx.tech 服务器（`root@47.102.197.71`）的子路径 **https://ldcx.tech/vibehard**：

- **运行方式**：Next.js standalone（`next.config.ts` 中 `output: "standalone"` + 条件 `basePath`，由 `NEXT_PUBLIC_BASE_PATH` 环境变量控制；本地开发不设置即为根路径）。服务器上以 systemd 服务 `vibehard.service` 运行，监听 `0.0.0.0:3210`；产物在 `/opt/vibehard/standalone`，源码副本在 `/opt/vibehard/src`。
- **反代**：nginx 运行在 docker 容器中，配置文件是宿主机 `/home/lincaigui/nginx/nginx.conf`（该配置还承载 Gitea 等其它服务，**只追加、不要改动其它 location**）。`/vibehard/` 反代到 `host.docker.internal:3210`；`/zutils/` 重写到 `/vibehard/zutils/`（工具镜像挂域名根路径，避免 basePath 破坏其内部绝对路径）。改配置后：`docker exec nginx nginx -t && docker exec nginx nginx -s reload`。
- **更新流程**（服务器在国内，构建期的 `next/font/google` 需要访问 Google Fonts，因此**在本地构建**再上传产物）：
  1. `NEXT_PUBLIC_BASE_PATH=/vibehard bash scripts/build-standalone.sh`（自动补齐 pnpm 布局下漏拷的 `@swc/helpers/esm`、剔除 sharp 原生二进制）
  2. `tar czf - -C .next/standalone . | ssh root@47.102.197.71 "tar xzf - -C /opt/vibehard/standalone"`（服务器未装 rsync，用 tar 管道）
  3. `ssh root@47.102.197.71 systemctl restart vibehard`
- 常用运维：`systemctl status vibehard` / `journalctl -u vibehard -f` 查看服务与日志。
