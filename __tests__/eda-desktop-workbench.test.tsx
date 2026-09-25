import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ clients: [] as Array<EventTarget & { disconnect: ReturnType<typeof vi.fn>; sendKey: ReturnType<typeof vi.fn> }> }));
vi.mock('@novnc/novnc', () => ({ default: class extends EventTarget {
  disconnect = vi.fn(); sendKey = vi.fn(); focus = vi.fn();
  constructor() { super(); mocks.clients.push(this); }
} }));
import { DesktopWorkbench } from '@/components/eda/desktop-workbench';
const project = { id: '22222222-2222-4222-8222-222222222222', name: '真实工程' };
beforeEach(() => { mocks.clients.length = 0; });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

async function openProject() {
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ projects: [project] }))
    .mockImplementation(() => Promise.resolve(Response.json({ running: true, files: [], ticket: crypto.randomUUID() })));
  vi.stubGlobal('fetch', fetcher);
  render(<DesktopWorkbench />);
  await screen.findByRole('option', { name: project.name });
  fireEvent.change(screen.getByRole('combobox', { name: '选择工程' }), { target: { value: project.id } });
  fireEvent.click(screen.getByRole('button', { name: '打开工程' }));
  await waitFor(() => expect(mocks.clients).toHaveLength(1));
  return fetcher;
}

it('shows login without creating a simulated editor for unauthenticated users', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })));
  render(<DesktopWorkbench />);
  expect(await screen.findByRole('link', { name: '登录平台' })).toHaveAttribute('href', '/login');
  expect(mocks.clients).toHaveLength(0);
});

it('sends save keys only after connecting and preserves the saved-file warning', async () => {
  const fetcher = await openProject();
  expect(screen.getByRole('button', { name: '保存 Ctrl+S' })).toBeDisabled();
  act(() => mocks.clients[0].dispatchEvent(new Event('connect')));
  fireEvent.click(screen.getByRole('button', { name: '保存 Ctrl+S' }));
  expect(mocks.clients[0].sendKey).toHaveBeenCalledTimes(4);
  expect(screen.getByRole('status')).toHaveTextContent('已发送 Ctrl+S');
  const startBody = JSON.parse(fetcher.mock.calls[1][1].body);
  expect(startBody).toEqual({ action: 'start', editor: 'schematic' });
  cleanup();
  expect(mocks.clients[0].disconnect).toHaveBeenCalled();
  expect(fetcher).toHaveBeenCalledTimes(2); // Leaving the page never terminates the native session.
});

it('offers reconnect when the transport drops instead of claiming a saved session', async () => {
  await openProject();
  act(() => mocks.clients[0].dispatchEvent(new Event('connect')));
  act(() => mocks.clients[0].dispatchEvent(new Event('disconnect')));
  expect(screen.getByRole('heading', { name: 'KiCad 连接已断开' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '保存 Ctrl+S' })).toBeDisabled();
  cleanup();
  expect(mocks.clients[0].disconnect).not.toHaveBeenCalled();
});

it('ends a stalled connection with a visible timeout', async () => {
  await openProject();
  const timer = vi.spyOn(window, 'setTimeout');
  fireEvent.click(screen.getByRole('button', { name: '重新连接' }));
  await waitFor(() => expect(mocks.clients).toHaveLength(2));
  const callback = timer.mock.calls.find(call => call[1] === 20_000)?.[0];
  expect(typeof callback).toBe('function');
  act(() => { if (typeof callback === 'function') callback(); });
  expect(screen.getByRole('status')).toHaveTextContent('桌面连接超时');
  expect(mocks.clients[1].disconnect).toHaveBeenCalled();
  timer.mockRestore();
});
