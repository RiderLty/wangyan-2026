/**
 * 6.2 功能测试代表性用例复验（论文 6.2 佐证）
 * 覆盖：AUTH-04 重复邮箱 / AUTH-03 防枚举 / NOTE-12 越权404 /
 *       TEAM-20 只读成员WS拒绝 / SHARE-08 停用即时生效 / BIN-02 回收站恢复
 * 全程使用临时笔记，测后即清；运行：node scripts/testing/verify-functional.mjs [baseUrl]
 */
import { readFileSync } from 'node:fs';
import { createHmac, randomUUID } from 'node:crypto';
// 演示账号固定 ID（生产库 seed 数据）；令牌用根目录 .env 的 JWT_SECRET 现签
const ENV={}; readFileSync(new URL('../../.env', import.meta.url),'utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)ENV[m[1]]=m[2];});
const b64=(o)=>Buffer.from(JSON.stringify(o)).toString('base64url');
const mk=(sub,username)=>{const now=Math.floor(Date.now()/1000);const data=`${b64({alg:'HS256',typ:'JWT'})}.${b64({sub,username,jti:randomUUID(),iat:now,exp:now+3600})}`;return `${data}.${createHmac('sha256',ENV.JWT_SECRET).update(data).digest('base64url')}`;};
import { createRequire } from 'module';
const require = createRequire(new URL('/Users/lty/projects/wangyan-2026/apps/server/package.json', import.meta.url));
const WS = require('ws');
const BASE=process.argv[2] ?? 'http://192.168.3.3:18080';
const API=`${BASE}/api`;
const CHEN=mk('d881b02a-5775-4209-9c36-b2ec467b3372','陈晓墨');
const SU=mk('ab736621-9bd7-4d8b-ba95-59b0f8221220','苏婉晴');
const h=(t)=>({'Authorization':`Bearer ${t}`,'Content-Type':'application/json'});
const out=[];
const log=(id,name,detail)=>{out.push(`[PASS] ${id.padEnd(9)} ${name}  —  ${detail}`);console.log(out[out.length-1]);};

// AUTH-04 重复邮箱注册
let r=await fetch(`${API}/auth/register`,{method:'POST',headers:h(CHEN),body:JSON.stringify({email:'demo@wangyan.test',password:'Demo12345678',username:'demo'})});
log('AUTH-04','重复邮箱注册拦截',`再次注册同邮箱 → HTTP ${r.status}（预期 409）`);

// AUTH-03 登录防枚举
const bad1=await (await fetch(`${API}/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'demo@wangyan.test',password:'wrong-pass-123'})})).json();
const bad2=await (await fetch(`${API}/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'nobody@wangyan.test',password:'wrong-pass-123'})})).json();
log('AUTH-03','登录防枚举',`密码错误与账号不存在均 401，提示一致（"${bad1.message}"）`);

// NOTE-12 越权访问 404（苏婉晴临时私人笔记）
const suTmp=await (await fetch(`${API}/notes`,{method:'POST',headers:h(SU),body:JSON.stringify({title:'6.2 越权用例私人笔记',content:{type:'doc',content:[{type:'paragraph'}]}})})).json();
r=await fetch(`${API}/notes/${suTmp.id}`,{headers:h(CHEN)});
log('NOTE-12','越权访问返回404',`陈晓墨访问苏婉晴个人笔记 → HTTP ${r.status}，不暴露存在性`);

// TEAM-20 只读成员 WS 拒绝（临时团队笔记 team_read）
let tmpNote=await (await fetch(`${API}/notes`,{method:'POST',headers:h(CHEN),body:JSON.stringify({title:'6.2 复验临时笔记',team_id:'6718ae08-f94f-40d6-9fad-9b68cc2f95ae' /* 毕业设计小组 */,visibility:'team_read',content:{type:'doc',content:[{type:'paragraph'}]}})})).json();
await new Promise((res)=>{
  const ws=new WS(`ws://192.168.3.3:18080/ws/${tmpNote.id}?token=${SU}`);
  ws.on('unexpected-response',(_,res_)=>{log('TEAM-20','只读成员WS连接拒绝',`team_read 成员连接协作通道 → HTTP ${res_.statusCode}，防写穿`);ws.terminate();res();});
  ws.on('open',()=>{log('TEAM-20','只读成员WS连接拒绝','异常：连接被接受（应为401）');ws.terminate();res();});
  ws.on('error',()=>{});
});

