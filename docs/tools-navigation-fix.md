# 工具分类导航修复

任务确认：用户于 2026-10-02 反馈工具页左侧分类点击无响应并授权修复；沿用本会话既有上线与 GitHub 修复交付授权。

基线：实际正式版本 `20261002-tools-embedding-v1`，完整保留其源码、嵌入保护及 PCB/Demo。继续在已授权的 `codex/tools-iframe-fix` / PR #45 交付。

允许运行时修改：`app/app/tools/page.tsx` 的 URL 分类筛选、`lib/zutils-tools.ts` 的缓存版本、`public/zutils/platform-navigation.js` 与 39 个工具静态 HTML 的导航脚本引用。只修复嵌入页 `aside` 内的分类链接，目标限定同站点平台工具箱；旧“AI 助手”无独立工具分类，接平台已有 `/app/agent`；嵌入页面退出 iframe，在独立窗口时直接打开分类。计算代码、设备操作、认证、数据库、模型和其他服务不变。

验证计划：全分类链接、旧 `#category`/客户端 `/#category`、键盘/鼠标/动态重建侧栏；URL 分类刷新与返回；真实浏览器 iframe 分类点击、独立窗口导航及工具选择/计算；候选及正式全部 42 入口/静态资源、PCB/Demo 回归。仅平台服务切换，保留旧单元回滚。
