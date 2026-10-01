/** Fixed, read-only Linux commands. No user/model supplied shell fragments. */
export function probeCommand(nonce: string): string {
  if (!/^[a-f0-9]{16}$/.test(nonce)) throw new Error("INVALID_NONCE");
  const fields = {
    kernel: "uname -smr",
    model: "tr '\\000' '\\n' < /proc/device-tree/model",
    compatible: "tr '\\000' '\\n' < /proc/device-tree/compatible",
    os: "sed -n 's/^PRETTY_NAME=//p' /etc/os-release",
    memory: "grep -E '^(MemTotal|MemAvailable):' /proc/meminfo",
    uptime: "cat /proc/uptime",
    storage: "df -Pk / /userdata",
    services: "systemctl is-active vibeboard-api.service; systemctl is-active vibeboard-kiosk.service",
  };
  return [`printf '__VH_${nonce}_BEGIN__\\n'`, ...Object.entries(fields).flatMap(([name, command]) => [`printf '__VH_FIELD_${name}__\\n'`, command]), `printf '__VH_${nonce}_END__\\n'`].join("; ");
}

export interface DeviceProbe {
  model: string;
  compatible: string[];
  kernel: string;
  os: string;
  memoryTotalKiB: number;
  memoryAvailableKiB: number;
  uptimeSeconds: number;
  storage: { mount: string; availableKiB: number; usedPercent: number }[];
  services: { api: string; kiosk: string };
}

interface ProbeReader {
  read(): Promise<{ done: true; value?: Uint8Array } | { done: false; value: Uint8Array }>;
  cancel(): Promise<unknown>;
  releaseLock(): void;
}
interface ProbeSocket {
  readable: { getReader(): ProbeReader };
  close(): Promise<unknown>;
}

export async function collectProbe(open: (command: string) => Promise<ProbeSocket>, options: { nonce: string; timeoutMs?: number }): Promise<DeviceProbe> {
  const command = probeCommand(options.nonce);
  const timeout = options.timeoutMs ?? 15000;
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > 15000) throw new Error("INVALID_TIMEOUT");
  let socket: ProbeSocket | undefined;
  let reader: ReturnType<ProbeSocket["readable"]["getReader"]> | undefined;
  let expired = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => { timer = setTimeout(() => { expired = true; reject(new Error("PROBE_TIMEOUT")); }, timeout); });
  const decoder = new TextDecoder();
  let output = "";
  let bytes = 0;
  try {
    socket = await Promise.race([open(command).then(connection => {
      if (expired) void connection.close().catch(() => {});
      return connection;
    }), deadline]);
    reader = socket.readable.getReader();
    for (;;) {
      const { done, value } = await Promise.race([reader.read(), deadline]);
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 65536) throw new Error("OUTPUT_LIMIT");
      output += decoder.decode(value, { stream: true });
    }
    return parseProbe(output + decoder.decode(), options.nonce);
  } finally {
    clearTimeout(timer);
    if (reader) { void reader.cancel().catch(() => {}); reader.releaseLock(); }
    if (socket) void socket.close().catch(() => {});
  }
}

export function parseProbe(output: string, nonce: string): DeviceProbe {
  if (!/^[a-f0-9]{16}$/.test(nonce) || new TextEncoder().encode(output).byteLength > 65536) throw new Error("INVALID_REPORT");
  const normalized = output.replaceAll("\r", "").replaceAll("\0", "");
  const begin = `__VH_${nonce}_BEGIN__\n`, end = `__VH_${nonce}_END__`;
  if (normalized.split(begin).length !== 2 || normalized.split(end).length !== 2 || !normalized.trimEnd().endsWith(end)) throw new Error("INVALID_REPORT");
  const sections: Record<string, string> = {};
  const body = normalized.split(`__VH_${nonce}_BEGIN__\n`)[1]?.split(`__VH_${nonce}_END__`)[0] ?? "";
  const parts = body.split(/__VH_FIELD_(\w+)__\n/);
  for (let i = 1; i < parts.length; i += 2) sections[parts[i]] = parts[i + 1].trim();
  const expected = ["kernel", "model", "compatible", "os", "memory", "uptime", "storage", "services"];
  if (parts.length !== 17 || expected.some((field, i) => parts[i * 2 + 1] !== field || !sections[field])) throw new Error("INVALID_REPORT");
  if (!sections.compatible?.split("\n").includes("rockchip,rv1126b")) throw new Error("WRONG_BOARD");
  const service = sections.services.split("\n");
  const result: DeviceProbe = {
    model: sections.model, compatible: sections.compatible.split("\n"), kernel: sections.kernel,
    os: sections.os.replace(/^"|"$/g, ""),
    memoryTotalKiB: Number(/MemTotal:\s*(\d+)/.exec(sections.memory)?.[1]),
    memoryAvailableKiB: Number(/MemAvailable:\s*(\d+)/.exec(sections.memory)?.[1]),
    uptimeSeconds: Number(sections.uptime.split(/\s+/)[0]),
    storage: sections.storage.split("\n").slice(1).map(line => {
      const values = line.trim().split(/\s+/);
      return { mount: values[5], availableKiB: Number(values[3]), usedPercent: Number(values[4].replace("%", "")) };
    }),
    services: { api: service[0], kiosk: service[1] },
  };
  const positive = (value: number) => Number.isSafeInteger(value) && value > 0;
  if (!positive(result.memoryTotalKiB) || !positive(result.memoryAvailableKiB) || result.memoryAvailableKiB > result.memoryTotalKiB || !Number.isFinite(result.uptimeSeconds) || result.uptimeSeconds < 0 || result.storage.length !== 2 || result.storage.some((disk, i) => disk.mount !== ["/", "/userdata"][i] || !Number.isSafeInteger(disk.availableKiB) || disk.availableKiB < 0 || !Number.isInteger(disk.usedPercent) || disk.usedPercent < 0 || disk.usedPercent > 100) || service.length !== 2 || service.some(value => !["active", "inactive", "failed", "activating", "deactivating", "unknown", "reloading"].includes(value))) throw new Error("INVALID_REPORT");
  return result;
}
