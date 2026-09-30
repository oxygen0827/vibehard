// Three-service ordered release; immutable candidate first, no production migration.
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readlinkSync, writeFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { request } from 'node:http';
const isCandidate=process.env.VIBEHARD_MATERIAL_LOCK_CANDIDATE==='1';
const root=isCandidate?'/opt/vibehard/releases/20260930-project-material-lock-candidate-v1':'/opt/vibehard/releases/20260930-project-material-lock-v1';
const candidateRoot='/opt/vibehard/releases/20260930-project-material-lock-candidate-v1';
const previous='/opt/vibehard/releases/20260930-project-materials-v1';
const retrievalPrevious='/opt/vibehard/releases/20260930-unified-platform-v2';
const state='/opt/vibehard/test-state/20260930-project-material-lock';
const node='/opt/vibehard/runtime/node-v22.23.1';
const dbName='vibehard_lock_acceptance_20260930';
const socket='/run/vibehard-material-lock-candidate/search.sock';
const candidate=['vibehard-material-lock-platform-candidate.service','vibehard-material-lock-design-candidate.service','vibehard-material-lock-retrieval-candidate.service'];
const units=['vibehard.service','vibehard-design-worker.service','vibehard-knowledge-retrieval.service'];
const protectedUnits=['vibehard-runner.service','vibehard-gateway.service','vibehard-eda-manager.service'];
const starts=['vibehard-knowledge-retrieval.service','vibehard.service','vibehard-design-worker.service'];
const oldRoots=Object.fromEntries(units.map(unit=>[unit,unit==='vibehard-knowledge-retrieval.service'?retrievalPrevious:previous]));
const mode=process.argv[2];assert.equal(process.getuid(),0);assert.ok(['prepare','candidate','activate','verify','cleanup','rollback'].includes(mode));
const run=(c,a,o={})=>{const r=spawnSync(c,a,{encoding:'utf8',timeout:300000,maxBuffer:32*1024*1024,...o});assert.equal(r.status,0,`${c} ${a[0]??''} failed; output suppressed`);return r.stdout.trim();};
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const prop=(u,p)=>run('systemctl',['show',u,'-p',p,'--value']);
const query=(db,sql)=>run('runuser',['-u','postgres','--','psql','-XAt','-v','ON_ERROR_STOP=1','-d',db],{input:sql,cwd:'/tmp'});
const idle=()=>{
  assert.equal(query('vibehard',"select count(*) from design_jobs where status in ('queued','running');"),'0','Design tasks active');
  assert.equal(query('vibehard',"select count(*) from agent_turns where status in ('queued','running','waiting_approval');"),'0','Agent tasks active');
  assert.equal(run('docker',['ps','--filter','label=vibehard.eda=worker','--format','{{.Names}}']),'','EDA sessions active');
};
const manifest=JSON.parse(readFileSync(`${root}/RELEASE.json`));assert.equal(manifest.completeServices,true);
for(const [p,h] of Object.entries(manifest.sourceSha256))assert.equal(hash(`${root}/source/${p}`),h,p);
for(const [p,h] of Object.entries(manifest.artifacts))assert.equal(hash(`${root}/services/${p}`),h,p);
const old=JSON.parse(readFileSync(`${previous}/RELEASE.json`));
for(const [p,h] of Object.entries(old.sourceSha256)){
  assert.ok(manifest.sourceSha256[p],`Missing published source: ${p}`);
  if(/^(app\/demo|public\/demo|app\/app\/pcb|components\/pcb)\//.test(p)||p==='next.config.ts')assert.equal(manifest.sourceSha256[p],h,p);
}
const platform=parseEnv(readFileSync('/etc/vibehard/platform.env','utf8'));
assert.equal(new URL(platform.DATABASE_URL).pathname,'/vibehard');
const protectedFiles=['platform.env','runner.env','model.env','eda-platform.env','eda-manager.env','project-archive.env'].map(p=>`/etc/vibehard/${p}`).concat(['/var/lib/vibehard-runner/credential.json','/opt/vibehard/knowledge/control/current.json','/opt/vibehard/knowledge/control/disabled.json','/opt/vibehard/knowledge/20260926-esp32-s3-v1/knowledge-fts.sqlite']).filter(existsSync);
const protect=()=>({pids:Object.fromEntries(protectedUnits.map(u=>[u,prop(u,'MainPID')])),files:Object.fromEntries(protectedFiles.map(p=>[p,hash(p)])),vibeboardPid:prop('vibeboard.service','MainPID'),nginxPid:run('docker',['inspect','nginx','--format','{{.State.Pid}}'])});
function checkProtection(value){for(const [u,pid] of Object.entries(value.pids))assert.equal(prop(u,'MainPID'),pid,`Protected service changed: ${u}`);for(const [p,h] of Object.entries(value.files))assert.equal(hash(p),h,`Protected file changed: ${p}`);assert.equal(prop('vibeboard.service','MainPID'),value.vibeboardPid);assert.equal(run('docker',['inspect','nginx','--format','{{.State.Pid}}']),value.nginxPid);}
const save=(name,value)=>writeFileSync(`${root}/evidence/${name}.json`,JSON.stringify(value,null,2),{mode:0o600});
const ready=async(port)=>{for(let i=0;i<40;i++){try{if((await fetch(`http://127.0.0.1:${port}/vibehard/login`,{signal:AbortSignal.timeout(1000)})).status===200)return;}catch{}await new Promise(r=>setTimeout(r,500));}throw Error('Platform readiness failed');};
const verifyWeb=origin=>{console.log(run(node,[`${root}/source/scripts/verify-frontend-release.mjs`,origin,`${root}/standalone`]));console.log(run(node,[`${root}/source/scripts/verify-bom-release.mjs`,origin]));};
async function queryIndex(path,queryText='ESP32-S3-Touch-LCD-2.8C 原理图'){
  return new Promise((resolve,reject)=>{const req=request({socketPath:path,path:'/query',method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(3000)},res=>{let text='';res.on('data',x=>text+=x);res.on('end',()=>{try{assert.equal(res.statusCode,200);const data=JSON.parse(text);assert.ok(data.sources.length);assert.ok(data.sources.every(s=>s.reviewStatus==='auto-indexed'));resolve({sources:data.sources.length,revision:data.revision});}catch(e){reject(e);}});});req.on('error',reject);req.end(JSON.stringify({query:queryText}));});
}
async function readyIndex(path){
  for(let i=0;i<20;i++){try{return await queryIndex(path);}catch{await new Promise(resolve=>setTimeout(resolve,250));}}
  throw Error('Retrieval readiness failed');
}
async function edaHealth(){const env=parseEnv(readFileSync('/etc/vibehard/eda-manager.env','utf8'));const token=readFileSync(env.EDA_MANAGER_TOKEN_FILE,'utf8').trim();const response=await fetch(`http://127.0.0.1:${env.EDA_MANAGER_PORT||6083}/health`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(5000)});assert.equal(response.status,200);return true;}
const cleanup=()=>{for(const unit of candidate){run('systemctl',['stop',unit]);assert.equal(prop(unit,'MainPID'),'0');spawnSync('systemctl',['reset-failed',unit]);}};
async function restore(){idle();run('systemctl',['stop',...units]);for(const u of units)copyFileSync(`${root}/backup/${u}`,`/etc/systemd/system/${u}`);run('systemctl',['daemon-reload']);run('systemctl',['start',...starts]);await ready(3210);verifyWeb('https://ldcx.tech');}
if(mode==='prepare'){
  assert.ok(isCandidate);
  assert.equal(prop('vibehard.service','WorkingDirectory'),`${previous}/standalone`);
  mkdirSync(`${root}/evidence`,{mode:0o700});
  if(!existsSync(state)){
    assert.equal(query('postgres',`select count(*) from pg_database where datname='${dbName}';`),'0');mkdirSync(state,{mode:0o700});
    const password=randomBytes(32).toString('hex');query('postgres',`CREATE ROLE ${dbName} LOGIN PASSWORD '${password}'; CREATE DATABASE ${dbName} OWNER ${dbName};`);
    const env={...platform,DATABASE_URL:`postgres://${dbName}:${password}@127.0.0.1:5432/${dbName}`,LLM_SETTINGS_SECRET:platform.LLM_SETTINGS_SECRET||platform.SESSION_SECRET,SESSION_SECRET:randomBytes(32).toString('hex'),RUNNER_REGISTRATION_TOKEN:randomBytes(32).toString('hex'),INVITE_CODES:randomBytes(32).toString('hex'),NODE_ENV:'production',NEXT_PUBLIC_BASE_PATH:'/vibehard',VIBEHARD_RETRIEVAL_SOCKET:socket};
    writeFileSync(`${state}/candidate.env`,Object.entries(env).map(([k,v])=>`${k}=${JSON.stringify(v)}`).join('\n')+'\n',{mode:0o600});
  }
  const env=parseEnv(readFileSync(`${state}/candidate.env`,'utf8'));assert.equal(new URL(env.DATABASE_URL).pathname,`/${dbName}`);
  run(node,[`${root}/services/migrate.cjs`],{cwd:`${root}/source`,env:{...process.env,...env}});
  // Resume only an unused, known isolated preparation; never overwrite an acceptance or production database.
  assert.equal(query(dbName,'select count(*) from users;'),'0');assert.equal(query(dbName,'select count(*) from projects;'),'0');
  for(const table of ['llm_settings','model_profiles','shared_knowledge']){
    const rows=JSON.parse(query('vibehard',`select coalesce(json_agg(t),'[]'::json) from ${table} t;`));
    for(const row of rows){if(table==='shared_knowledge')row.created_by=null;query(dbName,`insert into ${table} select * from json_populate_record(null::${table},'${JSON.stringify(row).replaceAll("'","''")}') on conflict do nothing;`);}
    assert.equal(query(dbName,`select count(*) from ${table};`),String(rows.length));
  }
  save('prepared',{at:new Date().toISOString(),database:dbName,noProductionMigration:true,protection:protect()});console.log('Isolated database prepared; no user/project data copied');
}
if(mode==='candidate'){
  assert.ok(isCandidate);
  for(const u of candidate)assert.notEqual(prop(u,'ActiveState'),'active');
  const start=(unit,properties,args)=>run('systemd-run',[`--unit=${unit}`,...properties.map(p=>`--property=${p}`),...args]);
  start(candidate[2],['DynamicUser=true','Group=vibehard-retrieval','SupplementaryGroups=vibehard-knowledge','RuntimeDirectory=vibehard-material-lock-candidate','RuntimeDirectoryMode=0750',`WorkingDirectory=${root}`,'MemoryMax=384M','CPUQuota=50%','TasksMax=16','NoNewPrivileges=true','ProtectSystem=strict','ProtectHome=true','RestrictAddressFamilies=AF_UNIX','IPAddressDeny=any'],['--setenv=VIBEHARD_INDEX_CONTROL=/opt/vibehard/knowledge/control/current.json','--setenv=VIBEHARD_DISABLED_SOURCES_FILE=/opt/vibehard/knowledge/control/disabled.json',`--setenv=VIBEHARD_RETRIEVAL_SOCKET=${socket}`,node,`${root}/services/knowledge-retrieval.cjs`]);
  start(candidate[1],['DynamicUser=true','SupplementaryGroups=vibehard-retrieval',`WorkingDirectory=${root}`,`EnvironmentFile=${state}/candidate.env`,'MemoryMax=384M','CPUQuota=50%','NoNewPrivileges=true','ProtectSystem=strict','ProtectHome=true'],[node,`${root}/services/design-worker.cjs`]);
  start(candidate[0],[`WorkingDirectory=${root}/standalone`,`EnvironmentFile=${state}/candidate.env`,'EnvironmentFile=/etc/vibehard/project-archive.env','EnvironmentFile=/etc/vibehard/eda-platform.env','MemoryMax=768M','CPUQuota=100%'],['--setenv=HOSTNAME=127.0.0.1','--setenv=PORT=3211',node,'server.js']);
  await ready(3211);verifyWeb('http://127.0.0.1:3211');console.log(run(node,[`${root}/source/scripts/verify-pdf-standalone.mjs`,`${root}/standalone`]));
  const load=JSON.parse(run(node,[`${root}/services/accept-retrieval-load.cjs`],{env:{...process.env,VIBEHARD_RETRIEVAL_SOCKET:socket}}).split('\n').at(-1));assert.ok(load.passed);
  assert.ok(Number(prop(candidate[2],'MemoryPeak'))<384*1024**2);
  save('candidate-load',load);save('preflight',{passed:true,sourceCommit:manifest.gitCommit,retrieval:await queryIndex(socket)});checkProtection(JSON.parse(readFileSync(`${root}/evidence/prepared.json`)).protection);
}
if(mode==='cleanup')cleanup();
if(mode==='rollback')await restore();
if(mode==='activate'){
  assert.ok(!isCandidate && !manifest.candidateWorkingTree);
  const tested=JSON.parse(readFileSync(`${candidateRoot}/RELEASE.json`));
  for(const [p,h] of Object.entries(tested.sourceSha256))assert.equal(manifest.sourceSha256[p],h,`Untested source changed: ${p}`);
  assert.equal(prop('vibehard-knowledge-retrieval.service','WorkingDirectory'),retrievalPrevious);
  assert.equal(prop('vibehard.service','WorkingDirectory'),`${previous}/standalone`);idle();
  assert.ok(JSON.parse(readFileSync(`${candidateRoot}/evidence/preflight.json`)).passed);assert.ok(JSON.parse(readFileSync(`${candidateRoot}/evidence/candidate-acceptance.json`)).passed);
  cleanup();mkdirSync(`${root}/evidence`,{mode:0o700});assert.ok(!existsSync(`${root}/backup`));mkdirSync(`${root}/backup`,{mode:0o700});
  for(const u of units)copyFileSync(`/etc/systemd/system/${u}`,`${root}/backup/${u}`);
  const url=new URL(platform.DATABASE_URL);const pg={...process.env,PGHOST:url.hostname,PGPORT:url.port||'5432',PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password)};
  run('pg_dump',['-Fc','-f',`${root}/backup/platform.dump`,'vibehard'],{env:pg});assert.ok(run('pg_restore',['--list',`${root}/backup/platform.dump`]).includes('TABLE DATA public users'));
  const protection=protect();writeFileSync(`${root}/backup/BACKUP.json`,JSON.stringify({at:new Date().toISOString(),sha256:hash(`${root}/backup/platform.dump`),edaLink:readlinkSync('/opt/vibehard/eda-manager/current'),protection}),{mode:0o600});
  try{
    run('systemctl',['stop','vibehard.service']);idle();run('systemctl',['stop',...units.slice(1)]);
    for(const u of units){const text=readFileSync(`${root}/backup/${u}`,'utf8');assert.ok(text.includes(oldRoots[u]),`Unexpected unit: ${u}`);writeFileSync(`/etc/systemd/system/${u}`,text.replaceAll(oldRoots[u],root),{mode:0o644});}
    run('systemctl',['daemon-reload']);
    run('systemctl',['start',starts[0]]);await readyIndex('/run/vibehard-knowledge/search.sock');
    run('systemctl',['start',starts[1]]);await ready(3210);run('systemctl',['start',starts[2]]);
    for(let n=0;n<40;n++){if(query('vibehard',"select count(*) from runner_nodes where runner_key='cloud-runner' and last_heartbeat_at>now()-interval '30 seconds' and capabilities @> '[\"project-documents-v1\"]'::jsonb;")==='1')break;await new Promise(r=>setTimeout(r,500));}
    assert.equal(query('vibehard',"select count(*) from runner_nodes where runner_key='cloud-runner' and last_heartbeat_at>now()-interval '30 seconds' and capabilities @> '[\"project-documents-v1\"]'::jsonb;"),'1');
    assert.ok(run('ss',['-Htn','state','established','( sport = :8787 )']).length);
    await queryIndex('/run/vibehard-knowledge/search.sock');await edaHealth();verifyWeb('http://127.0.0.1:3210');verifyWeb('https://ldcx.tech');checkProtection(protection);
    for(const u of units){assert.equal(prop(u,'ActiveState'),'active');assert.equal(prop(u,'NRestarts'),'0');}
    const report={at:new Date().toISOString(),release:manifest.release,commit:manifest.gitCommit,noDatabaseMigration:true,protectionPreserved:true,pids:Object.fromEntries(units.map(u=>[u,prop(u,'MainPID')]))};
    writeFileSync(`${root}/ACTIVATED.json`,JSON.stringify(report,null,2),{mode:0o600});console.log(JSON.stringify(report));
  }catch(error){await restore();throw error;}
}
if(mode==='verify'){
  for(const u of units){assert.equal(prop(u,'ActiveState'),'active');assert.equal(prop(u,'NRestarts'),'0');assert.ok(readFileSync(`/etc/systemd/system/${u}`,'utf8').includes(root));}
  assert.equal(query('vibehard',"select count(*) from runner_nodes where runner_key='cloud-runner' and last_heartbeat_at>now()-interval '30 seconds';"),'1');
  assert.ok(run('ss',['-Htn','state','established','( sport = :8787 )']).length);
  assert.ok(JSON.parse(readFileSync(`${root}/evidence/production-acceptance.json`)).passed);
  checkProtection(JSON.parse(readFileSync(`${root}/backup/BACKUP.json`)).protection);verifyWeb('https://ldcx.tech');await edaHealth();
  save('final',{passed:true,at:new Date().toISOString(),retrieval:await queryIndex('/run/vibehard-knowledge/search.sock'),disk:run('df',['-h','/'])});console.log('Materials production verification passed');
}
