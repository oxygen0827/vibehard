// Only platform/Runner/Gateway change. No production DDL, credentials, board writes or unrelated restarts.
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
const root=process.env.DEVICE_RELEASE_ROOT??'/opt/vibehard/releases/20261001-browser-device-report-v1';
assert.match(root,/^\/opt\/vibehard\/releases\/20261001-browser-device-report(?:-v1|-candidate-v2)$/);
const previous='/opt/vibehard/releases/20260930-project-material-lock-v1';
const priorServices='/opt/vibehard/releases/20260930-unified-platform-v2';
const state='/opt/vibehard/test-state/20261001-browser-device-report';
const candidate='vibehard-device-report-candidate-20261001.service';
const node='/opt/vibehard/runtime/node-v22.23.1';
const units=['vibehard.service','vibehard-runner.service','vibehard-gateway.service'];
const preserved=['vibehard-design-worker.service','vibehard-knowledge-retrieval.service','vibehard-eda-manager.service','vibeboard.service'];
const mode=process.argv[2];assert.equal(process.getuid(),0);assert.ok(['prepare','candidate','activate','rollback','cleanup'].includes(mode));
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const run=(c,a,o={})=>{const r=spawnSync(c,a,{encoding:'utf8',timeout:300000,maxBuffer:16*1024*1024,...o});assert.equal(r.status,0,`${c} ${a[0]??''} failed; details suppressed`);return r.stdout.trim();};
const prop=(u,p)=>run('systemctl',['show',u,'-p',p,'--value']);
const query=(db,sql)=>run('runuser',['-u','postgres','--','psql','-XAt','-v','ON_ERROR_STOP=1','-d',db],{input:sql});
const idle=()=>{assert.equal(query('vibehard',"select count(*) from design_jobs where status in ('queued','running');"),'0','Design tasks active');assert.equal(query('vibehard',"select count(*) from agent_turns where status in ('queued','running','waiting_approval');"),'0','Agent tasks active');};
const manifest=JSON.parse(readFileSync(`${root}/RELEASE.json`));
const oldManifest=JSON.parse(readFileSync(`${previous}/RELEASE.json`));
for(const [file,h] of Object.entries(oldManifest.sourceSha256)){
 assert.ok(manifest.sourceSha256[file],`Missing published file ${file}`);
 if(/^(app\/demo|public\/demo|app\/app\/pcb|components\/pcb)\//.test(file)||file==='next.config.ts')assert.equal(manifest.sourceSha256[file],h,file);
}
for(const [file,h] of Object.entries(manifest.sourceSha256))assert.equal(hash(`${root}/source/${file}`),h,file);
for(const [file,h] of Object.entries(manifest.artifacts))assert.equal(hash(`${root}/services/${file}`),h,file);
const platform=parseEnv(readFileSync('/etc/vibehard/platform.env','utf8'));
assert.equal(new URL(platform.DATABASE_URL).pathname,'/vibehard');
const protectedConfig=['/etc/vibehard/platform.env','/etc/vibehard/runner.env','/etc/vibehard/model.env','/etc/vibehard/eda-platform.env','/var/lib/vibehard-runner/credential.json'].filter(existsSync);
const ready=async(port)=>{for(let i=0;i<35;i++){try{if((await fetch(`http://127.0.0.1:${port}/vibehard/login`,{signal:AbortSignal.timeout(1000)})).status===200)return;}catch{}await new Promise(r=>setTimeout(r,1000));}throw Error('Platform unavailable');};
const verify=origin=>{console.log(run(node,[`${root}/source/scripts/verify-frontend-release.mjs`,origin,`${root}/standalone`]));console.log(run(node,[`${root}/source/scripts/verify-bom-release.mjs`,origin]));};
const cleanup=()=>{run('systemctl',['stop',candidate]);};
async function restore(){
 // Never revert to a parser unable to read a report already saved by a real user.
 assert.equal(query('vibehard',"select count(*) from project_documents where mime_type='application/vnd.vibehard.device-report+json';"),'0','New reports exist: keep compatible backend; use a forward fix, not old-parser rollback');
 for(const u of units)run('systemctl',['stop',u]);for(const u of units)copyFileSync(`${root}/backup/${u}`,`/etc/systemd/system/${u}`);run('systemctl',['daemon-reload']);run('systemctl',['start',...units.slice().reverse()]);await ready(3210);
}
if(mode==='prepare'){
 assert.equal(prop('vibehard.service','WorkingDirectory'),`${previous}/standalone`);
 assert.ok(!existsSync(state),'Do not overwrite candidate state');mkdirSync(state,{mode:0o700});mkdirSync(`${root}/evidence`,{mode:0o700});
 const name='vibehard_device_acceptance_20261001';const password=randomBytes(32).toString('hex');
 assert.equal(query('postgres',`select count(*) from pg_database where datname='${name}';`),'0');
 query('postgres',`CREATE ROLE ${name} LOGIN PASSWORD '${password}'; CREATE DATABASE ${name} OWNER ${name};`);
 const vars={...platform,DATABASE_URL:`postgres://${name}:${password}@127.0.0.1:5432/${name}`,LLM_SETTINGS_SECRET:platform.LLM_SETTINGS_SECRET||platform.SESSION_SECRET,SESSION_SECRET:randomBytes(32).toString('hex'),RUNNER_REGISTRATION_TOKEN:randomBytes(32).toString('hex'),INVITE_CODES:randomBytes(32).toString('hex'),NODE_ENV:'production',NEXT_PUBLIC_BASE_PATH:'/vibehard'};
 writeFileSync(`${state}/candidate.env`,Object.entries(vars).map(([k,v])=>`${k}=${JSON.stringify(v)}`).join('\n')+'\n',{mode:0o600});
 run(node,[`${root}/services/migrate.cjs`],{cwd:`${root}/source`,env:{...process.env,...vars}});
 for(const table of ['llm_settings','model_profiles']){
   const rows=JSON.parse(query('vibehard',`select coalesce(json_agg(t),'[]'::json) from ${table} t;`));
   for(const row of rows)query(name,`insert into ${table} select * from json_populate_record(null::${table},'${JSON.stringify(row).replaceAll("'","''")}');`);
 }
 console.log(JSON.stringify({prepared:true,isolatedDatabase:name,noUserDataCopied:true}));
}
if(mode==='candidate'){
 assert.notEqual(prop(candidate,'ActiveState'),'active');assert.ok(existsSync('/etc/vibehard/project-archive.env'));mkdirSync(`${root}/evidence`,{recursive:true,mode:0o700});
 run('systemd-run',[`--unit=${candidate}`,`--property=WorkingDirectory=${root}/standalone`,`--property=EnvironmentFile=${state}/candidate.env`,'--property=EnvironmentFile=/etc/vibehard/project-archive.env','--property=EnvironmentFile=/etc/vibehard/eda-platform.env','--property=MemoryMax=768M','--property=CPUQuota=100%','--setenv=HOSTNAME=127.0.0.1','--setenv=PORT=3211','--setenv=NODE_ENV=production','--setenv=VIBEHARD_PUBLIC_ORIGIN=http://127.0.0.1:3211','--setenv=VIBEHARD_RETRIEVAL_SOCKET=/run/vibehard-knowledge/search.sock',node,'server.js']);
 await ready(3211);verify('http://127.0.0.1:3211');console.log(run(node,[`${root}/source/scripts/verify-pdf-standalone.mjs`,`${root}/standalone`]));console.log(JSON.stringify({candidateReady:true}));
}
if(mode==='cleanup')cleanup();
if(mode==='rollback'){idle();assert.equal(prop('vibehard.service','WorkingDirectory'),`${root}/standalone`);await restore();console.log('Prior units restored; no production records removed');}
if(mode==='activate'){
 assert.equal(root,'/opt/vibehard/releases/20261001-browser-device-report-v1');assert.equal(manifest.candidateWorkingTree,false);
 assert.equal(prop('vibehard.service','WorkingDirectory'),`${previous}/standalone`);idle();
 assert.equal(JSON.parse(readFileSync(`${root}/evidence/candidate-acceptance.json`)).passed,true);
 assert.ok(!existsSync(`${root}/backup`));mkdirSync(`${root}/backup`,{mode:0o700});
 for(const u of units)copyFileSync(`/etc/systemd/system/${u}`,`${root}/backup/${u}`);
 const url=new URL(platform.DATABASE_URL);const pg={...process.env,PGHOST:url.hostname,PGPORT:url.port||'5432',PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password)};
 run('pg_dump',['-Fc','-f',`${root}/backup/platform.dump`,'vibehard'],{env:pg});assert.ok(run('pg_restore',['--list',`${root}/backup/platform.dump`]).includes('TABLE DATA public users'));
 const protection={pids:Object.fromEntries(preserved.map(u=>[u,prop(u,'MainPID')])),configs:Object.fromEntries(protectedConfig.map(p=>[p,hash(p)])),nginx:run('docker',['inspect','nginx','--format','{{.State.Pid}}'])};
 writeFileSync(`${root}/backup/BACKUP.json`,JSON.stringify({at:new Date().toISOString(),sha256:hash(`${root}/backup/platform.dump`),protection}),{mode:0o600});
 try{
   idle();run('systemctl',['stop','vibehard.service']);idle();run('systemctl',['stop','vibehard-runner.service','vibehard-gateway.service']);
   for(const u of units){let text=readFileSync(`${root}/backup/${u}`,'utf8');
     if(u==='vibehard.service'){assert.ok(text.includes(previous));text=text.replaceAll(previous,root).replace('[Service]','[Service]\nEnvironment=VIBEHARD_PUBLIC_ORIGIN=https://ldcx.tech');}
     if(u==='vibehard-runner.service'){const from=`${priorServices}/services/runner.cjs`;assert.ok(text.includes(from));text=text.replace(from,`${root}/services/runner.cjs`);}
     if(u==='vibehard-gateway.service'){assert.ok(text.includes(priorServices));text=text.replaceAll(priorServices,root);}
     writeFileSync(`/etc/systemd/system/${u}`,text,{mode:0o644});
   }
   run('systemctl',['daemon-reload']);run('systemctl',['start','vibehard-gateway.service','vibehard-runner.service','vibehard.service']);await ready(3210);
   const heartbeat="select count(*) from runner_nodes where runner_key='cloud-runner' and last_heartbeat_at>now()-interval '30 seconds' and capabilities @> '[\"project-device-reports-v1\"]'::jsonb;";
   for(let i=0;i<35;i++){if(query('vibehard',heartbeat)==='1')break;await new Promise(r=>setTimeout(r,1000));}
   assert.equal(query('vibehard',heartbeat),'1');assert.ok(run('ss',['-Htn','state','established','( sport = :8787 )']).length);verify('http://127.0.0.1:3210');verify('https://ldcx.tech');
   for(const u of units){assert.equal(prop(u,'ActiveState'),'active');assert.equal(prop(u,'NRestarts'),'0');}
   for(const [u,pid] of Object.entries(protection.pids))assert.equal(prop(u,'MainPID'),pid);for(const [p,h] of Object.entries(protection.configs))assert.equal(hash(p),h);
   assert.equal(run('docker',['inspect','nginx','--format','{{.State.Pid}}']),protection.nginx);
   const report={activated:manifest.release,commit:manifest.gitCommit,at:new Date().toISOString(),migration:null,freshRunnerAndLiveConnection:true,pids:Object.fromEntries(units.map(u=>[u,prop(u,'MainPID')])),backupSha256:hash(`${root}/backup/platform.dump`)};
   writeFileSync(`${root}/ACTIVATED.json`,JSON.stringify(report,null,2),{mode:0o600});console.log(JSON.stringify(report));
 }catch(error){await restore();console.error('Activation failed; previous units restored');throw error;}finally{cleanup();}
}
