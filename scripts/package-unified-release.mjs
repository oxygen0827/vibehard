// Complete immutable release; no database, credentials or user workspace files.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const output=process.argv[2];assert.match(output??'',/^\/private\/tmp\/vibehard-unified-release\.[A-Za-z0-9]+$/);
const name='20260930-unified-platform-v2';const release=path.join(output,name);assert.ok(!existsSync(release));
const run=(c,a)=>execFileSync(c,a,{encoding:'utf8'}).trim();
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
assert.equal(run('git',['status','--porcelain']),'','Package a clean commit');
const previous=JSON.parse(readFileSync(`${output}/previous.json`));assert.equal(previous.release,'20260930-project-archive-v1');
for(const [p,h] of Object.entries(previous.sourceSha256)){assert.ok(existsSync(p),p);if(/^(app\/demo|public\/demo|app\/app\/pcb|components\/pcb)\//.test(p)||p==='next.config.ts')assert.equal(hash(p),h,p);}
assert.ok(readFileSync('.next/standalone/server.js','utf8').includes('basePath":"/vibehard"'));
mkdirSync(release);cpSync('.next/standalone',`${release}/standalone`,{recursive:true,verbatimSymlinks:true});
cpSync('.next/static',`${release}/standalone/.next/static`,{recursive:true});cpSync('public',`${release}/standalone/public`,{recursive:true});
const native=`${output}/napi-rs-canvas-linux-x64-gnu-1.0.9.tgz`;
const integrity='6kaz3w0QMy77PDWk6rJ1ksIihdad3qzEyX2o2oGT8GwCaypfT5mhjr8buOO5hstyLxcWXDScuz56RsINLtBPIQ==';
assert.ok(readFileSync('pnpm-lock.yaml','utf8').includes(`sha512-${integrity}`));assert.equal(createHash('sha512').update(readFileSync(native)).digest('base64'),integrity);
const nativeDir=`${release}/standalone/node_modules/@napi-rs/canvas-linux-x64-gnu`;mkdirSync(nativeDir,{recursive:true});run('tar',['-xzf',native,'--strip-components=1','-C',nativeDir]);
const sourceSha256={};for(const p of run('git',['ls-files']).split('\n')){assert.ok(!p.startsWith('/')&&!p.split('/').includes('..'));mkdirSync(path.dirname(`${release}/source/${p}`),{recursive:true});copyFileSync(p,`${release}/source/${p}`);sourceSha256[p]=hash(p);}
mkdirSync(`${release}/services`);const artifacts={};
for(const p of ['runner.cjs','gateway.cjs','migrate.cjs','design-worker.cjs','knowledge-retrieval.cjs','knowledge-batch-control.cjs','accept-project-archive.cjs','accept-agent-retrieval.cjs','accept-retrieval-load.cjs']){
  copyFileSync(`dist/services/${p}`,`${release}/services/${p}`);artifacts[p]=hash(`dist/services/${p}`);
}
writeFileSync(`${release}/RELEASE.json`,JSON.stringify({release:name,gitCommit:run('git',['rev-parse','HEAD']),previousPlatform:previous.release,sourceSha256,artifacts,migration:null,completeServices:true,protectedOverlayPreserved:true},null,2));
const archive=`${output}/${name}.tar.gz`;execFileSync('tar',['--no-xattrs','-czf',archive,'-C',output,name],{env:{...process.env,COPYFILE_DISABLE:'1'}});
console.log(JSON.stringify({release,archive,sha256:hash(archive)}));