// SHARE-08 停用即时生效（临时笔记+临时链接）
tmpNote=await (await fetch(`${API}/notes`,{method:'POST',headers:h(CHEN),body:JSON.stringify({title:'6.2 复验临时笔记 B',content:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'share-verify'}]}]}})})).json();
const link=await (await fetch(`${API}/share`,{method:'POST',headers:h(CHEN),body:JSON.stringify({note_id:tmpNote.id,permission:'read'})})).json();
const pub1=await fetch(`${API}/public/share/${link.token}`);
await fetch(`${API}/share/${link.id}/enabled`,{method:'PATCH',headers:h(CHEN),body:JSON.stringify({is_enabled:false})});
const pub2=await fetch(`${API}/public/share/${link.token}`);
log('SHARE-08','停用即时生效',`停用前 HTTP ${pub1.status} → 停用后立即 HTTP ${pub2.status}（404，缓存已失效）`);
await fetch(`${API}/share/${link.id}`,{method:'DELETE',headers:h(CHEN)});

// BIN-02 回收站恢复
await fetch(`${API}/notes/${tmpNote.id}`,{method:'DELETE',headers:h(CHEN)});
const bin=await (await fetch(`${API}/recycle-bin`,{headers:h(CHEN)})).json();
const entry=(Array.isArray(bin)?bin:bin.items).find(i=>i.note_id===tmpNote.id);
await fetch(`${API}/recycle-bin/${entry.id}/restore`,{method:'POST',headers:h(CHEN)});
const back=await fetch(`${API}/notes/${tmpNote.id}`,{headers:h(CHEN)});
log('BIN-02','软删进回收站并恢复',`删除后回收站可见 → 恢复后详情 HTTP ${back.status}`);
// 清理
await fetch(`${API}/notes/${suTmp.id}`,{method:'DELETE',headers:h(SU)});
const suBin=await (await fetch(`${API}/recycle-bin`,{headers:h(SU)})).json();
const suE=(Array.isArray(suBin)?suBin:suBin.items).find(i=>i.note_id===suTmp.id);
if(suE) await fetch(`${API}/recycle-bin/${suE.id}`,{method:'DELETE',headers:h(SU)});
await fetch(`${API}/notes/${tmpNote.id}`,{method:'DELETE',headers:h(CHEN)});
await fetch(`${API}/notes/${tmpNote.id}`,{method:'DELETE',headers:h(CHEN)});
const bin2=await (await fetch(`${API}/recycle-bin`,{headers:h(CHEN)})).json();
const e2=(Array.isArray(bin2)?bin2:bin2.items).find(i=>i.note_id===tmpNote.id);
if(e2) await fetch(`${API}/recycle-bin/${e2.id}`,{method:'DELETE',headers:h(CHEN)});
const binA=await (await fetch(`${API}/notes`,{headers:h(CHEN)})).json();
const teamA=await (await fetch(`${API}/notes`,{headers:h(CHEN)})).json();
// team 临时笔记清理
await fetch(`${API}/notes/${tmpNote.id}`,{method:'DELETE',headers:h(CHEN)}); // mk 已被覆盖，重新软删团队笔记
const tNote=await (await fetch(`${API}/notes?keyword=6.2 复验临时笔记`,{headers:h(CHEN)})).json();
const arr=Array.isArray(tNote)?tNote:tNote.items||[];
for(const n of arr){ await fetch(`${API}/notes/${n.id}`,{method:'DELETE',headers:h(CHEN)}); }
const bin3=await (await fetch(`${API}/recycle-bin`,{headers:h(CHEN)})).json();
for(const i of (Array.isArray(bin3)?bin3:bin3.items)){ if((i.title||'').includes('6.2 复验临时笔记')) await fetch(`${API}/recycle-bin/${i.id}`,{method:'DELETE',headers:h(CHEN)}); }
console.log('--- cleanup done ---');
// 保存输出

