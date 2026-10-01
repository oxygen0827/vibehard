import type { DeviceReport } from "@/lib/device/device-report";
export const sample: DeviceReport = {
  id: "00000000-0000-4000-8000-000000000091",
  transport: "browser-webusb-direct" as const, serial: "test-rv1126b",
  capturedAt: "2026-10-01T02:50:37.000Z", elapsedMs: 146,
  probe: { model: "Luckfox Aura", compatible: ["rockchip,rv1126b-evb1-v11", "rockchip,rv1126b"],
    kernel: "Linux 6.1.141 aarch64", os: "Debian GNU/Linux 13 (trixie)",
    memoryTotalKiB: 1010588, memoryAvailableKiB: 756816, uptimeSeconds: 1839.42,
    storage: [{ mount: "/" as const, availableKiB: 458360, usedPercent: 89 }, { mount: "/userdata" as const, availableKiB: 952400, usedPercent: 5 }],
    services: { api: "active" as const, kiosk: "active" as const } },
};
