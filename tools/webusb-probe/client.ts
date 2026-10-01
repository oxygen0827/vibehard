import { connectBrowserProbe, probeErrorMessage } from "../../lib/device/webusb-probe";

const element = (id: string) => document.getElementById(id)!;
const button = (id: string) => element(id) as HTMLButtonElement;
let session: Awaited<ReturnType<typeof connectBrowserProbe>> | undefined;
let busy = false;
let count = 0;
const support = globalThis.isSecureContext && "usb" in navigator;
element("support").textContent = support ? "WebUSB 可用 · 本机浏览器直连 · 不使用 ADB TCP 桥接" : "当前环境不支持。请使用桌面 Chrome/Edge 和 HTTPS/localhost。";
button("connect").disabled = !support;

function controls() {
  button("connect").disabled = !support || busy || Boolean(session);
  button("read").disabled = busy || !session;
  button("disconnect").disabled = !session;
}
async function read() {
  const current = session;
  if (!current || busy) return;
  busy = true; controls(); element("error").textContent = "";
  element("status").textContent = "正在读取设备树与状态…";
  const started = performance.now();
  try {
    const report = await current.read();
    if (session !== current) return;
    count++;
    const elapsedMs = Math.round(performance.now() - started);
    element("status").textContent = `已验证 RV1126B · 读取成功 ${count} 次 · 本次 ${elapsedMs} ms`;
    element("result").textContent = `${report.model} / ${report.os} / ${report.kernel}；可用内存 ${(report.memoryAvailableKiB / 1024).toFixed(1)} MiB。根分区剩余 ${(report.storage[0].availableKiB / 1024).toFixed(1)} MiB，userdata 剩余 ${(report.storage[1].availableKiB / 1024).toFixed(1)} MiB；API ${report.services.api} / Kiosk ${report.services.kiosk}。`;
    const detail = document.createElement("details");
    const summary = document.createElement("summary"); summary.textContent = `第 ${count} 次真实读取 · ${elapsedMs} ms · ${new Date().toLocaleTimeString()}`;
    const pre = document.createElement("pre"); pre.textContent = JSON.stringify({ transport: "browser-webusb-direct", serial: current.serial, capturedAt: new Date().toISOString(), elapsedMs, ...report }, null, 2);
    detail.append(summary, pre); element("history").prepend(detail);
    while (element("history").children.length > 3) element("history").lastElementChild?.remove();
    detail.open = true;
  } catch (error) {
    if (session === current) { current.close(); session = undefined; element("status").textContent = "读取失败，连接已关闭"; element("error").textContent = probeErrorMessage(error); }
  } finally { busy = false; controls(); }
}

button("connect").onclick = async () => {
  if (busy || session) return;
  busy = true; controls(); element("error").textContent = "";
  element("status").textContent = "请选择 USB 设备，正在等待浏览器授权…";
  try {
    const connected = await connectBrowserProbe();
    session = connected;
    void connected.disconnected.then(() => {
      if (session === connected) { session = undefined; element("status").textContent = "USB 已断开，请重新连接"; controls(); }
    }).catch(() => {
      if (session === connected) { session = undefined; element("status").textContent = "USB 连接异常，请重新连接"; controls(); }
    });
    busy = false;
    await read();
  } catch (error) { element("status").textContent = "连接未完成"; element("error").textContent = probeErrorMessage(error); }
  finally { busy = false; controls(); }
};
button("read").onclick = read;
button("disconnect").onclick = () => { session?.close(); session = undefined; element("status").textContent = "已主动断开"; controls(); };
addEventListener("pagehide", () => session?.close());
