// Preserve the full latest production source when another release wins the race.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const root=process.argv[2];assert.equal(root,'/private/tmp/vibehard-tools-fix');
const run=(c,a)=>execFileSync(c,a,{encoding:'utf8'}).trim();
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
assert.equal(run('git',['status','--porcelain']),'','Commit overlay before preparing');
const current=JSON.parse(readFileSync(`${root}/kev-base/RELEASE.json`));
const old=JSON.parse(readFileSync(`${root}/TOOLS_EMBEDDING_RELEASE.json`));
assert.equal(current.release,'20261002-kev-agent-v1');
const stage=`${root}/kev-build`;assert.ok(!existsSync(stage));mkdirSync(stage);
for(const [file,digest] of Object.entries(current.sourceSha256)){
 assert.ok(!path.isAbsolute(file)&&!file.split('/').includes('..'));
 assert.equal(hash(`${root}/kev-base/source/${file}`),digest,file);
 mkdirSync(path.dirname(`${stage}/${file}`),{recursive:true});copyFileSync(`${root}/kev-base/source/${file}`,`${stage}/${file}`,2);
}
const overlay=run('git',['diff','--name-only','00ad25b','HEAD']).split('\n');
const runtime=p=>/^(app|components|lib|runner|gateway|drizzle|public)\//.test(p)||['package.json','pnpm-lock.yaml','next.config.ts','proxy.ts','instrumentation.ts'].includes(p);
const allowed=['app/app/tools/page.tsx','lib/zutils-tools.ts','public/zutils/platform-navigation.js',...Object.keys(old.sourceSha256).filter(p=>/^public\/zutils\/tools\/[^/]+\/index\.html$/.test(p))];
for(const file of overlay){
 if(runtime(file)){assert.ok(allowed.includes(file),file);assert.equal(current.sourceSha256[file],old.sourceSha256[file],`New production changed overlay target: ${file}`);}
 mkdirSync(path.dirname(`${stage}/${file}`),{recursive:true});copyFileSync(file,`${stage}/${file}`,2);
}
for(const file of ['package.json','pnpm-lock.yaml'])assert.equal(hash(`${stage}/${file}`),hash(file),`Reuse only identical dependencies: ${file}`);
run('cp',['-cR','node_modules',`${stage}/node_modules`]);
writeFileSync(`${root}/NAVIGATION_OVERLAY.json`,JSON.stringify({overlayGitCommit:run('git',['rev-parse','HEAD']),files:[...new Set([...Object.keys(current.sourceSha256),...overlay])]},null,2));
console.log(JSON.stringify({stage,baseline:current.release,preservedFiles:Object.keys(current.sourceSha256).length,overlayFiles:overlay.length}));
