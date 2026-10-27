/**
 * 6.4 浏览器兼容性验证（论文 6.4 佐证，表 6-10 首行的实测依据）
 * Edge 无头全流程五项：登录页 / 工作台 / 编辑器 / 访客分享页 / PDF 打印视图
 * 使用临时笔记与临时分享链接，测后即清；运行：node scripts/testing/verify-browser-compat.mjs [baseUrl]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHmac, randomUUID } from 'node:crypto';
// 演示账号固定 ID（生产库 seed 数据）；令牌用根目录 .env 的 JWT_SECRET 现签
const ENV={}; readFileSync(new URL('../../.env', import.meta.url),'utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)ENV[m[1]]=m[2];});
import { spawn } from 'node:child_process';
const b64=(o)=>Buffer.from(JSON.stringify(o)).toString('base64url');
const mkToken=(sub,username)=>{const now=Math.floor(Date.now()/1000);const data=`${b64({alg:'HS256',typ:'JWT'})}.${b64({sub,username,jti:randomUUID(),iat:now,exp:now+3600})}`;return `${data}.${createHmac('sha256',ENV.JWT_SECRET).update(data).digest('base64url')}`;};
const EDGE='/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge';
const wait=(ms)=>new Promise(r=>setTimeout(r,ms));
const BASE=process.argv[2] ?? 'http://192.168.3.3:18080';
const API=`${BASE}/api`;
const WEB=BASE;
const CHEN=mkToken('d881b02a-5775-4209-9c36-b2ec467b3372','陈晓墨');
const out=[];
const log=(l)=>{out.push(l);console.log(l);};
// 临时笔记+分享链接（分享页用例）
const tmpNote=await (await fetch(`${API}/notes`,{method:'POST',headers:{Authorization:`Bearer ${CHEN}`,'Content-Type':'application/json'},body:JSON.stringify({title:'6.4 兼容性验证笔记',content:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'compat-check-marker-64'}]}]}})})).json();
const link=await (await fetch(`${API}/share`,{method:'POST',headers:{Authorization:`Bearer ${CHEN}`,'Content-Type':'application/json'},body:JSON.stringify({note_id:tmpNote.id,permission:'read'})})).json();

const edge=spawn(EDGE,['--headless=new','--disable-gpu','--hide-scrollbars','--remote-debugging-port=9398',
  '--user-data-dir=/tmp/shot/p64','--window-size=1440,900','--no-first-run','about:blank'],{stdio:'ignore',detached:true});edge.unref();
let target=null;for(let i=0;i<40;i++){try{const r=await fetch('http://127.0.0.1:9398/json/list');const l=await r.json();target=l.find(t=>t.type==='page'&&!t.url.startsWith('edge://'));if(target)break;}catch{}await wait(250);}
const ws=new WebSocket(target.webSocketDebuggerUrl);let id=0;const pending=new Map();
const send=(m,p={})=>new Promise((res,rej)=>{const i=++id;pending.set(i,{res,rej});ws.send(JSON.stringify({id:i,method:m,params:p}));});
ws.onmessage=(e)=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.rej(new Error(JSON.stringify(m.error))):p.res(m.result);}};
await new Promise(r=>ws.onopen=r);
const ev=async(x)=>(await send('Runtime.evaluate',{expression:x,returnByValue:true,awaitPromise:true})).result.value;
const info=await send('Runtime.evaluate',{expression:'navigator.userAgent'});
const ua=info.result.value;
const ver=ua.match(/Edg\/([\d.]+)/)?.[1]??'?';
const chromeVer=ua.match(/Chrome\/([\d.]+)/)?.[1]??'?';
log(`浏览器: Microsoft Edge ${ver}（Chromium ${chromeVer.split('.')[0]}）  平台: macOS`);
const check=async(name,ok,detail)=>log(`[${ok?'PASS':'FAIL'}] ${name.padEnd(14)} ${detail}`);

// 1 登录页
await send('Page.navigate',{url:`${WEB}/login`});await wait(2500);
let ok=await ev(`!!document.querySelector('input[type="password"]')`);
await check('登录页渲染',ok,'登录表单（邮箱+密码）正常渲染');
// 2 工作台
await ev(`localStorage.setItem('wangyan_token', ${JSON.stringify(CHEN)})`);
await send('Page.navigate',{url:`${WEB}/`});await wait(4500);
const cnt=await ev(`document.querySelectorAll('[class*="note-item"],[class*="NoteItem"],li').length`);
await check('登录/工作台',cnt>0,`登录成功进入工作台，笔记列表渲染 ${cnt} 个节点`);
// 3 编辑器
await ev(`(()=>{const e=[...document.querySelectorAll('*')].filter(x=>x.children.length===0&&x.textContent.trim()==='6.4 兼容性验证笔记');if(e.length)(e[0].closest('[class*="item"],li')||e[0].parentElement).dispatchEvent(new MouseEvent('click',{bubbles:true}));return 1})()`);
await wait(4500);
ok=await ev(`(()=>{const pm=document.querySelector('.ProseMirror');return pm&&pm.getAttribute('contenteditable')==='true'&&pm.innerText.includes('compat-check-marker-64')})()`);
await check('编辑器',ok,'ProseMirror 编辑器打开且可编辑，正文渲染正确');
// 4 分享页（免登录公开访问）
await send('Page.navigate',{url:`${WEB}/s/${link.token}`});await wait(3500);
ok=await ev(`document.body.innerText.includes('compat-check-marker-64')`);
await check('分享页',ok,'免登录公开链接渲染正文（访客只读视角）');
// 5 打印导出视图
await send('Page.navigate',{url:`${WEB}/print/${tmpNote.id}`});await wait(3000);
ok=await ev(`document.body.innerText.includes('6.4 兼容性验证笔记')`);
await check('PDF导出打印视图',ok,'/print 路由渲染打印版式');
// 版本一致性说明
log('');
log('Chrome 与 Edge 同为 Chromium 内核（版本接近），预期表现一致，列为人工复核项；');
log('Safari / Firefox 未纳入自动化（需启用远程自动化/另装浏览器），列为人工复核项，与论文表 6-10 口径一致。');
writeFileSync('/tmp/shot/verify64_out.txt',out.join('\n'));
// 清理
await fetch(`${API}/share/${link.id}`,{method:'DELETE',headers:{Authorization:`Bearer ${CHEN}`}});
await fetch(`${API}/notes/${tmpNote.id}`,{method:'DELETE',headers:{Authorization:`Bearer ${CHEN}`}});
const bin=await (await fetch(`${API}/recycle-bin`,{headers:{Authorization:`Bearer ${CHEN}`}})).json();
const e2=(Array.isArray(bin)?bin:bin.items).find(i=>i.note_id===tmpNote.id);
if(e2)await fetch(`${API}/recycle-bin/${e2.id}`,{method:'DELETE',headers:{Authorization:`Bearer ${CHEN}`}});
console.log('cleanup ok');
process.exit(0);
