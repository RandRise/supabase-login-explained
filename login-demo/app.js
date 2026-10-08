import {SESSION_KEY,CONFIG_KEY,BASE_KEY,TABLE,REPORT_PATH,decode,validateConfig,mutate,boundary,reportValid,actionVerdict} from './core.mjs';
const $=s=>document.querySelector(s);
const read=(key,fallback=null)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
function save(key,value){try{value==null?localStorage.removeItem(key):localStorage.setItem(key,JSON.stringify(value));}catch{throw Error('Browser storage is blocked. Allow local site storage to use this demo.');}}
let config=read(CONFIG_KEY),session=read(SESSION_KEY),captured=null,part='payload',busy=false,trailCount=0;
try{if(config)config=validateConfig(config.url,config.key);}catch{config=null;}
function validStored(s){try{return !!config&&s?.scope===config.url&&typeof s.refresh_token==='string'&&s.user?.id===decode(s.access_token).payload.sub;}catch{return false;}}
if(!validStored(session))session=null;
const restored=!!session;
function el(tag,text,cls){const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;return e;}
function notice(text,bad=false){$('#notice').hidden=false;$('#notice').textContent=text;$('#notice').classList.toggle('error',bad);}
function error(r){return r.data?.msg||r.data?.message||r.data?.error_description||r.data?.error||'HTTP '+r.status;}
function log(method,path,status){
 if(!trailCount++)$('#trail').textContent='';
 $('#trail').prepend(el('li',new Date().toLocaleTimeString()+' · '+method+' '+path+' → '+status));
 while($('#trail').children.length>18)$('#trail').lastChild.remove();
}
async function request(path,{method='GET',token='',body,target=config}={}){
 if(!target)throw Error('Connect your Supabase project in Connection settings first.');
 const headers={apikey:target.key};if(token)headers.Authorization='Bearer '+token;if(body!==undefined)headers['Content-Type']='application/json';
 let r;try{r=await fetch(target.url+path,{method,headers,credentials:'omit',body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(10000)});}
 catch{log(method,path,'NETWORK ERROR');throw Error('Request failed or timed out. Check the connection and project status. No access result was received.');}
 const text=await r.text();let data=null;try{data=text?JSON.parse(text):null;}catch{}
 log(method,path,r.status);return {ok:r.ok,status:r.status,data};
}
const notePath=id=>'/rest/v1/'+TABLE+'?select=id,user_id,title,body'+(id?'&user_id=eq.'+encodeURIComponent(id):'');
const report=(token='',target=config)=>request(REPORT_PATH,{method:'POST',body:{},token,target});
const token=()=>{if(!session)throw Error('Sign in first.');return session.access_token;};
const baseline=()=>{const b=read(BASE_KEY);return b?.scope===config?.url?b:null;};
async function run(fn){
 if(busy)return;busy=true;render();
 try{await fn();}catch(e){notice(e.message,true);}finally{busy=false;render();}
}
function clearReport(){$('#report-preview').hidden=true;$('#report-json').textContent='';$('#download-status').textContent='Ready when you are.';}
function putSession(data){
 let next=null;if(data){const p=decode(data.access_token).payload;if(!data.refresh_token||!data.user?.id||p.sub!==data.user.id)throw Error('Supabase returned an incomplete or mismatched session.');next={access_token:data.access_token,refresh_token:data.refresh_token,user:{id:data.user.id,email:data.user.email},scope:config.url};}
 save(SESSION_KEY,next);session=next;clearReport();$('#raw-token').value='';render();
}
function render(){
 $('#login-view').hidden=!!session;$('#dashboard').hidden=!session;$('#logout').hidden=!session;
 $('#connection').textContent=config?'Supabase connected':'Not configured';
 $('#identity').textContent=session?.user.email||'';
 document.querySelectorAll('button').forEach(b=>b.disabled=busy);
 if(!busy){$('#download').disabled=!session;$('#refresh').disabled=!session;$('#capture').disabled=!session;$('#tests').disabled=!session;$('#replay').disabled=!captured;$('#sign-in').disabled=!config;$('#anonymous').disabled=!config;$('#export-config').disabled=!config;}
 const b=baseline();$('#baseline-status').textContent=b?'Bob verified: '+b.rows+' note(s). Owner ID: '+b.sub:'Bob’s note has not been verified for this project.';
 $('#raw-token').value=session?.access_token||'';renderToken();tick();
}
function tick(){try{const left=Math.max(0,decode(token()).payload.exp-Math.floor(Date.now()/1000));$('#timer').textContent=left?Math.floor(left/60)+':'+String(left%60).padStart(2,'0'):'expired';}catch{$('#timer').textContent='—';}}
function renderToken(){
 document.querySelectorAll('[data-part]').forEach(b=>b.classList.toggle('active',b.dataset.part===part));
 if(!session){$('#decoded').textContent='No session stored. Sign in to inspect a token.';return;}
 try{const d=decode(session.access_token);$('#decoded').textContent=part==='signature'?d.signature:JSON.stringify(d[part],null,2);$('#part-note').textContent=part==='payload'?'Readable claims identify the user and expiry. There is no password here. The API must still verify the token.':part==='header'?'The API must enforce its signing algorithm and validate signature, issuer, audience and expiry.':'These are encoded signature bytes. Editing claims without a valid new signature does not create a trusted token.';}
 catch{$('#decoded').textContent='Stored token is malformed. Sign out and sign in again.';}
}
function downloadFile(name,value){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)+'\n'],{type:'application/json'})),a=el('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function displayResult(selector,text,tone=''){const e=$(selector);e.textContent=text;e.className='result '+tone;}
async function logout(){
 if(!session)return;
 const original=session,target={...config};
 // Clear browser state immediately, even if the provider is unreachable.
 putSession(null);$('#restore-state').textContent='Browser session cleared. A captured access-token copy stays in memory until you clear it or reload.';
 try{const r=await request('/auth/v1/logout?scope=local',{method:'POST',token:original.access_token,target});notice(r.ok?'Signed out.':('Browser signed out, but Supabase logout was not confirmed: '+error(r)),!r.ok);}
 catch(e){notice('Browser signed out. Supabase logout was not confirmed. '+e.message,true);}
}
function connect(next){
 if(session)throw Error('Sign out before changing connection settings.');
 save(CONFIG_KEY,next);save(BASE_KEY,null);config=next;captured=null;displayResult('#replay-state','No copy captured.');$('#test-results').textContent='';$('#anonymous-result').textContent='No request sent yet.';$('#project-url').value=config.url;$('#public-key').value=config.key;render();
}
async function checkConnection(){
 const r=await report();const verdict=actionVerdict(r);
 $('#setup-health').textContent=verdict==='DENIED'?'Report endpoint responded HTTP '+r.status+' to an anonymous request. Sign in to confirm the report can be downloaded.':r.ok?'Unexpected anonymous response. Check the report function before presenting.':'Connection saved. Report check returned HTTP '+r.status+': '+error(r)+'. Run the SQL in this project and recheck.';
 notice(verdict==='DENIED'?'Connection saved. Sign in to access your report.':'Connection saved; the report endpoint needs checking.',verdict!=='DENIED');
}
$('#config-form').addEventListener('submit',e=>{e.preventDefault();run(async()=>{connect(validateConfig($('#project-url').value,$('#public-key').value));await checkConnection();});});
$('#login-form').addEventListener('submit',e=>{e.preventDefault();run(async()=>{
 const target=config;
 try{const r=await request('/auth/v1/token?grant_type=password',{method:'POST',body:{email:$('#email').value.trim(),password:$('#password').value},target});
 if(config!==target)throw Error('Connection changed during login. Try again.');if(!r.ok)throw Error(error(r));putSession(r.data);$('#restore-state').textContent='Signed in during this page load. Reload to restore the saved session.';$('#test-results').textContent='';notice('Signed in successfully.');}
 finally{$('#password').value='';}
});});
$('#logout').addEventListener('click',()=>run(logout));
$('#download').addEventListener('click',()=>run(async()=>{
 const expected=session,target=config,t=token();$('#download-status').textContent='Requesting your report…';
 try{const r=await report(t,target);if(session!==expected||config!==target)return;
 if(!r.ok){$('#download-status').textContent='HTTP '+r.status+' · Report was not downloaded.';throw Error(error(r));}
 if(!reportValid(r.data,decode(t).payload.sub))throw Error('Report content is missing or has an unexpected owner. Check setup and RLS before presenting.');
 $('#report-json').textContent=JSON.stringify(r.data,null,2);$('#report-preview').hidden=false;downloadFile('private-report.json',r.data);$('#download-status').textContent='HTTP '+r.status+' · Access granted. Your report was downloaded.';notice('Your report is ready.');}
 catch(e){if(session===expected&&config===target){$('#download-status').textContent='Download failed. '+e.message;throw e;}}
}));
$('#anonymous').addEventListener('click',()=>run(async()=>{
 displayResult('#anonymous-result','Sending the report request with no Authorization header…');
 try{const r=await report(),v=actionVerdict(r);displayResult('#anonymous-result',v==='DENIED'?'ACCESS DENIED · HTTP '+r.status+' · '+error(r)+' No report was returned.':v==='ACCEPTED'?'UNEXPECTED · HTTP '+r.status+' · Anonymous request succeeded. Check the report function.':'INCONCLUSIVE · HTTP '+r.status+' · '+error(r)+' Check configuration; this is not proof of secure access.',v==='DENIED'?'denied':'');}
 catch(e){displayResult('#anonymous-result','INCONCLUSIVE · '+e.message);}
}));
$('#refresh').addEventListener('click',()=>run(async()=>{
 const expected=session,target=config;if(!expected)throw Error('Sign in first.');
 const r=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:expected.refresh_token},target});
 if(session!==expected||config!==target)return;if(!r.ok)throw Error(error(r));putSession(r.data);notice('Session refreshed. The token pair and expiry have changed.');
}));
$('#reload-page').addEventListener('click',()=>location.reload());
$('#capture').addEventListener('click',()=>run(async()=>{const t=token(),p=decode(t).payload;if(p.exp<=Date.now()/1000)throw Error('This token has expired. Refresh or sign in again.');captured={token:t,config:{...config},sub:p.sub,exp:p.exp};displayResult('#replay-state','Copy captured in page memory. Sign out, then replay it. Expiry: '+new Date(p.exp*1000).toLocaleTimeString());}));
$('#replay').addEventListener('click',()=>run(async()=>{
 if(!captured)throw Error('Capture a token while signed in first.');const copy=captured;
 try{const r=await report(copy.token,copy.config);if(captured!==copy)return;
 const accepted=r.ok&&reportValid(r.data,copy.sub);displayResult('#replay-state',accepted?'ACCESS GRANTED · HTTP '+r.status+' · The copied token returned '+r.data.notes.length+' owner note(s), even without the login form. Logout does not immediately invalidate an existing access JWT.':r.status===401||r.status===403?'ACCESS DENIED · HTTP '+r.status+' · '+error(r)+' Read the error before claiming it expired.':'INCONCLUSIVE · HTTP '+r.status+' · Unexpected response or configuration error.',accepted?'accepted':[401,403].includes(r.status)?'denied':'');}
 catch(e){displayResult('#replay-state','INCONCLUSIVE · '+e.message);}
}));
$('#clear-capture').addEventListener('click',()=>{captured=null;displayResult('#replay-state','Copy cleared from memory.');render();});
function verdict(title,label,detail,tone=''){const row=el('article',null,'test');row.append(el('strong',title),el('span',label,'verdict '+tone),el('p',detail));$('#test-results').append(row);}
$('#baseline-form').addEventListener('submit',e=>{e.preventDefault();run(async()=>{
 let issued=null;const target=config;
 try{const r=await request('/auth/v1/token?grant_type=password',{method:'POST',body:{email:'bob@test.invalid',password:$('#bob-password').value},target});$('#bob-password').value='';if(!r.ok)throw Error('Bob login failed: '+error(r));issued=r.data;const p=decode(issued.access_token).payload;if(p.email?.toLowerCase()!=='bob@test.invalid'||!p.sub)throw Error('Returned account is not Bob.');
 const rows=await request(notePath(),{token:issued.access_token,target});if(config!==target)return;
 if(!rows.ok||!Array.isArray(rows.data)||!rows.data.length)throw Error('Bob’s seeded note was not returned. Check setup.');if(rows.data.some(row=>row.user_id!==p.sub))throw Error('DATA EXPOSED: Bob received another owner’s note. Check RLS.');save(BASE_KEY,{scope:target.url,sub:p.sub,rows:rows.data.length,at:Date.now()});notice('Bob’s own note is confirmed. His token was not stored.');}
 finally{$('#bob-password').value='';if(issued){const r=await request('/auth/v1/logout?scope=local',{method:'POST',token:issued.access_token,target});if(!r.ok)notice('Bob’s provider logout was not confirmed: '+error(r),true);}}
});});
$('#tests').addEventListener('click',()=>run(async()=>{
 $('#test-results').textContent='';const expected=session,target=config;
 try{const t=token(),p=decode(t).payload,b=baseline();if(p.email?.toLowerCase()!=='alice@test.invalid')throw Error('Use Alice’s account for the two-user checks.');
 const own=await report(t,target);if(session!==expected||config!==target)return;
 if(!own.ok||!reportValid(own.data,p.sub))throw Error('First confirm the unchanged token downloads Alice’s known report. HTTP '+own.status+': '+error(own));
 verdict('Genuine token','ACCEPTED','HTTP '+own.status+' · Alice’s owner report was returned.');
 const edited=await report(mutate(t,{exp:Math.floor(Date.now()/1000)+31536000}),target);if(session!==expected||config!==target)return;
 verdict('Edit expiry without signing',edited.status===401?'REJECTED':edited.ok?'UNEXPECTED':'INCONCLUSIVE','HTTP '+edited.status+' · '+error(edited)+'. This checks signature tampering, not natural token expiry.',edited.ok?'bad':edited.status===401?'':'warn');
 if(!b){verdict('Bob’s owner boundary','NEEDS BASELINE','Verify Bob’s seeded note first. Zero rows alone is insufficient.','warn');return;}
 const identity=await report(mutate(t,{sub:b.sub}),target);if(session!==expected||config!==target)return;
 verdict('Edit identity to Bob',identity.status===401?'REJECTED':identity.ok?'UNEXPECTED':'INCONCLUSIVE','HTTP '+identity.status+' · '+error(identity),identity.ok?'bad':identity.status===401?'':'warn');
 const other=await request(notePath(b.sub),{token:t,target});if(session!==expected||config!==target)return;const label=boundary(other,b,target.url,b.sub);
 verdict('Read Bob’s confirmed note',label,label==='BOUNDARY HELD'?'HTTP 200 · Zero notes returned to Alice. Bob previously read '+b.rows+' note(s) in the same project.':label==='DATA EXPOSED'?'Bob’s note was returned. Check RLS and grants.':'HTTP '+other.status+' · '+error(other),label==='DATA EXPOSED'?'bad':label==='BOUNDARY HELD'?'':'warn');
 }catch(e){if(session===expected&&config===target)verdict('Checks incomplete','INCONCLUSIVE',e.message,'warn');}
}));
document.querySelectorAll('[data-part]').forEach(b=>b.addEventListener('click',()=>{part=b.dataset.part;renderToken();}));
$('#setup-open').addEventListener('click',()=>$('#setup').showModal());$('#setup-close').addEventListener('click',()=>$('#setup').close());
$('#export-config').addEventListener('click',()=>{if(!config)return;downloadFile('reports-connection.public.json',{format:'folio-public-connection-v1',...validateConfig(config.url,config.key)});notice('Exported public settings only. Sign in separately on the other laptop.');});
$('#import-config').addEventListener('click',()=>$('#config-file').click());
$('#config-file').addEventListener('change',()=>run(async()=>{
 try{const file=$('#config-file').files[0];if(!file)return;if(file.size>20000)throw Error('Select the small public connection settings file.');const data=JSON.parse(await file.text());if(data.format!=='folio-public-connection-v1'||Object.keys(data).some(k=>!['format','url','key'].includes(k)))throw Error('Import only a public connection settings file. Session exports are refused.');connect(validateConfig(data.url,data.key));await checkConnection();}
 finally{$('#config-file').value='';}
}));
$('#clear-log').addEventListener('click',()=>{$('#trail').textContent='';trailCount=0;});
window.addEventListener('storage',e=>{
 if(![SESSION_KEY,CONFIG_KEY,BASE_KEY].includes(e.key)&&e.key!==null)return;
 if(e.key===CONFIG_KEY||e.key===null){try{const c=read(CONFIG_KEY);config=c?validateConfig(c.url,c.key):null;}catch{config=null;}captured=null;$('#project-url').value=config?.url||'';$('#public-key').value=config?.key||'';}
 if([SESSION_KEY,CONFIG_KEY].includes(e.key)||e.key===null){session=read(SESSION_KEY);if(!validStored(session))session=null;clearReport();}
 render();notice('Session or settings changed in another tab.');
});
$('#project-url').value=config?.url||'';$('#public-key').value=config?.key||'';
$('#restore-state').textContent=restored?'Session restored from localStorage on this page load. Report access still requires a new Supabase check.':'No saved session was loaded on this page.';
render();setInterval(tick,1000);if(!config)notice('Connect your Supabase test project in Connection settings to get started.');
// Optional machine-local public settings. Never bootstrap a password or session.
async function loadLocalConnection(){
 if(config)return;
 try{const r=await fetch('/connection.public.json',{credentials:'omit'});if(!r.ok)return;const data=await r.json();
 if(config||busy||data.format!=='folio-public-connection-v1'||Object.keys(data).some(k=>!['format','url','key'].includes(k)))return;
 connect(validateConfig(data.url,data.key));notice('Test project connected. Sign in to access your report.');
 }catch{/* A clone without local settings uses the normal connection dialog. */}
}
loadLocalConnection();
