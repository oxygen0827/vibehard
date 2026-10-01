// Clean, complete frontend-only release; never includes environment files or test credentials.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertPortableStandalone } from './standalone-links.mjs';
const output=process.argv[2]; assert.match(output??'',/^\/private\/tmp\/vibehard-project-archive-ui\.[A-Za-z0-9]+$/);
const name='20261001-project-archive-ui-v3', previousName='20261001-browser-device-report-v1';
const release=path.join(output,name); assert.ok(!existsSync(release));
const run=(c,a)=>execFileSync(c,a,{encoding:'utf8'}).trim();
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
assert.equal(run('git',['status','--porcelain']),'','Package a clean commit');
const previous=JSON.parse(run('ssh',['-o','UseKeychain=yes','-o','BatchMode=yes','-i','/Users/hushaohong/.ssh/ldcx_vibeboard_deploy','root@47.102.197.71',`cat /opt/vibehard/releases/${previousName}/RELEASE.json`]));
assert.equal(previous.release,previousName);
const runtime=p=>/^(app|components|lib|runner|gateway|drizzle|public)\//.test(p)||['package.json','pnpm-lock.yaml','next.config.ts','proxy.ts','instrumentation.ts'].includes(p);
const allowed=['components/app/agent-workbench.tsx','lib/module-help.ts'];
const files=run('git',['ls-files']).split('\n'), sourceSha256=Object.fromEntries(files.map(p=>[p,hash(p)]));
const differences=[];
for(const p of new Set([...Object.keys(previous.sourceSha256),...files])) {
  assert.ok(sourceSha256[p],`Published source missing: ${p}`);
  if(runtime(p)&&sourceSha256[p]!==previous.sourceSha256[p]) {assert.ok(allowed.includes(p),`Unexpected runtime change: ${p}`);differences.push(p);}
}
assert.deepEqual(differences.sort(),allowed.sort());
assert.ok(readFileSync('.next/standalone/server.js','utf8').includes('basePath":"/vibehard"'));
assertPortableStandalone('.next/standalone');
mkdirSync(release); cpSync('.next/standalone',`${release}/standalone`,{recursive:true,verbatimSymlinks:true});
cpSync('.next/static',`${release}/standalone/.next/static`,{recursive:true});cpSync('public',`${release}/standalone/public`,{recursive:true});
const native='/private/tmp/vibehard-device-report-release.FjHWDJiB/napi-rs-canvas-linux-x64-gnu-1.0.9.tgz';
assert.equal(createHash('sha512').update(readFileSync(native)).digest('base64'),'6kaz3w0QMy77PDWk6rJ1ksIihdad3qzEyX2o2oGT8GwCaypfT5mhjr8buOO5hstyLxcWXDScuz56RsINLtBPIQ==');
mkdirSync(`${release}/standalone/node_modules/@napi-rs/canvas-linux-x64-gnu`,{recursive:true});
run('tar',['-xzf',native,'--strip-components=1','-C',`${release}/standalone/node_modules/@napi-rs/canvas-linux-x64-gnu`]);
assertPortableStandalone(`${release}/standalone`);
for(const p of files){mkdirSync(path.dirname(`${release}/source/${p}`),{recursive:true});copyFileSync(p,`${release}/source/${p}`);}
writeFileSync(`${release}/RELEASE.json`,JSON.stringify({release:name,gitCommit:run('git',['rev-parse','HEAD']),previousPlatform:previousName,sourceSha256,runtimeChanges:differences,migration:null,frontendOnly:true},null,2));
const archive=`${output}/${name}.tar.gz`;
execFileSync('tar',['--no-xattrs','-czf',archive,'-C',output,name],{env:{...process.env,COPYFILE_DISABLE:'1'}});
console.log(JSON.stringify({archive,sha256:hash(archive),sourceFiles:files.length,runtimeChanges:differences}));
