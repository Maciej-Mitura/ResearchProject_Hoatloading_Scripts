import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const [out, phase, mode] = process.argv.slice(2);
const profile = await mkdtemp(join(tmpdir(),'runlattice-polish-'));
const edge = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
 ['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=9239','--user-data-dir='+profile,'about:blank'],
 {windowsHide:true,stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let ws;
const evidence={};
try {
 let target;
 for(let i=0;i<40;i++){try {target=(await (await fetch('http://127.0.0.1:9239/json/list')).json()).find(x=>x.type==='page'); if(target)break;}catch{} await sleep(250);}
 if(!target)throw Error('Edge debugging endpoint unavailable');
 ws=new WebSocket(target.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
 let next=0;const pending=new Map();
 ws.onmessage=e=>{const v=JSON.parse(e.data); const cb=pending.get(v.id);if(cb){pending.delete(v.id);v.error?cb.reject(v.error):cb.resolve(v.result);}};
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++next;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 const dom=async expression=>{const x=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(x.exceptionDetails)throw Error(x.exceptionDetails.exception?.description);return x.result.value;};
 const viewport=(width,height)=>send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
 const wait=async expression=>{for(let i=0;i<30;i++){if(await dom("Boolean("+expression+")"))return true;await sleep(100);}return false;};
 const click=async (text,sel='button,summary')=>dom(`(()=>{const el=[...document.querySelectorAll(${JSON.stringify(sel)})].find(e=>e.getClientRects().length&&e.textContent.trim().includes(${JSON.stringify(text)}));if(!el)return false;el.click();return true})()`);
 const go=async hash=>{await dom(`location.hash=${JSON.stringify(hash)}; true`);await sleep(450);};
 const shot=async(name, selector)=>{if(selector)await dom(`document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({block:'start'}); true`);else await dom('scrollTo(0,0); true');await sleep(150);const s=await send('Page.captureScreenshot',{format:'png'});await writeFile(join(out,phase+'-'+name+'.png'),Buffer.from(s.data,'base64'));};
 const search=async value=>{await dom(`(()=>{const e=document.querySelector('#script-search');if(e){Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));}return !!e})()`);};
 await viewport(1440,1000);
 await send('Page.navigate',{url:'http://localhost:15173/'});
 if(!await wait("document.querySelector('.cm-editor') && document.querySelector('#script-search')"))throw Error('Workbench unavailable');
 await sleep(500);
 await search('metrics-summary-broadcast');
 evidence.project=await click('metrics-summary-broadcast');
 if(evidence.project)await wait("document.querySelector('[aria-label=\"Project files\"]')");
 await shot('workbench-light');
 await dom("document.querySelector('[aria-label=\"Use dark theme\"]')?.click();true");
 await shot('workbench-dark');
 const press=async (key,code,n)=>{await send('Input.dispatchKeyEvent',{type:'rawKeyDown',key,code,windowsVirtualKeyCode:n});await send('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:n});};
 await send('Emulation.setFocusEmulationEnabled',{enabled:true});
 await dom("(()=>{const b=document.querySelector('.profile-control .info-trigger');b?.blur();b?.focus();return document.activeElement===b})()");
 evidence.profileTooltipByFocus=await wait("document.querySelector('[role=tooltip]')?.textContent.includes('Execution profile')");
 if(!evidence.profileTooltipByFocus)await click('i','.profile-control .info-trigger');
 evidence.profileTooltip=await wait("document.querySelector('[role=tooltip]')?.textContent.includes('Execution profile')");
 if(evidence.profileTooltip){await shot('profile-tooltip');await press('Escape','Escape',27);evidence.tooltipEscape=await wait("!document.querySelector('[role=tooltip]')");}
 await dom("document.querySelector('[role=tab][aria-selected=true]')?.focus();true");
 await press('ArrowRight','ArrowRight',39);
 evidence.keyboardTabs=await dom("document.activeElement?.getAttribute('role')==='tab' && document.activeElement?.getAttribute('aria-selected')==='true' && document.activeElement?.textContent.includes('utils/summary.ts')");
 evidence.tabs=await click('utils/summary.ts','[role=tab]');
 await shot('editor','.editor-filebar');
 evidence.permissions=await click('Review permissions');
 if(evidence.permissions){await shot('permission-review');evidence.unchecked=await dom("[...document.querySelectorAll('dialog[open] input[type=checkbox]')].every(el=>!el.checked)");await send('Input.dispatchKeyEvent',{type:'rawKeyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape'});await sleep(100);}
 evidence.assistant=await click('Open assistant');
 await shot('assistant','.assistant-panel');
 evidence.completed=await click('View in Execution Insights');
 if(evidence.completed){
  await wait("document.querySelector('.execution-detail')");
  await shot('completed','.execution-detail');
  await dom("(()=>{const create=URL.createObjectURL.bind(URL);URL.createObjectURL=blob=>{window.exportCheck=blob.text().then(text=>{const x=JSON.parse(text);return Boolean(x.executionId && x.manifest && Array.isArray(x.actualCalls));});return create(blob)};return true})()");
  evidence.export=await click('Export capability evidence JSON');
  if(evidence.export)evidence.exportPayload=await dom('window.exportCheck');
 }
 await go('insights');await shot('insights');
 for(const kind of ['failed','terminated']){
  const ok=await dom(`(()=>{const b=[...document.querySelectorAll('.history-table tbody button')].find(e=>e.getAttribute('aria-label')?.includes(${JSON.stringify(kind)}));b?.click();return !!b})()`);
  evidence[kind]=ok;
  if(ok){await sleep(400);await shot(kind,'.execution-detail');}
 }
 await go('host');await shot('host');
 await go('settings');await shot('settings');
 if(await click('How to use')){await shot('help');await press('Escape','Escape',27);evidence.helpEscape=await wait("!document.querySelector('dialog[open]')");}
 for(const route of ['insights','host','settings']){
  await go(route);
  await dom("document.querySelector('[aria-label=\"Use light theme\"]')?.click();true");
  await shot(route+'-light');
  await dom("document.querySelector('[aria-label=\"Use dark theme\"]')?.click();true");
 }
 await go('workbench');
 if(await click('What are the limits?')){await wait("document.querySelector('.limit-capability')");await shot('limits');await viewport(768,1000);await shot('limits-tablet');await viewport(390,844);await shot('limits-mobile');await click('Close limits');}
 await shot('workbench-mobile');
 evidence.mobileNoPageOverflow=await dom('document.documentElement.scrollWidth<=innerWidth');
 await viewport(768,1000);await go('insights');await shot('insights-tablet');
 evidence.tabletNoPageOverflow=await dom('document.documentElement.scrollWidth<=innerWidth');
 await viewport(1440,1000);await go('workbench');
 await search('SayingHelloWorld');
 if(await click('SayingHelloWorld')){await sleep(450);if(await click('View in Execution Insights')){await wait("document.querySelector('.execution-detail')");await shot('timeout','.execution-error-card');evidence.timeout=await dom("document.querySelector('.execution-error-card')?.textContent.includes('time')");}}
 delete evidence.terminated;
 if(mode==='reuse-run'){
  const prior=JSON.parse(await readFile(join(out,phase+'-browser.json'),'utf8'));
  evidence.progress=prior.progress;
  evidence.run=prior.run;
 }else{
  await go('workbench');await search('compat console');
  if(await click('compat console')){await sleep(450);const ran=await click('Run','[aria-describedby="run-help"]');if(ran){if(await wait("document.querySelector('.workbench-execution .execution-activity')")){await shot('progress','.workbench-execution');evidence.progress=true;}evidence.run=await wait("document.querySelector('.workbench-execution .run-completed')");}}
 }
 await writeFile(join(out,phase+'-browser.json'),JSON.stringify(evidence,null,2));
 console.log(evidence);
} finally {ws?.close();edge.kill();}


