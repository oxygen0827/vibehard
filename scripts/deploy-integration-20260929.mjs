import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const root='/opt/vibehard/releases/20260929-integrated-agent-eda-v2';
const old='/opt/vibehard/releases/20260928-rv1126b-entry-v1';
const node='/opt/vibehard/runtime/node-v22.23.1';
const backup=`${root}/backup`;
const units=['vibehard.service','vibehard-runner.service','vibehard-eda-manager.service'];
const mode=process.argv[2];assert.ok(['activate','rollback','inspect'].includes(mode));assert.equal(process.getuid(),0);
const run=(c,a,o={})=>{const r=spawnSync(c,a,{encoding:'utf8',timeout:180000,...o});assert.equal(r.status,0,`${c} ${a[0]} failed; details suppressed`);return r.stdout.trim();};
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const prop=(u,p)=>run('systemctl',['show',u,'-p',p,'--value']);
const query=s=>run('runuser',['-u','postgres','--','psql','-X','-A','-t','-v','ON_ERROR_STOP=1','-d','vibehard','-c',s]);
const idle=()=>{assert.equal(query("select count(*) from design_jobs where status in ('queued','running')"),'0','Design tasks active');assert.equal(query("select count(*) from agent_turns where status in ('queued','running','waiting_approval')"),'0','Agent tasks active');};
const manifest=JSON.parse(readFileSync(`${root}/RELEASE.json`));
for(const [f,h] of Object.entries(manifest.sourceSha256))assert.equal(hash(`${root}/source/${f}`),h,f);
for(const [f,h] of Object.entries(manifest.artifacts))assert.equal(hash(`${root}/services/${f}`),h,f);
const previous=JSON.parse(readFileSync(`${old}/RELEASE.json`));
for(const [f,h] of Object.entries(previous.sourceSha256)){
 assert.ok(manifest.sourceSha256[f],f);
 if(/^(app\/demo|public\/demo|app\/app\/pcb|components\/pcb)\//.test(f))assert.equal(manifest.sourceSha256[f],h,f);
}
const preserved=['vibehard-design-worker.service','vibehard-knowledge-retrieval.service','vibehard-gateway.service','vibeboard.service'];
const ready=async()=>{for(let i=0;i<35;i++){try{if((await fetch('http://127.0.0.1:3210/vibehard/login',{signal:AbortSignal.timeout(1000)})).status===200)return;}catch{}await new Promise(r=>setTimeout(r,1000));}throw Error('Platform unavailable');};
const verify=origin=>{
 console.log(run(node,[`${root}/source/scripts/verify-frontend-release.mjs`,origin,`${root}/standalone`]));
 console.log(run(node,[`${root}/source/scripts/verify-bom-release.mjs`,origin]));
};
function cleanCandidate(){
 const ids=run('docker',['ps','-q','--filter','label=vibehard.eda=worker']).split('\n').filter(Boolean);
 for(const id of ids){const info=JSON.parse(run('docker',['inspect',id]))[0];
   if(info.Mounts.some(m=>m.Source.startsWith('/var/lib/vibehard-eda-acceptance-20260929/projects/')))run('docker',['stop','--time','10',id]);
 }
 run('systemctl',['stop','vibehard-platform-candidate-20260929','vibehard-eda-candidate-20260929']);
}
async function restore(){
 for(const u of units)run('systemctl',['stop',u]);
 for(const u of units)copyFileSync(`${backup}/${u}`,`/etc/systemd/system/${u}`);
 copyFileSync(`${backup}/eda-manager.env`,'/etc/vibehard/eda-manager.env');
 run('systemctl',['daemon-reload']);run('systemctl',['start',...units.slice().reverse()]);await ready();
}
if(mode==='inspect'){
 idle();console.log(JSON.stringify({idle:true,platform:prop('vibehard.service','WorkingDirectory'),completedDesigns:query("select count(*) from design_jobs where status='completed'"),runningEda:run('docker',['ps','--filter','label=vibehard.eda=worker','--format','{{.Names}}'])}));
}
if(mode==='rollback'){
 idle();assert.equal(run('docker',['ps','-q','--filter','label=vibehard.eda=worker']),'','Active EDA desktops; do not interrupt');
 await restore();console.log('Restored previous units; additive migration and user data retained');
}
if(mode==='activate'){
 assert.equal(prop('vibehard.service','WorkingDirectory'),`${old}/standalone`);idle();
 assert.equal(prop('vibehard-design-handoff-proof-20260929','ExecMainStatus'),'0');
 const proof=run('journalctl',['-u','vibehard-design-handoff-proof-20260929','-o','cat','--no-pager']);
 assert.ok(proof.includes('"passed":true')&&proof.includes('"toolReadSavedFile":true'));
 verify('http://127.0.0.1:3211');
 cleanCandidate();
 assert.equal(run('docker',['ps','-q','--filter','label=vibehard.eda=worker']),'','Active EDA desktops; do not interrupt');
 assert.ok(!existsSync(backup));mkdirSync(backup,{mode:0o700});
 for(const u of units)copyFileSync(`/etc/systemd/system/${u}`,`${backup}/${u}`);
 copyFileSync('/etc/vibehard/eda-manager.env',`${backup}/eda-manager.env`);
 // pg_dump writes via the DB connection from the existing platform credentials, never logged.
 const env=Object.fromEntries(readFileSync('/etc/vibehard/platform.env','utf8').split('\n').filter(l=>l&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i),l.slice(i+1).replace(/^['"]|['"]$/g,'')];}));
 const db=new URL(env.DATABASE_URL);assert.equal(db.pathname,'/vibehard');
 const pg={...process.env,PGHOST:db.hostname,PGPORT:db.port||'5432',PGUSER:decodeURIComponent(db.username),PGPASSWORD:decodeURIComponent(db.password),PGDATABASE:'vibehard'};
 run('pg_dump',['-Fc','-f',`${backup}/platform.dump`,'vibehard'],{env:pg});
 assert.ok(run('pg_restore',['--list',`${backup}/platform.dump`]).includes('TABLE DATA public users'));
 writeFileSync(`${backup}/BACKUP.json`,JSON.stringify({at:new Date().toISOString(),sha256:hash(`${backup}/platform.dump`)}),{mode:0o600});
 const pids=Object.fromEntries(preserved.map(u=>[u,prop(u,'MainPID')]));
 const nginx=run('docker',['inspect','nginx','--format','{{.State.Pid}}']);
 const configs=['/etc/vibehard/platform.env','/etc/vibehard/runner.env','/etc/vibehard/model.env','/etc/vibehard/eda-platform.env','/var/lib/vibehard-runner/credential.json'].filter(existsSync).map(f=>[f,hash(f)]);
 try{
   idle();run('systemctl',['stop','vibehard.service']);idle();
   run(node,[`${root}/services/migrate.cjs`],{cwd:`${root}/source`,env:{...process.env,...env}});
   run('systemctl',['stop','vibehard-runner.service','vibehard-eda-manager.service']);
   for(const u of units){let t=readFileSync(`${backup}/${u}`,'utf8');
     if(u==='vibehard.service'){assert.ok(t.includes(old));t=t.replaceAll(old,root);}
     if(u==='vibehard-runner.service'){const from='/opt/vibehard/releases/20260927-unified-retrieval-v1/services/runner.cjs';assert.ok(t.includes(from));t=t.replace(from,`${root}/services/runner.cjs`);}
     if(u==='vibehard-eda-manager.service'){assert.ok(t.includes('/opt/vibehard/eda-manager/current'));t=t.replaceAll('/opt/vibehard/eda-manager/current',`${root}/source/services/eda-desktop`);}
     writeFileSync(`/etc/systemd/system/${u}`,t,{mode:0o644});
   }
   let eda=readFileSync(`${backup}/eda-manager.env`,'utf8');assert.match(eda,/^EDA_MANAGER_IMAGE=.+$/m);
   eda=eda.replace(/^EDA_MANAGER_IMAGE=.+$/m,'EDA_MANAGER_IMAGE=vibehard-eda-worker:20260929-integrated-v1');writeFileSync('/etc/vibehard/eda-manager.env',eda,{mode:0o600});
   run('systemctl',['daemon-reload']);run('systemctl',['start','vibehard-eda-manager.service','vibehard-runner.service','vibehard.service']);await ready();
   for(let i=0;i<35;i++){if(query("select count(*) from runner_nodes where runner_key='cloud-runner' and last_heartbeat_at>now()-interval '30 seconds' and capabilities @> '[\"project-design-files-v1\"]'::jsonb")==='1')break;await new Promise(r=>setTimeout(r,1000));}
   assert.equal(query("select count(*) from runner_nodes where runner_key='cloud-runner' and last_heartbeat_at>now()-interval '30 seconds' and capabilities @> '[\"project-design-files-v1\"]'::jsonb"),'1');
   assert.ok(run('ss',['-Htn','state','established','( sport = :8787 )']).length);
   verify('http://127.0.0.1:3210');verify('https://ldcx.tech');
   for(const u of units){assert.equal(prop(u,'ActiveState'),'active');assert.equal(prop(u,'NRestarts'),'0');}
   for(const [u,pid] of Object.entries(pids))assert.equal(prop(u,'MainPID'),pid);
   for(const [f,h] of configs)assert.equal(hash(f),h);
   assert.equal(run('docker',['inspect','nginx','--format','{{.State.Pid}}']),nginx);
   const report={activated:manifest.release,sourceCommit:manifest.gitCommit,at:new Date().toISOString(),migration:'0008',runnerFreshAndConnected:true,preservedPids:pids,backupSha256:hash(`${backup}/platform.dump`)};
   writeFileSync(`${root}/ACTIVATED.json`,JSON.stringify(report,null,2),{mode:0o600});console.log(JSON.stringify(report));
 }catch(error){await restore();console.error('Activation failed: previous services restored');throw error;}
}
