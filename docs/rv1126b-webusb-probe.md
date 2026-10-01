# RV1126B 浏览器免安装 USB 验证

更新：2026-10-01。独立分支 `codex/rv1126b-webusb`，基线 `d88ac86`。本地真实只读验证已通过，尚未提交/推送/上线或接入项目归档。

## 本轮确认范围

- 用户同意先在本机 Chrome 验证浏览器直接通过 USB 读取已连接的 RV1126B，成功后再推进项目归档和应用部署。
- Allowed Files：`lib/device/{rv1126b-probe,webusb-probe}.ts`、`tools/webusb-probe/{index.html,client.ts}`、`scripts/webusb-probe-server.mjs`、`__tests__/rv1126b-webusb-probe.test.ts`、两份依赖清单与本文/状态日志。
- 最小验证：固定只读命令、设备树身份、容量/服务状态、三次重复、主动断开/刷新重连、取消授权、设备占用、类型/lint/回归。
- 不修改 `/Volumes/ML/rv1126b-vibeboard` 中已验证代码，不改板端服务/系统/固件/驱动，不添加可信 ADB 密钥，不更改生产权限、数据库、Runner/Gateway 协议或凭据。

## 实际架构

网页中的 `@yume-chan/adb@2.6.4` 与 `@yume-chan/adb-daemon-webusb@2.3.2` 通过 WebUSB 直接访问板子的已有 adbd。不是访问本机 ADB server，也不是 WebSocket/TCP 桥接。本机无需为这条通道运行 Node/Python/ADB/Codex。

开发预览命令：

```sh
node scripts/webusb-probe-server.mjs
```

地址 `http://127.0.0.1:3214/`。开发用 Node 服务只发送静态 HTML/浏览器 bundle，没有原生 USB/ADB 调用、数据库或上传接口；正式集成后由平台网站发送同一浏览器模块，用户无需启动该开发服务。minify 后 bundle 为 65,627 字节，本轮未将其大小当成浏览器内存占用或性能保证。

只读模块只允许固定 shell 命令读取：设备树 model/compatible、内核、OS 名称、内存、uptime、根与 userdata 磁盘、两个既有 VibeBoard 服务状态。命令不含用户/模型提供的片段，随机 nonce 只允许 16 位小写十六进制。

连接与采集分别限定 15 秒；采集最多 64 KiB。成功必须含完整 framing、精确 `rockchip,rv1126b` 兼容项和有效数据。失败关闭通道，不自动重试。页面不存储 RSA 密钥或设备输出；仅保留当前页面最近三份结果。若板子要求新 ADB 认证，停止并明确提示，不自动添加授权。

## 2026-10-01 真实设备结果

- 浏览器：本机 Google Chrome 原生 WebUSB；序列号 `a5ccf098e8d689c4`。
- USB 选择器显示 `rk3xxx`，原生 ADB 产品描述显示 Nexus 4；两者均不当作板型。读取设备树为 Luckfox Aura，兼容 `rockchip,rv1126b-evb1-v11`、`rockchip,rv1126b`。
- 初版连续三次真实读取耗时 148、168、147 ms；主动断开与刷新后，最终代码再次握手/读取成功，耗时 146 ms（10:50:37，北京时间）。均为点击后读取阶段时间，不含设备选择与握手。
- 最终代码读取：Linux 6.1.141 aarch64，Debian GNU/Linux 13；内存总量 1,010,588 KiB，可用 756,816 KiB；根分区约剩 447.6 MiB，userdata 约剩 930.1 MiB；API/Kiosk 均 active。仅代表测试时刻。
- 首次连接真实遇到 ADB 独占接口，页面显示“USB 正被其他程序占用”，未生成成功结果。先核对本机仅这一台设备，再临时 `adb kill-server` 释放 USB；没有停板端应用或连接器/Runner 服务。测试收尾断开浏览器 USB 后恢复 ADB。
- Chrome 取消选择器后显示未选择设备；可以再次连接。刷新不沿用已连接/已验证状态。主动断开使读取按钮禁用；历史结果仅表示已完成的那次采集。

## 软件验证

- 使用 tdd 红→绿逐项实现身份解析、错误板型拒绝、不完整数据拒绝、实际字节流读取、总超时；新增 7 项测试通过，涵盖输出上限、断线错误和命令 nonce 注入拒绝。
- TypeScript、定向 ESLint、浏览器 esbuild 打包通过。
- 完整回归：87 测试文件通过，437 测试通过，23 个条件用例跳过（数据库等未配置，本轮未重新做 PostgreSQL 验收）。
- 初次完整回归因沙箱禁止 TCP/Unix listener 出现 EPERM，导致既有 Gateway/检索 6 项超时；在允许临时回环监听的环境完整重跑通过，没有扩大业务超时或跳过失败。
- 静态页面只接受 GET，POST 为 404，错误 Host 为 403；绑定 127.0.0.1。CSP `connect-src 'none'`、`frame-ancestors 'none'`，无外部脚本，Permissions-Policy `usb=(self)`。未发送设备正文至云端。

## 未完成与下一阶段

1. 尚未选项目、做服务端归属校验、保存体检文档或让云端 Agent 实读报告；本页不是生产设备模块。
2. 集成应把有限结构报告归档到所属项目，保留来源/时间/hash及“浏览器上报”性质。客户端结果可伪造，不能当作服务端可信设备身份凭据，不能仅凭序列号授予设备执行权限。
3. 云端 Agent 使用受控动作、用户审批与有版本/hash的产物；网页只执行被授权的设备操作，不暴露任意电脑 shell。纯浏览器不能替代本机编译器，应优先云端构建。
4. 已安装旧 ADB 工具的电脑需释放独占接口才能浏览器直连，不能同时独占同一接口。不能网页自动停止用户的其它工具。
5. 仅这台 Mac/Chrome/该板验证成功。Windows 的 WinUSB、Linux USB 权限、Safari/Firefox、不支持环境的备用连接器、物理拔线/休眠/长期压力仍需验收。
6. 不将主动断开或模拟流错误称为真实拔线测试；不把状态读取称为应用部署、系统固件刷机或外设功能验收。

参考官方说明：[Tango USB 连接](https://tangoadb.dev/tango/daemon/usb/create-connection/)、[认证握手](https://tangoadb.dev/tango/daemon/connect-device/)、[Chrome WebUSB 平台边界](https://developer.chrome.com/docs/capabilities/build-for-webusb)。
