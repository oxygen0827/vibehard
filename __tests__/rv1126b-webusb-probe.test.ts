import { describe, expect, it, vi } from "vitest";
import { collectProbe, parseProbe, probeCommand } from "../lib/device/rv1126b-probe";

const nonce = "1234567890abcdef";
const sample = `__VH_${nonce}_BEGIN__
__VH_FIELD_kernel__
Linux 6.1.141 aarch64
__VH_FIELD_model__
Luckfox Aura
__VH_FIELD_compatible__
rockchip,rv1126b-evb1-v11
rockchip,rv1126b
__VH_FIELD_os__
Debian GNU/Linux 13 (trixie)
__VH_FIELD_memory__
MemTotal: 1010588 kB
MemAvailable: 773308 kB
__VH_FIELD_uptime__
345.67 123.45
__VH_FIELD_storage__
Filesystem 1024-blocks Used Available Capacity Mounted on
/dev/root 4365108 3691248 460456 89% /
/dev/mmcblk0p5 998060 18292 952448 2% /userdata
__VH_FIELD_services__
active
active
__VH_${nonce}_END__
`;

describe("RV1126B browser read-only probe", () => {
  it("returns a verified board identity and real bounded system readings", () => {
    const result = parseProbe(sample.replaceAll("\n", "\r\n"), nonce);
    expect(result).toMatchObject({ model: "Luckfox Aura", compatible: ["rockchip,rv1126b-evb1-v11", "rockchip,rv1126b"], memoryAvailableKiB: 773308, uptimeSeconds: 345.67, services: { api: "active", kiosk: "active" } });
    expect(result.storage).toEqual([{ mount: "/", availableKiB: 460456, usedPercent: 89 }, { mount: "/userdata", availableKiB: 952448, usedPercent: 2 }]);
    expect(probeCommand(nonce)).toContain(`/proc/device-tree/compatible`);
  });
  it("refuses another board even when the USB label looks correct", () => {
    expect(() => parseProbe(sample.replaceAll("rv1126b", "rv1126"), nonce)).toThrow("WRONG_BOARD");
  });
  it("never treats truncated or malformed measurements as a successful report", () => {
    for (const output of [sample.replace(`__VH_${nonce}_END__`, ""), sample.replace("MemAvailable: 773308", "MemAvailable: broken"), sample.replace("460456 89%", "broken 89%"), sample.replace("__VH_FIELD_uptime__", "__VH_FIELD_unknown__")]) {
      expect(() => parseProbe(output, nonce)).toThrow("INVALID_REPORT");
    }
  });
  it("collects a real stream of byte chunks, including split UTF-8 and CRLF", async () => {
    const bytes = new TextEncoder().encode(sample);
    let sent = "";
    const report = await collectProbe(async command => {
      sent = command;
      return { readable: new ReadableStream<Uint8Array>({ start(controller) { for (const byte of bytes) controller.enqueue(new Uint8Array([byte])); controller.close(); } }), close: async () => {} };
    }, { nonce });
    expect(report.model).toBe("Luckfox Aura");
    expect(sent).toBe(probeCommand(nonce));
  });
  it("closes a stalled USB read at its deadline instead of spinning forever", async () => {
    vi.useFakeTimers();
    let closed = false;
    const result = collectProbe(async () => ({ readable: new ReadableStream<Uint8Array>(), close: async () => { closed = true; } }), { nonce, timeoutMs: 100 });
    const assertion = expect(result).rejects.toThrow("PROBE_TIMEOUT");
    try { await vi.advanceTimersByTimeAsync(101); await assertion; expect(closed).toBe(true); }
    finally { vi.useRealTimers(); }
  }, 1000);
  it("limits incoming bytes and reports USB disconnection without a fake result", async () => {
    for (const stream of [new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new Uint8Array(65537)); } }), new ReadableStream<Uint8Array>({ start(c) { c.error(new Error("DEVICE_DISCONNECTED")); } })]) {
      let closed = false;
      await expect(collectProbe(async () => ({ readable: stream, close: async () => { closed = true; } }), { nonce })).rejects.toThrow();
      expect(closed).toBe(true);
    }
  });
  it("rejects a shell fragment in the framing nonce", () => {
    expect(() => probeCommand("'; reboot #")).toThrow("INVALID_NONCE");
  });
});
