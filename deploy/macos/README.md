# macOS 设备 Runner

设备 Runner 用于连接现场“小电脑”的 USB、串口、下载器及厂商工具。它和云端 Runner 是两个节点：新建项目时选择“USB 设备”节点，任务才会在连接数据线的 Mac mini 上执行。

安装器固定使用 Codex CLI 0.149.1，并创建 `tech.ldcx.vibehard-device-runner` LaunchAgent。密钥保存在 `~/Library/Application Support/VibeHardRunner/runner.env`，权限为 600，不写入 plist、Git 或日志。工程位于仓库的 `.runner-workspaces`，已经被 Git 忽略。

本地节点声明 `usb-device`、`serial` 和 `flash` 能力，但能力声明不代表已经支持具体产品。演示前仍需提供产品基础工程、工具链、设备识别方式、构建命令、烧录命令、日志端口及恢复固件，并逐项实机验证。

macOS 外层沙箱会隔离不同 Runner 项目目录，Codex 工具操作仍为只读和按需审批。由于 USB 工具必须访问系统设备，本地节点不是面向不可信公众任务的强隔离执行环境，只用于受控演示项目。
