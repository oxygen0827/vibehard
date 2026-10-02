// Frontend-only activation. Preserve all user data and backend services.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { assertPortableStandalone } from './standalone-links.mjs';
const release='/opt/vibehard/releases/20261002-schematic-workspace-ui-v1';
const previous='/opt/vibehard/releases/20261001-device-workspace-ui-v1';
const node='/opt/vibehard/runtime/node-v22.23.1';
const candidate='vibehard-schematic-workspace-ui-candidate.service', port=3217;
const unit='/etc/systemd/system/vibehard.service', backup=`${release}/backup`, evidence=`${release}/evidence`;
const mode=process.argv[2]; assert.equal(process.getuid(),0);assert.ok(['preflight','activate','rollback','cleanup','status'].includes(mode));
const run=(c,a,options={})=>{const r=spawnSync(c,a,{encoding:'utf8',timeout:180000,...options});assert.equal(r.status,0,`${c} failed; details suppressed`);return r.stdout.trim();};
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const prop=(u,p)=>run('systemctl',['show','--value','-p',p,u]);
const db=new URL(process.env.DATABASE_URL);assert.equal(db.pathname,'/vibehard');
const pg={...process.env,PGHOST:db.hostname,PGPORT:db.port||'5432',PGUSER:decodeURIComponent(db.username),PGPASSWORD:decodeURIComponent(db.password),PGDATABASE:'vibehard'};
const query=sql=>run('/usr/bin/psql',['-X','-t','-A','-v','ON_ERROR_STOP=1','-c',sql],{env:pg});
function idle(){assert.equal(query("select count(*) from design_jobs where status in ('queued','running')"),'0','Active design jobs');assert.equal(query("select count(*) from agent_turns where status in ('queued','running','waiting_approval')"),'0','Active Agent turns');}
function validate(){
 const manifest=JSON.parse(readFileSync(`${release}/RELEASE.json`));const old=JSON.parse(readFileSync(`${previous}/RELEASE.json`));
 assert.equal(manifest.release,release.split('/').at(-1));assert.equal(manifest.previousPlatform,old.release);assert.equal(manifest.frontendOnly,true);assert.equal(manifest.migration,null);
 const allowed=['app/app/schematic/page.tsx','components/app/schematic-document.tsx','lib/module-help.ts'],differences=[];
 const runtime=p=>/^(app|components|lib|runner|gateway|drizzle|public)\//.test(p)||['package.json','pnpm-lock.yaml','next.config.ts','proxy.ts','instrumentation.ts'].includes(p);
 for(const p of new Set([...Object.keys(old.sourceSha256),...Object.keys(manifest.sourceSha256)])){
  assert.ok(manifest.sourceSha256[p],`Published source missing: ${p}`);assert.equal(hash(`${release}/source/${p}`),manifest.sourceSha256[p],p);
  if(runtime(p)&&manifest.sourceSha256[p]!==old.sourceSha256[p]){assert.ok(allowed.includes(p),`Unexpected runtime change: ${p}`);differences.push(p);}
 }
 assert.deepEqual(differences.sort(),allowed.sort());
 const component=readFileSync(`${release}/source/app/app/schematic/page.tsx`,'utf8');
 assert.ok(component.includes('<SchematicDocument content={result.draft.content}'));assert.ok(component.includes('setConsent(false)'));assert.ok(component.includes('申请加入知识库备选'));
 const renderer=readFileSync(`${release}/source/components/app/schematic-document.tsx`,'utf8');assert.ok(!renderer.includes('dangerouslySetInnerHTML'));
 assert.ok(readFileSync(`${release}/standalone/server.js`,'utf8').includes('basePath":"/vibehard"'));
 assertPortableStandalone(`${release}/standalone`,{requirePdf:true});
}
async function ready(p){for(let i=0;i<35;i++){try{if((await fetch(`http://127.0.0.1:${p}/vibehard/login`,{signal:AbortSignal.timeout(1500)})).status===200)return;}catch{}await new Promise(r=>setTimeout(r,1000));}throw Error('Platform readiness timeout');}
function verify(origin){
 console.log(run(node,[`${release}/source/scripts/verify-frontend-release.mjs`,origin,`${release}/standalone`]));
 console.log(run(node,[`${release}/source/scripts/verify-bom-release.mjs`,origin]));
}
function cleanup(){spawnSync('systemctl',['stop',candidate]);spawnSync('systemctl',['reset-failed',candidate]);}
const protectedUnits=['vibehard-runner.service','vibehard-gateway.service','vibehard-design-worker.service','vibehard-knowledge-retrieval.service','vibehard-eda-manager.service','vibeboard.service'];
const configPaths=['/etc/vibehard/platform.env','/etc/vibehard/eda-platform.env','/etc/vibehard/runner.env','/etc/vibehard/model.env','/home/lincaigui/nginx/nginx.conf'];
function protection(){return {pids:Object.fromEntries(protectedUnits.map(u=>{assert.equal(prop(u,'ActiveState'),'active',u);return [u,prop(u,'MainPID')];})),nginx:run('docker',['inspect','nginx','--format','{{.State.Pid}}']),configs:Object.fromEntries(configPaths.filter(existsSync).map(p=>[p,hash(p)]))};}
function live(){const runners=JSON.parse(query("select coalesce(json_agg(row_to_json(t)),'[]'::json) from (select runner_key,extract(epoch from now()-last_heartbeat_at)::integer as age_seconds from runner_nodes order by runner_key) t"));assert.ok(runners.some(r=>r.runner_key==='cloud-runner'&&r.age_seconds<30),'Cloud heartbeat stale');const connections=run('ss',['-Htn','state','established','( sport = :8787 )']).split('\n').filter(Boolean).length;assert.ok(connections>=2,'Missing live Gateway connections');return {runners,connections};}
async function restore(){copyFileSync(`${backup}/vibehard.service`,unit);run('systemctl',['daemon-reload']);run('systemctl',['restart','vibehard.service']);await ready(3210);verify('http://127.0.0.1:3210');}
if(mode==='status'){console.log(JSON.stringify({platform:prop('vibehard.service','WorkingDirectory'),protected:protection(),live:live()},null,2));}
if(mode==='cleanup')cleanup();
if(mode==='preflight'){
 validate();assert.equal(prop('vibehard.service','WorkingDirectory'),`${previous}/standalone`);assert.notEqual(prop(candidate,'ActiveState'),'active');
 run('systemd-run',['--collect',`--unit=${candidate.replace(/\.service$/,'')}`,`--property=WorkingDirectory=${release}/standalone`,'--property=EnvironmentFile=/etc/vibehard/platform.env','--property=EnvironmentFile=/etc/vibehard/eda-platform.env','--property=MemoryMax=768M','--property=CPUQuota=100%','/usr/bin/env','HOSTNAME=127.0.0.1',`PORT=${port}`,'NODE_ENV=production','VIBEHARD_RETRIEVAL_SOCKET=/run/vibehard-knowledge/search.sock',node,'server.js']);
 try{await ready(port);verify(`http://127.0.0.1:${port}`);console.log(run(node,[`${release}/source/scripts/verify-pdf-standalone.mjs`,`${release}/standalone`]));mkdirSync(evidence,{mode:0o700});writeFileSync(`${evidence}/preflight.json`,JSON.stringify({passed:true,pdfPixelsVerified:true,at:new Date().toISOString(),live:live()}),{mode:0o600});console.log('Frontend candidate passed');}catch(e){cleanup();throw e;}
}
if(mode==='activate'){
 validate();assert.equal(prop('vibehard.service','WorkingDirectory'),`${previous}/standalone`);idle();assert.ok(JSON.parse(readFileSync(`${evidence}/preflight.json`)).passed);verify(`http://127.0.0.1:${port}`);assert.ok(!existsSync(backup));
 mkdirSync(backup,{mode:0o700});copyFileSync(unit,`${backup}/vibehard.service`);run('/usr/bin/pg_dump',['-Fc','-f',`${backup}/platform.dump`,'vibehard'],{env:pg});chmodSync(`${backup}/platform.dump`,0o600);
 assert.ok(run('/usr/bin/pg_restore',['--list',`${backup}/platform.dump`]).includes('TABLE DATA public users'));
 writeFileSync(`${backup}/BACKUP.json`,JSON.stringify({sha256:hash(`${backup}/platform.dump`),at:new Date().toISOString()}),{mode:0o600});
 const protectedBefore=protection(),liveBefore=live();idle();run('systemctl',['stop','vibehard.service']);
 try{
  idle();const old=readFileSync(`${backup}/vibehard.service`,'utf8');assert.ok(old.includes(previous));writeFileSync(unit,old.replaceAll(previous,release),{mode:0o644});
  run('systemctl',['daemon-reload']);run('systemctl',['start','vibehard.service']);await ready(3210);verify('http://127.0.0.1:3210');verify('https://ldcx.tech');
  assert.deepEqual(protection(),protectedBefore);assert.equal(prop('vibehard.service','NRestarts'),'0');const liveAfter=live();
  writeFileSync(`${release}/ACTIVATED.json`,JSON.stringify({at:new Date().toISOString(),protectedBefore,liveBefore,liveAfter,platformPid:prop('vibehard.service','MainPID')}),{mode:0o600});console.log(JSON.stringify({activated:release,live:liveAfter}));
 }catch(e){await restore();console.error('Prior platform restored after failed activation');throw e;}finally{cleanup();}
}
if(mode==='rollback'){idle();assert.equal(prop('vibehard.service','WorkingDirectory'),`${release}/standalone`);await restore();cleanup();console.log('Previous platform restored; database and backend services unchanged');}

