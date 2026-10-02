// Chromium navigation check. Local uses only a synthetic session; public uses no account.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
const require=createRequire(import.meta.url), WS=require('ws');
const origin=process.argv[2], output=process.argv[3];
const local=new URL(origin).hostname==='127.0.0.1';
assert.ok(local || origin==='https://ldcx.tech');
assert.ok(process.env.TOOLS_TEST_CHROMIUM,'Set the existing Chromium executable');
const chrome=spawn(process.env.TOOLS_TEST_CHROMIUM,['--headless','--no-sandbox','--remote-debugging-port=9240','--user-data-dir=/private/tmp/vibehard-tools-fix/instrument-browser-profile','about:blank'],{stdio:'ignore'});
let socket;
try {
 let tabs;for(let i=0;i<30;i++){try{tabs=await(await fetch('http://127.0.0.1:9240/json/list')).json();break;}catch{}await new Promise(r=>setTimeout(r,200));}
 assert.ok(tabs?.length);socket=new WS(tabs[0].webSocketDebuggerUrl);await new Promise(r=>socket.on('open',r));
 let sequence=0;const pending=new Map(),documents=[];
 socket.on('message',raw=>{const m=JSON.parse(raw);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}}else if(m.method==='Network.requestWillBeSent'&&m.params.type==='Document')documents.push(m.params.request.url);});
 const cmd=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const r=await cmd('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});assert.ok(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;};
 async function until(expression){for(let i=0;i<120;i++){try{const value=await evaluate(`Boolean(${expression})`);if(value)return value;}catch{}await new Promise(r=>setTimeout(r,100));}throw Error(`Browser wait timed out: ${expression}; state=${JSON.stringify(await evaluate('({url:location.href,frames:[...document.querySelectorAll("iframe")].map(f=>({src:f.src,text:f.contentDocument?.body?.innerText?.slice(0,100)})),text:document.body.innerText.slice(0,300)})'))}`);}
 await cmd('Runtime.enable');await cmd('Page.enable');await cmd('Network.enable');await cmd('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 const results=[];
 for(const mode of ['embedded','standalone']) for(const [slug,button,state] of [
  ['oscilloscope','runStopBtn',"d.getElementById('runStopStateLabel').textContent"],
  ['multimeter','holdBtn',"d.getElementById('holdBtn').getAttribute('aria-pressed')"],
  ['waveform-generator','hotPower',"d.getElementById('hotPower').classList.contains('active')"],
 ]) {
  const wrapper=mode==='embedded'?"document.getElementById('instrument-fixture').contentDocument":"document";
  const lab=`${wrapper}.querySelector('iframe').contentDocument`;
  const url=origin+`/vibehard/zutils/tools/${slug}/index.html?v=instrument-v1`;
  async function open(){
   await cmd('Page.navigate',{url:mode==='embedded'?origin+'/vibehard/login':url});
   await until('document.readyState === "complete"');
   if(mode==='embedded') await evaluate(`(()=>{const f=document.createElement('iframe');f.id='instrument-fixture';f.style='display:block;width:1700px;height:1200px';f.src=${JSON.stringify(url)};document.body.replaceChildren(f);})()`);
   await until(`${lab}?.getElementById(${JSON.stringify(button)})`);
   await new Promise(r=>setTimeout(r,700));
  }
  await open();
  const innerUrl=await evaluate(`${wrapper}.querySelector('iframe').src`);
  assert.ok(new URL(innerUrl).pathname.startsWith('/vibehard/zutils/labs/'));
  assert.ok(!(await evaluate(`${lab}.body.innerText`)).includes('404 Not Found'));
  async function click(expression){
   const point=await evaluate(`(()=>{const d=${lab};const e=${expression};e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect(),f=${wrapper}.querySelector('iframe'),a=f.getBoundingClientRect(),outer=${mode==='embedded'?"document.getElementById('instrument-fixture').getBoundingClientRect()":"({left:0,top:0})"};return {x:outer.left+a.left+r.left+r.width/2,y:outer.top+a.top+r.top+r.height/2};})()`);
   await cmd('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});
   await cmd('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});
  }
  const before=await evaluate(`(()=>{const d=${lab};return ${state};})()`);
  await click(`d.getElementById(${JSON.stringify(button)})`);
  await until(`(()=>{const d=${lab};return ${state} !== ${JSON.stringify(before)};})()`);
  const after=await evaluate(`(()=>{const d=${lab};return ${state};})()`);
  const images=await evaluate(`[...${lab}.images].map(i=>({src:i.src,loaded:i.complete&&i.naturalWidth>0}))`);
  assert.ok(images.every(i=>i.loaded),JSON.stringify(images));
  // Vendor fullscreen toggle re-renders the wrapper; hydrated src must remain correct.
  await evaluate(`(()=>{const d=${wrapper};[...d.querySelectorAll('button')].find(b=>b.textContent.includes('占满页面')).click();})()`);
  await until(`${lab}?.getElementById(${JSON.stringify(button)})`);
  assert.equal(await evaluate(`${wrapper}.querySelector('iframe').src`),innerUrl);
  await evaluate(`(()=>{const d=${wrapper};[...d.querySelectorAll('button')].find(b=>b.textContent.includes('退出')).click();})()`);
  await until(`${lab}?.getElementById(${JSON.stringify(button)})`);
  await cmd('Page.reload');await until('document.readyState === "complete"');
  if(mode==='standalone') await until(`${lab}?.getElementById(${JSON.stringify(button)})`);
  else await open();
  results.push({slug,mode,innerUrl,control:button,before,after,images,fullscreen:true,reload:true});
 }
 const evidence={origin,instruments:results};if(output)await writeFile(output,JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));
}finally{socket?.close();chrome.kill();}
