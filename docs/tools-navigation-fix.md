# 工具分类导航修复

任务确认：用户于 2026-10-02 反馈工具页左侧分类点击无响应并授权修复；沿用本会话既有上线与 GitHub 修复交付授权。

基线：实际正式版本 `20261002-tools-embedding-v1`，完整保留其源码、嵌入保护及 PCB/Demo。继续在已授权的 `codex/tools-iframe-fix` / PR #45 交付。

允许运行时修改：`app/app/tools/page.tsx` 的 URL 分类筛选、`lib/zutils-tools.ts` 的缓存版本、`public/zutils/platform-navigation.js` 与 39 个工具静态 HTML 的导航脚本引用。只修复嵌入页 `aside` 内的分类链接，目标限定同站点平台工具箱；旧“AI 助手”无独立工具分类，接平台已有 `/app/agent`；嵌入页面退出 iframe，在独立窗口时直接打开分类。计算代码、设备操作、认证、数据库、模型和其他服务不变。

验证计划：全分类链接、旧 `#category`/客户端 `/#category`、键盘/鼠标/动态重建侧栏；URL 分类刷新与返回；真实浏览器 iframe 分类点击、独立窗口导航及工具选择/计算；候选及正式全部 42 入口/静态资源、PCB/Demo 回归。仅平台服务切换，保留旧单元回滚。

最新基线补充：准备发布期间正式版并行切换为 `20261002-kev-agent-v1`。v1 候选被版本门禁阻止，从未启动或激活。改为完整核验最新 1236 文件清单，在隔离目录叠加仅导航相关文件，生成 `20261002-tools-navigation-v2`；保留 Kev 平台源码、现用 Runner、环境配置与凭据。Git 评审仍在 PR #45，不把并行 Kev 代码混入导航 diff。

本地验证：479 项常规回归通过、30 跳过，类型、构建、lint 通过；Chromium 实际点击全部 10 个侧栏入口，各工具分类刷新/返回、独立窗口导航、选择 LED 工具及 12V→500Ω 计算均通过。此前 PR 的 CI PDF 不完整产物由已有发布物化步骤补齐，像素门禁保留；PR 检查已通过。

## 2026-10-02 17:29 工具左侧分类导航修复已上线

- 正式平台为 `/opt/vibehard/releases/20261002-tools-navigation-v2/standalone`，PID `1138751`，active、NRestarts=0。基于实际最新 `20261002-kev-agent-v1` 的全部 1236 源码文件叠加导航；完整发布清单 1244 文件，42 项运行时变更，保留 Kev、PCB/Demo 与现用后端。旧基线 v1 被版本门禁拒绝、从未激活。
- 原工具侧栏指向无目标的 `#category` / `/#category`。39 个静态工具加本地链接桥接，分类跳转顶层平台目录、URL 筛选支持刷新和返回；AI 助手接现有 Agent。缓存版本改为 `nav-v1`，工具算法不变。交付仍在 [PR #45](https://github.com/oxygen0827/vibehard/pull/45)，运行源码 overlay `4be21fb`，代码 CI 已通过、未合并。
- 最新 Kev 基线构建/类型通过，488 项回归通过、30 条件跳过；其中端口测试初遇本轮浏览器本地服务占用3217，停止本轮服务后单项重跑通过。本机 Chromium 原生点击全部10入口、分类数量/刷新/返回、独立窗口和 LED 12V→500Ω 通过；公网原生点击全部10入口及独立窗口正确请求顶层分类/Agent路径，匿名用户按现有规则转登录。未使用生产账号验证分类内容。
- 切换前针对实际 Kev 正式包、候选、正式回环/公网 PCB 详细 renderer、Demo 18脚本样式/5GIF、BOM/认证边界、42工具页/57资源哈希通过，Linux PDF 实际像素渲染通过。仅平台重启，Runner/Gateway/worker/检索/EDA/VibeBoard/nginx PID与配置哈希保持；切换后 cloud/device 心跳12/14秒，Gateway连接2，候选停止。
- 发布包 SHA256 `70be6bb07e5c79e9d66d508ec788ad36e54c7081d01f75adce5957b67854fad0`；旧平台 unit 在新release的 `backup/vibehard.service`。确认无活动任务后，用新release的 `source/scripts/deploy-tools-navigation.mjs rollback`（现用平台env与bundled Node）仅恢复 Kev 平台单元，不回滚DB或Runner。没有迁移、生产数据写入、模型调用或设备操作。细节见 [工具分类导航修复](tools-navigation-fix.md)。

验证证据：本轮临时目录 `navigation-local-browser.json`、`navigation-public-browser.json` 与正式 release 的 `ACTIVATED.json`；候选 preflight 位于 release 的 `evidence/preflight.json`。生产源码清单固定在发布时的 4be21fb overlay；后续文档提交不改变已发布产物。
