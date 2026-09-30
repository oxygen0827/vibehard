// Local-only geometry/interaction check. All project/events data is synthetic;
// this does not exercise a model, Runner, production account, or database.
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.VIBEHARD_PLAYWRIGHT_MODULE || 'playwright');
assert.equal(process.env.VIBEHARD_CHAT_UI_TEST, '1');
const origin = process.argv[2] || 'http://127.0.0.1:3213';
assert.equal(new URL(origin).hostname, '127.0.0.1');
const base = `${origin}/vibehard`;
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const registration = await context.request.post(`${base}/api/auth/register`, { data: {
    email: `chat-scroll-${randomUUID()}@example.invalid`, password: randomBytes(24).toString('hex'), inviteCode: 'CHATSCROLL',
  } });
  assert.equal(registration.status(), 201, 'Run against the disposable, in-memory dev server');
  const projectId = '00000000-0000-4000-8000-000000000001';
  const threadId = '00000000-0000-4000-8000-000000000002';
  const events = Array.from({ length: 35 }, (_, index) => ({ eventId: `history-${index}`, sequence: index, type: 'agent.message', data: {
    itemId: `answer-${index}`, text: `第 ${index + 1} 条合成历史回复\n${'这是浏览器布局测试资料，不是真实模型回复。保留上下文并在区域内滚动。\n'.repeat(6)}`,
  }, timestamp: '2026-09-30T00:00:00Z' }));
  await context.route('**/api/**', route => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace('/vibehard', '');
    let data;
    if (path === '/api/projects') data = { projects: Array.from({ length: 25 }, (_, index) => ({ id: index ? `project-${index}` : projectId, name: index ? `合成项目 ${index}` : '会话滚动验收', defaultModel: 'test-model', runnerKey: 'cloud-runner' })) };
    else if (path === '/api/models') data = { models: [{ id: 'test', providerId: 'test', model: 'test-model', displayName: '合成测试模型', kind: 'agent' }] };
    else if (path === '/api/runners') data = { runners: [{ runnerKey: 'cloud-runner', name: '合成云端执行器', capabilities: [] }] };
    else if (path.endsWith('/threads')) data = { threads: [{ id: threadId, title: '长会话布局验收' }] };
    else if (path === `/api/threads/${threadId}`) data = { events, artifacts: [], approvals: [] };
    else if (path.endsWith('/documents')) data = { documents: [] };
    else if (path.endsWith('/artifacts')) data = { artifacts: [] };
    else if (path === '/api/design') data = { jobs: [], nextOffset: null };
    else if (path === '/api/auth/session') data = { authenticated: true, user: { role: 'member' } };
    else throw Error(`Unexpected fixture request ${path}`);
    return route.fulfill({ json: data });
  });
  await context.addInitScript(() => {
    window.__chatStreams = [];
    window.EventSource = class extends EventTarget {
      constructor() { super(); window.__chatStreams.push(this); setTimeout(() => this.onopen?.(), 0); }
      close() {}
    };
  });
  const page = await context.newPage();
  const pageErrors = []; page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto(`${base}/app/agent`);
  await page.getByRole('button', { name: 'Agent 会话', exact: true }).click();
  await page.getByText('第 35 条合成历史回复', { exact: false }).waitFor();
  const region = page.getByRole('region', { name: '会话消息' });
  const atBottom = () => page.waitForFunction(() => { const e = document.querySelector('[aria-label="会话消息"]'); return e && e.scrollHeight - e.scrollTop - e.clientHeight < 3; });
  const geometry = () => page.evaluate(() => {
    const e = document.querySelector('[aria-label="会话消息"]');
    const work = document.querySelector('[aria-label="Agent 项目工作区"]');
    const composer = document.querySelector('[aria-label="任务输入区"]').getBoundingClientRect();
    return { height: innerHeight, bodyHeight: document.documentElement.scrollHeight, outerOverflow: work.parentElement.scrollHeight - work.parentElement.clientHeight,
      messageHeight: e.clientHeight, messageOverflow: e.scrollHeight - e.clientHeight, messageWidthOverflow: e.scrollWidth - e.clientWidth, composerBottom: composer.bottom };
  });
  function assertGeometry(g) {
    assert.ok(g.bodyHeight <= g.height + 1, JSON.stringify(g));
    assert.ok(g.outerOverflow <= 1, JSON.stringify(g));
    assert.ok(g.composerBottom <= g.height + 1, JSON.stringify(g));
    assert.ok(g.messageHeight > 40 && g.messageOverflow > 1000, JSON.stringify(g));
    assert.ok(g.messageWidthOverflow <= 1, JSON.stringify(g));
  }
  await atBottom(); const desktop = await geometry(); assertGeometry(desktop);
  await region.evaluate(e => { e.scrollTop = 150; });
  await page.getByRole('button', { name: '回到最新' }).waitFor();
  let sequence = 100;
  async function emit(text, type = 'agent.message', itemId = 'stream') {
    const event = { eventId: `live-${sequence}`, sequence: sequence++, type, timestamp: '2026-09-30T00:01:00Z', data: { itemId, text } };
    await page.evaluate(event => window.__chatStreams.at(-1).dispatchEvent(new MessageEvent(event.type, { data: JSON.stringify(event) })), event);
    await page.getByText(text, { exact: false }).first().waitFor({ state: 'attached' });
  }
  await emit('新增回复不会抢走历史位置\n' + '测试内容 '.repeat(1000));
  await page.waitForTimeout(100);
  assert.ok(Math.abs(await region.evaluate(e => e.scrollTop) - 150) < 2);
  await page.getByRole('button', { name: '回到最新' }).click(); await atBottom();
  await emit('流式新增内容\n'.repeat(80), 'agent.message.delta'); await atBottom();
  await emit('连续无空格字符'.repeat(500), 'agent.message.delta'); await atBottom(); assertGeometry(await geometry());
  await emit('合成推理记录\n'.repeat(60), 'reasoning', 'reasoning-test'); await atBottom();
  const beforeExpansion = await region.evaluate(e => e.scrollTop);
  await page.getByText('推理过程', { exact: true }).click();
  await page.getByRole('button', { name: '回到最新' }).waitFor();
  await page.waitForTimeout(100);
  assert.ok(Math.abs(await region.evaluate(e => e.scrollTop) - beforeExpansion) < 2, 'Expanding reasoning must not jump to its end');
  await emit('展开时新回复也不打断阅读', 'agent.message', 'after-reasoning');
  assert.ok(Math.abs(await region.evaluate(e => e.scrollTop) - beforeExpansion) < 2);
  await page.getByRole('button', { name: '回到最新' }).click(); await atBottom();
  await page.screenshot({ path: '/private/tmp/vibehard-chat-desktop.png' });
  const sizes = [];
  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }, { width: 900, height: 700 }]) {
    await page.setViewportSize(viewport); await atBottom();
    const g = await geometry(); assertGeometry(g); sizes.push({ ...viewport, ...g });
    await page.getByRole('button', { name: '项目列表', exact: true }).click();
    await page.getByRole('complementary', { name: '项目列表' }).waitFor();
    assert.equal(await region.isVisible(), false);
    await page.getByRole('button', { name: '项目列表', exact: true }).click();
    await region.waitFor();
    await page.getByRole('button', { name: '审批与产物', exact: true }).click();
    await page.getByRole('complementary', { name: '审批与产物' }).waitFor();
    await page.getByRole('button', { name: '审批与产物', exact: true }).click();
    await region.waitFor();
  }
  await page.setViewportSize({ width: 390, height: 844 }); await atBottom();
  await page.screenshot({ path: '/private/tmp/vibehard-chat-mobile.png' });
  assert.deepEqual(pageErrors, []);
  console.log(JSON.stringify({ passed: true, desktop, responsive: sizes, historyPreserved: true, streamingFollow: true, reasoningExpansionPreserved: true, productionOrModelCalls: false }));
} finally { await browser.close(); }
