import { Adb, AdbDaemonTransport } from "@yume-chan/adb";
import { AdbDaemonWebUsbDeviceManager } from "@yume-chan/adb-daemon-webusb";
import { collectProbe } from "./rv1126b-probe";

/** Browser-only transport. No native ADB, TCP bridge, model key or stored RSA key. */
export async function connectBrowserProbe() {
  const manager = AdbDaemonWebUsbDeviceManager.BROWSER;
  if (!globalThis.isSecureContext || !manager) throw new Error("WEBUSB_UNAVAILABLE");
  const device = await manager.requestDevice(); // Must run inside the user's click.
  if (!device) throw new Error("DEVICE_NOT_SELECTED");
  let adb: Adb | undefined;
  const close = () => {
    void adb?.close().catch(() => {});
    void device.raw.close().catch(() => {});
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  let expired = false;
  const deadline = new Promise<never>((_, reject) => { timer = setTimeout(() => { expired = true; close(); reject(new Error("CONNECT_TIMEOUT")); }, 15000); });
  try {
    const opening = (async () => {
      const connection = await device.connect();
      if (expired) { close(); throw new Error("CONNECT_TIMEOUT"); }
      // This first probe does not enroll new ADB credentials on the board.
      const transport = await AdbDaemonTransport.authenticate({
        serial: device.serial, connection, readTimeLimit: 15000,
        credentialStore: { iterateKeys: () => [], generateKey: () => { throw new Error("DEVICE_AUTH_REQUIRED"); } },
      });
      adb = new Adb(transport);
      if (expired) { close(); throw new Error("CONNECT_TIMEOUT"); }
      return adb;
    })();
    const connected = await Promise.race([opening, deadline]);
    let reading = false;
    return {
      serial: device.serial,
      usbName: device.name,
      close,
      disconnected: connected.disconnected,
      async read() {
        if (reading) throw new Error("PROBE_BUSY");
        reading = true;
        const nonce = Array.from(crypto.getRandomValues(new Uint8Array(8)), value => value.toString(16).padStart(2, "0")).join("");
        try {
          return await collectProbe(async command => {
            const socket = await connected.createSocket(`shell:${command}`);
            return {
              readable: { getReader: () => {
                const reader = socket.readable.getReader();
                return { read: async () => reader.read(), cancel: async () => reader.cancel(), releaseLock: () => reader.releaseLock() };
              } },
              close: async () => { await socket.close(); },
            };
          }, { nonce });
        } catch (error) { close(); throw error; }
        finally { reading = false; }
      },
    };
  } catch (error) { close(); throw error; }
  finally { clearTimeout(timer); }
}

export function probeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (error instanceof DOMException && error.name === "NotFoundError" || message === "DEVICE_NOT_SELECTED") return "未选择设备。点击连接后，在浏览器弹窗中选择板子。";
  if (message.includes("busy") || message.includes("claim") || message.includes("in use")) return "USB 正被其他程序占用。关闭设备工具或本机 ADB 连接后重试；网页不会自动停止它们。";
  const messages: Record<string, string> = {
    WEBUSB_UNAVAILABLE: "当前浏览器或页面环境不支持 WebUSB。请使用桌面 Chrome/Edge，并通过 HTTPS 或 localhost 打开。",
    CONNECT_TIMEOUT: "USB 握手超时，已释放连接。请检查设备和占用情况后手动重试。",
    DEVICE_AUTH_REQUIRED: "板子要求 ADB 认证。本只读验证页不会添加可信密钥，请先确认板端认证方案。",
    WRONG_BOARD: "设备树不是 RV1126B，未将 USB 显示名称当作真实板型。",
    INVALID_REPORT: "读取结果不完整或格式异常，没有生成成功报告。",
    PROBE_TIMEOUT: "设备读取超过 15 秒，已关闭连接；请检查 USB 后手动重试。",
    OUTPUT_LIMIT: "设备返回超过 64 KiB，已停止采集。",
  };
  return messages[message] ?? "设备连接失败或已断开，请检查 USB 并重新连接。";
}
