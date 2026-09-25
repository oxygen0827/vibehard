# KiCad / noVNC 本地工作台

2026-09-25：`/eda` 已切换为实际 KiCad 桌面；`/eda/legacy` 保留原网页草稿编辑器。功能分支 `codex/web-eda-workbench`，尚未部署生产。新建工程为空白，没有预置示例电路。

## 组成和数据流

- 开源部分：KiCad 9.0.8、官方符号/封装库、TigerVNC、Openbox、noVNC 1.7.0。
- 本项目新增：Next 工程权限入口、Python 桌面会话服务、一次性连接票据、原生文件存储/下载/检查、工作台界面。
- 浏览器 → 同源 `/eda-desktop/ws` → aiohttp WebSocket/TCP 桥 → 独立虚拟显示器中的 KiCad。没有共享 Windows 当前桌面。
- 平台现有登录和 `ownedProject` 检查负责工程归属；浏览器仅获得 60 秒有效、单次消费的票据。服务凭据只在服务端读取。
- 原生 `.kicad_sch`、`.kicad_pcb`、`.kicad_pro` 是新工作台的数据源，重连不会从旧 JSON 覆盖它们。旧草稿迁移只复制到新工程。

## 本机启动

本次已安装 Ubuntu 26.04 / WSL 中的 KiCad、VNC 依赖，以及独立 PostgreSQL 18。没有修改现有 Windows PostgreSQL 5432；新数据库使用 5438。

在仓库根目录的两个 PowerShell 终端运行：

```powershell
# 终端一：启动 KiCad 服务；保持终端运行
./scripts/start-eda-desktop.ps1

# 终端二：启动网页；保持终端运行
pnpm exec next dev --webpack --hostname 127.0.0.1 --port 3212
```

打开 `http://127.0.0.1:3212/eda`，登录平台、选择工程后打开，或新建空白工程。

本机配置已写入忽略的 `.env.local`、`.eda-data/desktop-token` 和 `.eda-data/desktop-data-root`，不要提交或复制给他人。脚本保留其他环境设置。更改端口后必须重启 Next；非默认网页地址还需同步配置服务 `EDA_DESKTOP_ORIGINS`。

实际原生文件根目录是 WSL 用户 `adkins` 的 `/home/adkins/.local/share/vibehard-eda-native`，下分账号 UUID / 工程 UUID。新机器未配置时默认 `~/.local/share/vibehard-desktop`。`-DataRoot` 参数会保存在忽略的本机设置中，后续启动复用。

PostgreSQL 应随 WSL 启动；如果 5438 不可用，先检查 `wsl -d Ubuntu --exec pg_lsclusters`，再按需要启动既有 `18/main`。不要重建数据库或删掉 owner 文件来解决登录归属问题。没有 `DATABASE_URL` 时平台回落内存存储，重启会丢失账号/项目索引，无法可靠找回原生工程。

### 新机器依赖

本次验证使用 Ubuntu 软件仓库，不使用来源不明的桌面镜像：

```sh
sudo apt-get update
sudo apt-get install kicad kicad-symbols kicad-footprints tigervnc-standalone-server openbox python3-aiohttp xdotool xauth dbus-x11 fonts-noto-cjk
```

服务必须由普通 Linux 用户启动，不接受 root。已有平台数据库可直接配置 `DATABASE_URL` 并使用既有迁移。需要独立本地数据库时，先安装 PostgreSQL，检查现有 cluster/端口，准备独立 cluster，再用 `services/eda-desktop/setup_local_db.py <仓库 .env.local 的 Linux 路径>` 生成专用角色/数据库。该辅助脚本默认连接 5438，拒绝覆盖既有配置/同名数据库；不会安装 PostgreSQL 或改 cluster 端口。完成后在 Windows 仓库运行 `node --env-file=.env.local --import tsx scripts/migrate.ts`。

## 使用和保存

