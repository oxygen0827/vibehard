# 仪表内层404修复

用户于2026-10-02明确要求修复示波器、万用表、波形发生器并上线；沿用本会话GitHub推送/PR授权。

实际基线 `20261002-tools-navigation-v2`，只允许运行时修改三个仪表静态HTML、它们专用的新客户端入口chunk和 `lib/zutils-tools.ts` 仪表缓存版本。完整保留正式源清单、Kev与PCB/Demo；复用受保护的前端版本发布流程，仅切平台。发布脚本可作本轮release/白名单调整，认证、DB、Runner和配置不改。

复现：三个仪表初始HTML及hydration客户端入口都写死 `/labs/...`，公网全部404；现有 `/vibehard/zutils/labs/...` 三页均200。改为相对 `../../labs/...`，兼容根路径和平台前缀。新客户端资源使用新内容哈希文件名，避免旧缓存。原算法不变。

回归必须读取内层iframe地址并核验lab及图片哈希，浏览器在嵌入/独立窗口加载到真实控件，操作示波器Run/Stop、万用表HOLD、发生器电源及全屏/刷新后内容保持。先失败后修复，不以外层200视作成功。

## 2026-10-02 19:44 三个仪表内层404修复已上线

- 示波器、万用表、波形发生器的外壳原本200，但内层iframe及客户端写死 `/labs/...`，公网返回nginx404。初始HTML/内嵌Flight与客户端3处路径改为 `../../labs/...`，正确解析到 `/vibehard/zutils/labs/...`；三个仪表缓存改 `instrument-v1`，专用入口使用新内容哈希文件名 `page-6293045f032a15ac.js`，其余36工具仍用原入口。回归确认客户端反向还原路径后与原文件逐字相同，计算代码未改。
- 正式平台现为 `/opt/vibehard/releases/20261002-tools-instruments-v1/standalone`，PID `1144177`、active、NRestarts=0。完整保留上一正式导航版1244文件，新清单1252文件，6项运行时变更。基线/候选/正式回环与公网 PCB详细renderer、Demo18资源/5GIF、BOM/认证、42工具页及3内层仪表/60资源哈希通过；Linux PDF实际像素通过。
- 新增3项回归先失败后修复；定向19项、最新正式源码全量491项通过/30条件跳过，lint、类型、Next构建通过，修复提交 `564719e` 的GitHub CI通过。本机静态夹具、实际候选、正式公网Chromium均验证三个仪表：原生Run/Stop（运行→停止）、HOLD（false→true）、发生器电源（on→off）；嵌入/独立窗口、图片加载、全屏hydration与刷新通过。嵌入使用匿名同源双层iframe夹具，未使用生产用户凭据或验收实体设备。
- 仅切平台服务，Runner/Gateway/worker/检索/EDA/VibeBoard/nginx PID与环境/模型/配置哈希保持；cloud/device心跳15/10秒，Gateway连接2；候选3217停止，验收隧道关闭。无DB迁移/生产数据写入/模型调用/设备操作。当前Runner仍为Kev版本，原分类导航保持。
- 发布归档SHA256 `457c424fb5f242f3803cdaad57f2fbf6219104269d847dd5a7651e427535b6ad`，旧平台unit保存在新release的 `backup/vibehard.service`；确认任务空闲，用现有平台env和bundled Node运行新release的 `source/scripts/deploy-tools-instruments.mjs rollback`，仅回到导航v2，不还原DB/Runner。运行源overlay `564719e`，后续记录提交不改变产物。修复已更新 [PR #45](https://github.com/oxygen0827/vibehard/pull/45)，未合并；详见 [仪表修复记录](tools-instruments-fix.md)。

浏览器证据保存在本轮临时目录 `instruments-local-browser.json`、`instruments-candidate-browser.json`、`instruments-public-browser.json`；正式release记录 `ACTIVATED.json`、`evidence/preflight.json`。本轮回环服务已停止。
