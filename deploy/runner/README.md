# 云端 Runner

执行器使用独立的 `vibehard-runner` 系统账号。每次 Codex 会话经 `codex-sandbox.sh` 启动，由 bubblewrap 隔离文件系统和进程；仅挂载当前项目、该项目的 Codex 会话目录、只读工具链及只读模型配置。

工具链固定为 Codex CLI 0.149.1（与仓库协议类型一致），包含 GCC、G++、Make、CMake、zip。没有安装目标 MCU 的厂商 SDK；初次验收使用原生 C 示例验证生成与编译链路，不宣称已产出可烧录固件。

## 服务器目录

| 路径 | 内容 |
| --- | --- |
| `/opt/vibehard/cloud-runner/` | Runner bundle 和隔离启动脚本，root 管理 |
| `/opt/vibehard/toolchain/` | 独立 Node 二进制与固定版本 Codex，只读挂载 |
| `/var/lib/vibehard-runner/workspaces/` | 按用户和项目分开的工作区 |
| `/var/lib/vibehard-runner/codex/` | 按项目分开的 Codex 会话状态，用户工程下载不包含此目录 |
| `/var/lib/vibehard-runner/credential.json` | Runner 凭据，不挂载到 Codex 沙箱 |
| `/etc/vibehard/runner.env` | Runner 服务配置，无平台数据库凭据 |
| `/etc/vibehard/model.env` | 独立云端模型 API Key，root-only，systemd 注入 |
| `/etc/vibehard/codex/config.toml` | provider、Base URL 和模型名，不保存 API Key |

复制 `runner.env.example` 后通过平台注册创建独立 Runner 凭据。不要复用已离线的 Mac Runner 身份，不要把平台数据库或会话签名密钥传入 Runner。

## 运行边界

- 服务限制 2 GB 内存、150% 单核 CPU 配额、128 个任务进程，单文件最大 256 MB。
- 首版最多执行一个模型任务；忙时新任务明确失败，可稍后重试。每个执行进程最长 15 分钟。
- 模型进程保留对 API 的网络访问；Codex 工具默认只读、关闭工具网络，并保留命令／文件写入审批。主机隔离不会因为用户允许一次工具操作而消失。
- 这是文件系统与进程隔离，不是虚拟机。尚未提供整个项目的磁盘配额及网络出口白名单；扩大到不可信公众用户前需要补齐这些限制。
- 网页“下载工程”只用于同服务器的云端 Runner。ZIP 上限 25 MB、扫描上限 2000 项；排除隐藏文件、依赖目录、软硬链接，并校验项目归属和打开文件的真实位置。
- `.env.cloud-runner` 是用户提供 API Key 的本地临时配置入口，被 `.gitignore` 排除；不会读取或迁移 Mac 上现有 Codex／CC Switch 私人凭据。

隔离自检（不发起模型请求）：

```bash
runuser -u vibehard-runner -- \
  /opt/vibehard/cloud-runner/codex-sandbox.sh \
  /var/lib/vibehard-runner/workspaces/verification/toolchain --self-test
```

真实验收必须从平台创建项目、发起任务、处理审批、接收完成事件，再下载工程并检查编译产物；自检通过和 Runner 心跳正常都不能代替真实模型验收。