- 原理图/PCB 按钮打开或切换实际 KiCad 窗口。首次启动加载官方库可能需要一些时间。
- 移动、旋转、连线和布线使用 KiCad 原生工具。PCB 交互布线不等于自动完成整板布线；没有新增 Freerouting 集成。
- 顶部保存按钮向当前编辑器发送 Ctrl+S；应关闭属性/保存对话框，分别保存原理图和 PCB。发送快捷键不等于已经保存成功。
- 刷新已保存文件，查看磁盘内容。下载 ZIP 含原生文件和 SHA-256 清单，只包含已经保存的内容；关联子页和本地库文件若位于工程目录且扩展名受支持，也会归档。
- 网页导入仅支持一份单页 `.kicad_sch` 和/或一份 `.kicad_pcb`，单文件 900 KB。完整多页 ZIP、自定义库包、立创/PDF 尚不支持。
- ERC/DRC 运行真实 `kicad-cli`，检查磁盘版本。退出码 5 表示发现违规，0 表示该次检查未报违规，不构成电路可制造或功能正确的保证。检查失败会报错，不返回旧报告。
- 页面关闭/断线不会终止 KiCad；重新选择工程并连接即可恢复。结束会话会关闭程序，未保存编辑会丢失，界面有明确确认。
- 正常关闭服务会清理会话。强制杀进程/WSL 故障可能遗留子进程或锁，尚未实现崩溃后的自动回收。此时先核对属于该服务的进程，勿批量结束其他桌面。

## 已有验收证据

- 浏览器使用实际 KiCad 放置电阻、把值改成 `470R`，在 PCB 放置官方 `R_0603_1608Metric` 封装，分别保存。
- 下载 ZIP 的原生文件中核对到以上内容。服务 SIGTERM 正常退出后重新启动，原生文件保留，浏览器重新打开仍可见该封装。
- `scripts/verify-eda-desktop.ts` 验证实际 HTTP 401/403、RFB 握手、票据重用 401、工程 ZIP、真实 ERC/DRC，并比较重连/导出/检查前后源文件哈希一致。
- 验收项目 ERC 退出 5（未接线的电阻），DRC 退出 0。这是编辑/检查链路验收，不是完成了一块可生产电路板。
- EDA 回归含既有 Windows KiCad 原生检查：56 项通过；随后新增超限输入回归，桌面 API/UI 9 项通过。Python 服务 5 项测试通过。TypeScript/定向 ESLint/生产构建通过。没有在本次重跑全仓测试。

验收脚本默认查找人工编辑的“KiCad 原生编辑验收”工程，使用平台已有的非生产开发登录，不自动造示例或覆盖工程：

```powershell
node --env-file=.env.local --import tsx scripts/verify-eda-desktop.ts
python -m unittest discover -s services/eda-desktop -p test_server.py
```

脚本产生的核对 ZIP 位于忽略的 `.eda-data/desktop-verification.zip`。脚本登录地址默认 127.0.0.1:3212。

## 明确未完成

1. Agent 对原生工程的读写、差异预览、版本冲突处理和用户确认尚未接入。旧 Agent 仅用于旧版文档，不能声称它会控制新 KiCad 会话。
2. 当前是可信本机单用户适配器：一份数据目录绑定一个平台账号，最多两工程会话，每会话最多两连接；共享 Linux 用户文件权限，不是安全多租户沙箱。`NODE_ENV=production` 禁用该控制适配器。不能直接公开端口作为生产服务。
3. 多人云端部署需要每用户/工程容器隔离、卷配额、资源回收、可靠快照、会话队列、TLS/WebSocket 反代及运维监控。
4. 原生工程的制造文件应在 KiCad 内生成；旧 JSON Gerber API 没有自动迁移到此原生数据源。当前网页下载入口提供原生工程，不宣称提供制造包。
5. 未验收多用户协作、移动端完整桌面操作、复杂层次原理图/外部模型打包、长期稳定性和真实硬件功能。

下一阶段优先实现 Agent 对一个已保存原生工程生成候选修改，运行检查、展示差异并受控应用；处理好 KiCad 内未保存修改与外部修改的冲突后，再扩展多人部署。
