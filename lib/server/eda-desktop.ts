import { readFile } from 'node:fs/promises';

export type DesktopAction = {
  action: 'start' | 'status' | 'stop' | 'archive' | 'check' | 'snapshot';
  editor?: 'schematic' | 'pcb';
  kind?: 'erc' | 'drc';
  sources?: { schematic: string; pcb: string };
};

export async function desktopRequest(owner: string, project: string, action: DesktopAction): Promise<Response> {
  const endpoint = process.env.EDA_DESKTOP_URL;
  const tokenPath = process.env.EDA_DESKTOP_TOKEN_FILE;
  // The initial adapter is a trusted local workstation, not a hosted multi-tenant runtime.
  if (!endpoint || !tokenPath || process.env.NODE_ENV === 'production') {
    return Response.json({ error: 'KiCad 桌面运行环境未启用。请按 docs/eda-desktop.md 启动本地服务。' }, { status: 503 });
  }
  const url = new URL(endpoint);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.protocol !== 'http:') {
    return Response.json({ error: '本地 KiCad 服务必须绑定回环地址' }, { status: 503 });
  }
  const token = (await readFile(tokenPath, 'utf8')).trim();
  return fetch(new URL(`/v1/projects/${encodeURIComponent(owner)}/${encodeURIComponent(project)}`, url), {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(action), cache: 'no-store', signal: AbortSignal.timeout(action.action === 'check' || action.action === 'snapshot' ? 100_000 : 45_000),
  });
}
