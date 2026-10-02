// Read-only HTTP regression gate for every shipped tool and its referenced assets.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
const [origin, standalone] = process.argv.slice(2);
assert.ok(origin && standalone);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const base = new URL('/vibehard/', origin);
const request = url => fetch(url, { signal: AbortSignal.timeout(20000), redirect: 'manual' });
const login = await request(new URL('login', base));
assert.equal(login.status, 200);
assert.match(login.headers.get('content-security-policy'), /frame-ancestors 'none'/);
const assets = new Set(), slugs = [], nestedFrames = [];
const pages = (await readdir(path.join(standalone, 'public/zutils/tools'), { withFileTypes: true })).filter(e => e.isDirectory()).map(e => `zutils/tools/${e.name}/index.html`);
pages.push(...(await readdir(path.join(standalone, 'public/zutils/labs'))).filter(p => p.endsWith('.html')).map(p => `zutils/labs/${p}`));
for (const relative of pages) {
  const expected = await readFile(path.join(standalone, 'public', relative));
  const url = new URL(`${relative}?v=nav-v1`, base);
  const response = await request(url);
  assert.equal(response.status, 200, relative);
  assert.match(response.headers.get('content-type'), /text\/html/);
  assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'self'/);
  assert.ok(!response.headers.get('content-security-policy').includes("frame-ancestors 'none'"));
  assert.notEqual(response.headers.get('x-frame-options')?.toUpperCase(), 'DENY');
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(digest(bytes), digest(expected), relative);
  if (relative.startsWith("zutils/tools/")) assert.ok(bytes.toString().includes('src="../../platform-navigation.js?v=nav-v1"'), `Missing navigation bridge: ${relative}`);
  for (const match of bytes.toString().matchAll(/(?:src|href)="([^\"]+\.(?:js|css|webp)(?:\?[^\"]*)?)"/g)) {
    const asset = new URL(match[1].replaceAll('&amp;', '&'), url);
    assert.equal(asset.origin, base.origin, 'Tool asset must be local'); assets.add(asset.href);
  }
  for (const match of bytes.toString().matchAll(/<iframe[^>]*src="([^"]+)"/g)) {
    const nested = new URL(match[1], url);
    assert.equal(nested.origin, base.origin, 'Instrument lab must be local');
    assert.ok(nested.pathname.startsWith('/vibehard/zutils/labs/'), `Invalid instrument frame: ${nested}`);
    const result = await request(nested);
    assert.equal(result.status, 200, `Nested instrument: ${nested}`);
    assert.match(result.headers.get('content-security-policy'), /frame-ancestors 'self'/);
    const html = Buffer.from(await result.arrayBuffer());
    assert.equal(digest(html), digest(await readFile(path.join(standalone, 'public', nested.pathname.replace(/^\/vibehard\//, '')))));
    for (const asset of html.toString().matchAll(/(?:src|href)="([^"]+\.(?:js|css|webp)(?:\?[^"]*)?)"/g)) assets.add(new URL(asset[1], nested).href);
    nestedFrames.push(nested.pathname);
  }
  slugs.push(relative);
}
assert.equal(slugs.length, 42);
assert.equal(nestedFrames.length, 3);
for (const url of assets) {
  const response = await request(url);
  assert.equal(response.status, 200, url);
  assert.match(response.headers.get('content-type'), /javascript|text\/css|image\/webp/, url);
  const assetPath = new URL(url).pathname.replace(/^\/vibehard\//, '');
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(digest(bytes), digest(await readFile(path.join(standalone, 'public', assetPath))), url);
}
console.log(JSON.stringify({ origin, tools: slugs.length, nestedInstruments: nestedFrames.length, localAssets: assets.size, framing: 'same-origin only', platformFraming: 'none' }));
