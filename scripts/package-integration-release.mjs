// Immutable September 29 integration package; native Linux Canvas is lockfile verified.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const [output] = process.argv.slice(2);
assert.match(output ?? '', /^\/private\/tmp\/vibehard-integration\.[A-Za-z0-9]+$/);
const name = '20260929-integrated-agent-eda-v1';
const release = path.join(output, name);
assert.ok(!existsSync(release));
const run = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8' }).trim();
assert.equal(run('git', ['status', '--porcelain']), '', 'Package a clean commit');
const previous = JSON.parse(readFileSync(path.join(output, 'previous.json')));
assert.equal(previous.release, '20260928-rv1126b-entry-v1');
const hash = p => createHash('sha256').update(readFileSync(p)).digest('hex');
for (const [file, sha] of Object.entries(previous.sourceSha256)) {
  assert.ok(existsSync(file), `Published file missing: ${file}`);
  if (/^(app\/demo|public\/demo|app\/app\/pcb|components\/pcb)\//.test(file)) assert.equal(hash(file), sha, file);
}
assert.ok(readFileSync('.next/standalone/server.js', 'utf8').includes('basePath":"/vibehard"'));
const config = readFileSync('next.config.ts', 'utf8');
assert.ok(config.includes('pdfjs-dist') && config.includes('headers()') && config.includes('webpack(config)'));
mkdirSync(release);
cpSync('.next/standalone', `${release}/standalone`, { recursive: true, verbatimSymlinks: true });
cpSync('.next/static', `${release}/standalone/.next/static`, { recursive: true });
cpSync('public', `${release}/standalone/public`, { recursive: true });
const native = `${output}/napi-rs-canvas-linux-x64-gnu-1.0.9.tgz`;
const integrity = '6kaz3w0QMy77PDWk6rJ1ksIihdad3qzEyX2o2oGT8GwCaypfT5mhjr8buOO5hstyLxcWXDScuz56RsINLtBPIQ==';
assert.ok(readFileSync('pnpm-lock.yaml', 'utf8').includes(`sha512-${integrity}`));
assert.equal(createHash('sha512').update(readFileSync(native)).digest('base64'), integrity);
const nativeDir = `${release}/standalone/node_modules/@napi-rs/canvas-linux-x64-gnu`;
mkdirSync(nativeDir, { recursive: true });
run('tar', ['-xzf', native, '--strip-components=1', '-C', nativeDir]);
const sourceSha256 = {};
for (const file of run('git', ['ls-files']).split('\n')) {
  assert.ok(!file.startsWith('/') && !file.split('/').includes('..'));
  mkdirSync(path.dirname(`${release}/source/${file}`), { recursive: true });
  copyFileSync(file, `${release}/source/${file}`); sourceSha256[file] = hash(file);
}
mkdirSync(`${release}/services`);
const artifacts = {};
for (const name of ['runner.cjs', 'migrate.cjs', 'accept-agent-retrieval.cjs']) {
  copyFileSync(`dist/services/${name}`, `${release}/services/${name}`);
  artifacts[name] = hash(`dist/services/${name}`);
}
writeFileSync(`${release}/RELEASE.json`, JSON.stringify({ release: name, gitCommit: run('git', ['rev-parse', 'HEAD']),
  previousPlatform: previous.release, sourceSha256, artifacts, linuxCanvasIntegrity: `sha512-${integrity}`,
  migration: '0008_misty_wolf_cub', protectedOverlayPreserved: true,
  reviewedConfigChange: 'Add PDF.js external packages and asset tracing; preserve all previous settings' }, null, 2));
const archive = `${output}/${name}.tar.gz`;
execFileSync('tar', ['--no-xattrs', '-czf', archive, '-C', output, name], { env: { ...process.env, COPYFILE_DISABLE: '1' } });
console.log(JSON.stringify({ release, archive, sha256: hash(archive) }));
