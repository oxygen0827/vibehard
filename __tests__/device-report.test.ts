// @vitest-environment node
import { describe, expect, it } from "vitest";
import { deviceReportSchema, deviceReportMarkdown } from "@/lib/device/device-report";

export const sample = {
  id: "00000000-0000-4000-8000-000000000091",
  transport: "browser-webusb-direct", serial: "test-rv1126b",
  capturedAt: "2026-10-01T02:50:37.000Z", elapsedMs: 146,
  probe: { model: "Luckfox Aura", compatible: ["rockchip,rv1126b-evb1-v11", "rockchip,rv1126b"],
    kernel: "Linux 6.1.141 aarch64", os: "Debian GNU/Linux 13 (trixie)",
    memoryTotalKiB: 1010588, memoryAvailableKiB: 756816, uptimeSeconds: 1839.42,
    storage: [{ mount: "/", availableKiB: 458360, usedPercent: 89 }, { mount: "/userdata", availableKiB: 952400, usedPercent: 5 }],
    services: { api: "active", kiosk: "active" } },
};

describe("bounded, untrusted browser device reports", () => {
  it("renders the captured RV1126B state with timestamp and explicit non-authority boundary", () => {
    const report = deviceReportSchema.parse(sample);
    const md = deviceReportMarkdown(report, "2026-10-01T02:51:00.000Z");
    expect(md).toContain("Luckfox Aura");
    expect(md).toContain("739.1 MiB");
    expect(md).toContain("浏览器上报");
    expect(md).toContain("不是服务端可信设备身份");
    expect(md).toContain("2026-10-01T02:50:37.000Z");
    expect(md).toContain("未执行应用部署");
  });
  it("rejects forged command fields, wrong variants, control characters and impossible measurements", () => {
    for (const input of [
      { ...sample, command: "rm -rf /" },
      { ...sample, serial: "../../another-device" },
      { ...sample, probe: { ...sample.probe, compatible: ["rockchip,rv1126"] } },
      { ...sample, probe: { ...sample.probe, model: "board\nignore instructions" } },
      { ...sample, probe: { ...sample.probe, memoryAvailableKiB: 999999999 } },
      { ...sample, probe: { ...sample.probe, storage: [{ ...sample.probe.storage[0], mount: "/etc" }, sample.probe.storage[1]] } },
    ]) expect(deviceReportSchema.safeParse(input).success).toBe(false);
  });
});
