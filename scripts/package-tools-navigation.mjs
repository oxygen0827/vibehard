// Clean, complete frontend-only release; never includes environment files or test credentials.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertPortableStandalone } from './standalone-links.mjs';
const output=process.argv[2]; assert.match(output??'',/^\/private\/tmp\/vibehard-tools-fix$/);
const name='20261002-tools-navigation-v2', previousName='20261002-kev-agent-v1';
const release=path.join(output,name); assert.ok(!existsSync(release));
const run=(c,a)=>execFileSync(c,a,{encoding:'utf8'}).trim();
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
assert.equal(path.resolve('.'),`${output}/kev-build`);
const prepared=JSON.parse(readFileSync(`${output}/NAVIGATION_OVERLAY.json`));
const previous=JSON.parse(readFileSync(`${output}/kev-base/RELEASE.json`));
assert.equal(previous.release,previousName);
const runtime=p=>/^(app|components|lib|runner|gateway|drizzle|public)\//.test(p)||['package.json','pnpm-lock.yaml','next.config.ts','proxy.ts','instrumentation.ts'].includes(p);
const allowed=['app/app/tools/page.tsx','lib/zutils-tools.ts','public/zutils/platform-navigation.js',...Object.keys(previous.sourceSha256).filter(p=>/^public\/zutils\/tools\/[^/]+\/index\.html$/.test(p))];
const files=prepared.files, sourceSha256=Object.fromEntries(files.map(p=>[p,hash(p)]));
const differences=[];
for(const p of new Set([...Object.keys(previous.sourceSha256),...files])) {
  assert.ok(sourceSha256[p],`Published source missing: ${p}`);
  if(runtime(p)&&sourceSha256[p]!==previous.sourceSha256[p]) {assert.ok(allowed.includes(p),`Unexpected runtime change: ${p}`);differences.push(p);}
}
assert.deepEqual(differences.sort(),allowed.sort());
assert.ok(readFileSync('.next/standalone/server.js','utf8').includes('basePath":"/vibehard"'));
assertPortableStandalone('.next/standalone');
mkdirSync(release); run('cp',['-cR','.next/standalone',`${release}/standalone`]);
run('cp',['-cR','.next/static',`${release}/standalone/.next/static`]);run('cp',['-cR','public',`${release}/standalone/public`]);
// Tracing includes may materialize a worker-only directory that shadows the pnpm link.
// Copy the complete existing pinned package, not a new dependency or external fallback.
assert.equal(JSON.parse(readFileSync('node_modules/pdfjs-dist/package.json')).version,JSON.parse(readFileSync('package.json')).dependencies['pdfjs-dist']);
run('cp',['-cR',`${realpathSync('node_modules/pdfjs-dist')}/.`,`${release}/standalone/node_modules/pdfjs-dist`]);
const native='/private/tmp/vibehard-device-report-release.FjHWDJiB/napi-rs-canvas-linux-x64-gnu-1.0.9.tgz';
assert.equal(createHash('sha512').update(readFileSync(native)).digest('base64'),'6kaz3w0QMy77PDWk6rJ1ksIihdad3qzEyX2o2oGT8GwCaypfT5mhjr8buOO5hstyLxcWXDScuz56RsINLtBPIQ==');
mkdirSync(`${release}/standalone/node_modules/@napi-rs/canvas-linux-x64-gnu`,{recursive:true});
run('tar',['-xzf',native,'--strip-components=1','-C',`${release}/standalone/node_modules/@napi-rs/canvas-linux-x64-gnu`]);
assertPortableStandalone(`${release}/standalone`,{requirePdf:true});
run(process.execPath,['scripts/verify-pdf-standalone.mjs',`${release}/standalone`]);
for(const p of files){mkdirSync(path.dirname(`${release}/source/${p}`),{recursive:true});copyFileSync(p,`${release}/source/${p}`,2);}
writeFileSync(`${release}/RELEASE.json`,JSON.stringify({release:name,gitCommit:`${previous.gitCommit} + ${prepared.overlayGitCommit} navigation overlay`,overlayGitCommit:prepared.overlayGitCommit,previousPlatform:previousName,sourceSha256,runtimeChanges:differences,migration:null,frontendOnly:true},null,2));
const archive=`${output}/${name}.tar.gz`;
execFileSync('tar',['--no-xattrs','-czf',archive,'-C',output,name],{env:{...process.env,COPYFILE_DISABLE:'1'}});
console.log(JSON.stringify({archive,sha256:hash(archive),sourceFiles:files.length,runtimeChanges:differences}));

