"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { apiPath } from "@/lib/utils";
import { deviceReportSchema, type DeviceReport } from "@/lib/device/device-report";
import { connectBrowserProbe, probeErrorMessage } from "@/lib/device/webusb-probe";

const subscribe = () => () => {};
export function BrowserDevicePanel({ projectId, onArchived, onSaved, onBusy, connect = connectBrowserProbe }: {
  projectId: string; onArchived: (path: string) => void; onBusy?: (busy: boolean) => void;
  onSaved?: () => void;
  connect?: typeof connectBrowserProbe;
}) {
  const supported = useSyncExternalStore(subscribe, () => !!globalThis.isSecureContext && "usb" in navigator, () => false);
  const session = useRef<Awaited<ReturnType<typeof connect>> | null>(null);
  const active = useRef(true);
  const upload = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [message, setMessage] = useState("尚未连接 USB。历史报告不代表设备当前在线。");
  const [error, setError] = useState("");
  const [report, setReport] = useState<DeviceReport | null>(null);
  const [savedPath, setSavedPath] = useState("");
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; upload.current?.abort(); session.current?.close(); session.current = null; onBusy?.(false); };
  }, [onBusy]);
  const markBusy = (value: boolean) => { if (active.current) { setBusy(value); onBusy?.(value); } };
  async function archive(value: DeviceReport) {
    const controller = new AbortController(); upload.current = controller;
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(apiPath(`/api/projects/${projectId}/device-reports`), {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value), signal: controller.signal,
      });
      const body = await response.json();
      if (!response.ok || typeof body.document?.path !== "string") throw new Error(body.error || "诊断报告未归档，请重试归档，不会重新读取或调用模型。");
      if (active.current) { setSavedPath(body.document.path); setMessage("报告已归档到当前项目；下次 Agent 任务前校验并同步。尚未调用模型。"); onSaved?.(); }
    } catch (cause) {
      if (active.current) { setMessage("读取已完成，但报告归档失败；Agent 暂时不能读取本次结果。"); setError(cause instanceof Error && cause.name !== "AbortError" ? cause.message : "归档请求中断或超时。可用同一采集编号重试归档，不自动重复采集。"); }
    } finally { clearTimeout(timer); upload.current = null; }
  }
  async function read(connection: Awaited<ReturnType<typeof connect>>) {
    setMessage("正在读取设备状态…");
    const start = performance.now();
    const probe = await connection.read();
    if (!active.current || connection !== session.current) return;
    const value = deviceReportSchema.parse({ id: crypto.randomUUID(), transport: "browser-webusb-direct", serial: connection.serial,
      capturedAt: new Date().toISOString(), elapsedMs: Math.round(performance.now() - start), probe });
    setReport(value); setSavedPath(""); setMessage("读取成功，正在归档到当前项目…");
    await archive(value);
  }
  async function capture() {
    if (busy || !projectId) return;
    markBusy(true); setError("");
    try {
      let connection = session.current;
      if (!connection) {
        setMessage("请在浏览器 USB 弹窗中选择板子…");
        connection = await connect();
        if (!active.current) { connection.close(); return; }
        session.current = connection; setConnected(true);
        const captured = connection;
        const disconnected = () => {
          if (active.current && session.current === captured) { session.current = null; setConnected(false); setMessage("USB 已断开；已归档的报告只是历史采集。"); }
        };
        void connection.disconnected.then(disconnected, disconnected);
      }
      await read(connection);
    } catch (cause) { if (active.current) { setMessage("本次采集未完成，未归档新报告。"); setError(probeErrorMessage(cause)); session.current?.close(); session.current = null; setConnected(false); } }
    finally { markBusy(false); }
  }
  function disconnect() { session.current?.close(); session.current = null; setConnected(false); setMessage("已主动断开 USB；报告归档不代表设备当前在线。"); }
  return <section aria-label="浏览器 USB 设备" className="space-y-3 rounded-xl border bg-card p-4">
    <h3 className="font-semibold">USB 设备 · RV1126B</h3>
    <p className="text-sm text-muted-foreground">使用本机桌面 Chrome/Edge＋USB，无需安装连接器或本地 Agent。只读采集设备树、系统、容量与已有服务状态，随后保存到当前项目。</p>
    {!supported && <p className="text-sm text-amber-600">当前环境不支持 WebUSB，请使用桌面 Chrome/Edge，通过 HTTPS 或 localhost 打开。</p>}
    <div className="flex flex-wrap gap-2">
      <Button disabled={!supported || !projectId || busy} onClick={() => void capture()}>{busy ? "读取 / 归档中…" : connected ? "再次读取并归档" : "USB 连接并归档只读报告"}</Button>
      <Button variant="outline" disabled={!connected || busy} onClick={disconnect}>断开 USB</Button>
      {report && !savedPath && <Button variant="outline" disabled={busy} onClick={async () => { markBusy(true); setError(""); try { await archive(report); } finally { markBusy(false); } }}>重试归档</Button>}
    </div>
    <p role="status" className="text-sm">{message}</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {report && <p className="text-xs text-muted-foreground">{report.probe.model} · {report.probe.os} · 可用内存 {(report.probe.memoryAvailableKiB / 1024).toFixed(1)} MiB · 采集于 {new Date(report.capturedAt).toLocaleString("zh-CN")}</p>}
    {savedPath && <div className="space-y-2"><p className="break-all font-mono text-xs text-muted-foreground">{savedPath}</p><Button variant="outline" onClick={() => onArchived(savedPath)}>让 Agent 分析这份设备报告</Button></div>}
    <p className="text-xs text-muted-foreground">浏览器上报可被伪造，不是可信身份凭据；仅是历史状态参考。不会烧录、部署、复位、安装密钥或自动停止本机 ADB。Agent 分析需打开会话后手动发送。</p>
  </section>;
}
