import assert from 'node:assert/strict';
import {createStaticServer} from './server.mjs';
import {decode,validateConfig,mutate,boundary,reportValid,actionVerdict} from './core.mjs';
let checks=0;
const check=(a,b,msg)=>{assert.deepEqual(a,b,msg);checks++;};
const h=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
const p=Buffer.from(JSON.stringify({sub:'alice',email:'alice@test.invalid',exp:2000000000})).toString('base64url');
const jwt=h+'.'+p+'.dummy';
check(decode(jwt).payload.sub,'alice','Decode identity');
check(decode(mutate(jwt,{sub:'bob'})).payload.sub,'bob','Mutation changes claims');
check(decode(mutate(jwt,{sub:'bob'})).signature,decode(jwt).signature,'Mutation leaves signature unchanged');
for(const input of ['e30.bnVsbA.x','e30.W10.x','e30.eyJleHAiOiJzb29uIn0.x','not-a-jwt']){
 assert.throws(()=>decode(input));checks++;
}
check(validateConfig(' https://test-project.supabase.co/ ','sb_publishable_example'),{url:'https://test-project.supabase.co',key:'sb_publishable_example'},'Config normalized');
for(const [url,key] of [['http://test.supabase.co','sb_publishable_x'],['https://attacker.example','sb_publishable_x'],['https://test.supabase.co','sb_secret_x'],['https://test.supabase.co',h+'.'+Buffer.from(JSON.stringify({role:'service_role',exp:2000000000})).toString('base64url')+'.x']]){
 assert.throws(()=>validateConfig(url,key));checks++;
}
const baseline={scope:'project',sub:'bob',rows:1};
check(boundary({ok:true,data:[]},baseline,'project','bob'),'BOUNDARY HELD','Known baseline');
check(boundary({ok:true,data:[]},null,'project','bob'),'NEEDS BASELINE','No baseline');
check(boundary({ok:true,data:[]},baseline,'other-project','bob'),'NEEDS BASELINE','Project-scoped baseline');
check(boundary({ok:true,data:[{user_id:'bob'}]},baseline,'project','bob'),'DATA EXPOSED','Leak flagged');
check(boundary({ok:false,data:{message:'error'}},baseline,'project','bob'),'INCONCLUSIVE','Failure is inconclusive');
const report={owner_id:'alice',generated_at:'2026-10-08T10:00:00Z',notes:[{user_id:'alice',title:'Private note',body:'Invented data'}]};
check(reportValid(report,'alice'),true,'Owner report valid');
check(reportValid(report,'bob'),false,'Wrong owner refused');
check(reportValid({...report,notes:[{user_id:'bob',title:'Private note',body:'Other owner'}]},'alice'),false,'Cross-owner rows refused');
check(reportValid({...report,notes:[]},'alice'),false,'Seeded note required for evidence');
check(reportValid(null,'alice'),false,'Malformed report refused');
check(actionVerdict({status:401,ok:false}),'DENIED','Anonymous authentication refusal');
check(actionVerdict({status:403,ok:false}),'DENIED','Permission refusal');
check(actionVerdict({status:404,ok:false}),'INCONCLUSIVE','Missing function is inconclusive');
check(actionVerdict({status:500,ok:false}),'INCONCLUSIVE','Server error is inconclusive');
check(actionVerdict({status:200,ok:true,data:null}),'INCONCLUSIVE','Empty successful response is inconclusive');
const server=createStaticServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
try{
 const base='http://127.0.0.1:'+server.address().port;
 for(const path of ['/','/app.js','/core.mjs','/style.css','/setup.sql','/add-report-action.sql'])check((await fetch(base+path)).status,200,'Serve '+path);
 for(const path of ['/server.mjs','/.env','/api/login','/START-HERE.txt'])check((await fetch(base+path)).status,404,'Do not serve '+path);
 check((await fetch(base+'/',{method:'POST'})).status,405,'No auth backend here');
 const r=await fetch(base+'/');check(r.headers.get('cache-control'),'no-store','No token caching');
 check(r.headers.get('content-security-policy').includes("connect-src 'self' https://*.supabase.co"),true,'Restrict provider destinations');
}finally{await new Promise(r=>server.close(r));}
console.log(checks+' checks passed: decoder, config safety, evidence classification and static server.');
