import {SESSION_KEY,CONFIG_KEY,BASE_KEY,TABLE,decode,validateConfig,mutate,boundary} from './core.mjs';
const $=s=>document.querySelector(s), steps=['login','token','remember','theft','google'];
const read=(key,fallback=null)=>{try{return JSON.parse(localStorage.getItem(key)) ?? fallback;}catch{return fallback;}};
function save(key,value){try{value==null?localStorage.removeItem(key):localStorage.setItem(key,JSON.stringify(value));}catch{throw Error('Browser storage is blocked. Allow local site storage for this demonstration.');}}
let config=read(CONFIG_KEY),session=read(SESSION_KEY),captured=null,part='payload',googleStep=0,busy=false,trailCount=0,initialRestore=false;
try{if(config)config=validateConfig(config.url,config.key);}catch{config=null;}
if(session && (!config || session.scope!==config.url)){session=null;}
try{if(session){decode(session.access_token);initialRestore=true;}}catch{session=null;}
const talk={
login:['1 MINUTE','“This page is served by my laptop, but login happens at Supabase. My password travels over HTTPS to Supabase Auth, which checks it against a salted hash. On success it returns two tokens. My password is not inside either JWT claim shown here.”','Action: Sign in as Alice. Point to the real token request in the trail.'],
token:['2 MINUTES','“Here is the actual token issued by Supabase. The payload names Alice and includes an expiry. Anyone holding the token can decode these claims. Reading them does not prove the token is genuine—the receiving API must verify it.”','Action: Show Payload, then Header. Open DevTools → Application → Local Storage to find the same token.'],
remember:['1 MINUTE','“When I refresh the page, the browser reloads the stored session. The next data request carries the access token, so I do not need to enter the password again. Supabase still checks access; remembering a session does not skip authorization.”','Action: Fetch Alice’s note, reload the page, then show the new HTTP request.'],
theft:['3 MINUTES','“A bearer token works through possession. A copied token can read Alice’s note, but changing its user ID or expiry does not give it a valid new signature. The owner rule also keeps Bob’s known note out of Alice’s response. After logout, a copied JWT may still work until expiry.”','Action: Run evidence checks. Capture → sign out → replay. Read the actual response; never claim a failed request proves expiry without checking its error.'],
google:['1 MINUTE','“With Google sign-in, any Google password is entered at Google. Google sends a code to Supabase, and Supabase later sends a different code to the app. The app exchanges its code with a matching PKCE verifier and receives a Supabase session. It never receives my Google password.”','Action: Step through the six exchanges. This is a diagram; no live Google login occurs.']
};
const exchanges=[
['App begins sign-in','app → Supabase','The app creates a random PKCE verifier and sends a derived challenge to Supabase. The verifier is needed for the later app-code exchange.'],
['Google checks identity','accounts.google.com','Supabase redirects to Google. If a password is needed, it is entered on Google’s page, not this app’s page.'],
['Google returns its code','Google → Supabase callback','Google returns a provider authorization code to Supabase’s /auth/v1/callback endpoint. It is not the code that the app later exchanges.'],
['Supabase exchanges that code','Supabase ↔ Google','Supabase uses its server-side Google client configuration to exchange Google’s code and obtain permitted identity information. The client secret stays on the server.'],
['Supabase returns a new code','Supabase → app callback','The app gets a separate Supabase auth code. In this PKCE flow it is single-use and lasts five minutes.'],
['App exchanges code + verifier','app → Supabase token endpoint','The matching verifier binds this exchange to the app that began it. Supabase returns the access and refresh tokens. A stolen code alone is insufficient; stealing the verifier or session is still a risk.']
];
function el(tag,text,cls){const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;return e;}
function notice(text,bad=false){$('#notice').textContent=text;$('#notice').classList.toggle('error',bad);}
function error(r){return r.data?.msg||r.data?.message||r.data?.error_description||r.data?.error||'HTTP '+r.status;}
function log(method,path,status,summary){
 if(!trailCount++)$('#trail').textContent='';
 $('#trail').prepend(el('li',new Date().toLocaleTimeString()+'  '+method+' '+path+' → '+status+' · '+summary));
 while($('#trail').children.length>18)$('#trail').lastChild.remove();
}
async function request(path,{method='GET',token='',body,target=config}={}){
 if(!target)throw Error('Connect your Supabase project in Setup first.');
 const headers={apikey:target.key};if(token)headers.Authorization='Bearer '+token;if(body!==undefined)headers['Content-Type']='application/json';
 let r;try{r=await fetch(target.url+path,{method,headers,credentials:'omit',body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(10000)});}
 catch{log(method,path,'NETWORK ERROR','No conclusion. Check URL, project status and connection.');throw Error('Request failed or timed out. Check your connection and Supabase project; this is not a security verdict.');}
 const text=await r.text();let data=null;try{data=text?JSON.parse(text):null;}catch{}
 log(method,path,r.status,Array.isArray(data)?data.length+' row(s); contents omitted.':/\/token/.test(path)?(r.ok?'Token pair received; values omitted.':'Login/refresh rejected; values omitted.'):r.ok?'Request completed; values omitted.':'Request rejected; see its response in DevTools.');
 return {ok:r.ok,status:r.status,data};
}
const notePath=id=>'/rest/v1/'+TABLE+'?select=id,user_id,title,body'+(id?'&user_id=eq.'+encodeURIComponent(id):'');
async function run(button,fn){
 if(busy){notice('Wait for the current request to finish.');return;}busy=true;
 const controls=[...document.querySelectorAll('form button,#refresh,#tests,#logout,#capture-logout,#capture,#replay')];
 const old=controls.map(b=>b.disabled);controls.forEach(b=>b.disabled=true);
 try{await fn();}catch(e){notice(e.message,true);}finally{controls.forEach((b,i)=>b.disabled=old[i]);busy=false;render();}
}
function putSession(data){
 if(data){decode(data.access_token);if(!data.refresh_token||!data.user?.id)throw Error('Supabase did not return a complete session.');}
 session=data?{access_token:data.access_token,refresh_token:data.refresh_token,user:{id:data.user.id,email:data.user.email},scope:config.url}:null;
 save(SESSION_KEY,session);$('#notes').textContent='';$('#raw-token').value='';render();
}
function token(){if(!session)throw Error('Sign in as Alice first.');return session.access_token;}
function baseline(){const b=read(BASE_KEY);return b?.scope===config?.url?b:null;}
function render(){
 $('#connection').textContent=config?'SUPABASE CONFIGURED':'PROJECT NOT CONFIGURED';
 $('#identity').textContent=session?.user.email||'Not signed in';
 $('#session-detail').textContent=session?'Token pair stored in this browser.':'No session stored.';
 $('#flow-heading').textContent=session?'Supabase issued a session':'Waiting for a login';
 $('.journey').classList.toggle('done',!!session);
 $('#raw-token').value=session?.access_token||'';
 const b=baseline();$('#baseline-status').textContent=b?'Bob verified: '+b.rows+' note(s). ID '+b.sub:'Bob’s example has not been verified for this project.';
 renderToken();tick();
}
function tick(){try{const left=Math.max(0,decode(token()).payload.exp-Math.floor(Date.now()/1000));$('#timer').textContent=left?Math.floor(left/60)+':'+String(left%60).padStart(2,'0'):'EXPIRED';}catch{$('#timer').textContent='—';}}
function renderToken(){
 $('[data-part="header"]').classList.toggle('active',part==='header');$('[data-part="payload"]').classList.toggle('active',part==='payload');$('[data-part="signature"]').classList.toggle('active',part==='signature');
 if(!session){['#claim-email','#claim-sub','#claim-exp','#claim-iss'].forEach(s=>$(s).textContent='—');$('#decoded').textContent='Sign in to inspect the real Supabase token.';return;}
 try{
 const d=decode(session.access_token),p=d.payload;
 $('#claim-email').textContent=p.email||'(No email claim)';$('#claim-sub').textContent=p.sub||'—';
 $('#claim-exp').textContent=new Date(p.exp*1000).toLocaleString();$('#claim-iss').textContent=p.iss||'—';
 $('#decoded').textContent=part==='signature'?d.signature:JSON.stringify(d[part],null,2);
 $('#part-note').textContent=part==='payload'?'Readable claims do not prove authenticity. There is no password in these claims.':part==='header'?'The server must enforce its configured algorithm and verify the signature, issuer, audience and expiry.':'Signature bytes are encoded here. HS256 uses a shared secret; asymmetric signing uses a private/public key pair. This screen does not verify either.';
 }catch{$('#decoded').textContent='Stored token is malformed. Sign out and sign in again.';}
}
function current(){const h=location.hash.slice(1);return steps.includes(h)?h:'login';}
function navigate(){
 const p=current(),i=steps.indexOf(p);document.querySelectorAll('[data-view]').forEach(e=>e.hidden=e.dataset.view!==p);
 document.querySelectorAll('[data-step]').forEach(a=>{a.classList.toggle('active',a.dataset.step===p);a.dataset.step===p?a.setAttribute('aria-current','step'):a.removeAttribute('aria-current');});
 $('#previous').disabled=i===0;$('#next').disabled=i===steps.length-1;$('#step-count').textContent='STEP '+(i+1)+' OF 5';
 $('#speaker-time').textContent=talk[p][0];$('#speaker-text').textContent=talk[p][1];$('#speaker-action').textContent=talk[p][2];
 if(p==='remember')loadNote().catch(e=>notice(e.message,true));
}
async function loadNote(){
 $('#notes').textContent='';
 if(!session){$('#notes').append(el('p','Sign in as Alice to fetch her private note.'));return;}
 const expected=session,p=decode(expected.access_token).payload,r=await request(notePath(),{token:expected.access_token});
 if(session!==expected||config?.url!==expected.scope)return;
 if(!r.ok||!Array.isArray(r.data))throw Error(error(r));
 if(r.data.some(row=>row.user_id!==p.sub))throw Error('DATA EXPOSED: another user’s note was returned. Check the table’s RLS policies before presenting.');
 if(!r.data.length){$('#notes').append(el('p','No note returned. Run setup.sql after creating both confirmed users. Zero rows is not proof that a note exists.'));return;}
 r.data.forEach(row=>{const c=el('article',null,'note');c.append(el('h3',row.title),el('p',row.body),el('p','Owner ID: '+row.user_id,'fine'));$('#notes').append(c);});
}
function verdict(title,label,detail,tone=''){
 const row=el('article',null,'test'),left=el('div');left.append(el('strong',title),el('p',detail));row.append(left,el('span',label,'verdict '+tone));$('#test-results').append(row);
}
async function logout(){
 if(!session){notice('Already signed out.');return;}
 const original=session;
 try{const r=await request('/auth/v1/logout?scope=local',{method:'POST',token:original.access_token});if(!r.ok)notice('Browser session cleared; Supabase logout was not confirmed: '+error(r),true);else notice('Signed out. A captured access JWT may still work until its actual expiry.');}
 catch(e){notice('Browser session cleared; Supabase logout could not be confirmed. '+e.message,true);}
 finally{putSession(null);}
}
$('#config-form').addEventListener('submit',e=>{e.preventDefault();run(e.submitter,async()=>{
 const next=validateConfig($('#project-url').value,$('#public-key').value);
 if(session && config?.url!==next.url)throw Error('Sign out of the current project before changing projects.');
 if(!config||config.url!==next.url){captured=null;$('#replay-state').textContent='No copy captured.';save(BASE_KEY,null);}
 config=next;save(CONFIG_KEY,config);render();
 const r=await request(notePath());
 if(!r.ok||!Array.isArray(r.data))throw Error('Configuration saved, but the demo table check failed: '+error(r)+'. Create the users, then run setup.sql.');
 if(r.data.length){$('#setup-health').textContent='DATA EXPOSED: anonymous users can read notes.';throw Error('Anonymous note data was returned. Check grants and RLS before presenting.');}
 $('#setup-health').textContent='Table reachable. Anonymous query returned zero notes. Verify Bob, then sign in as Alice to check owner access.';
 notice('Project saved. Verify Bob’s example below before presenting.');
});});
$('#baseline-form').addEventListener('submit',e=>{e.preventDefault();run(e.submitter,async()=>{
 let issued=null;try{
 const r=await request('/auth/v1/token?grant_type=password',{method:'POST',body:{email:'bob@test.invalid',password:$('#bob-password').value}});
 $('#bob-password').value='';if(!r.ok)throw Error('Bob login failed: '+error(r));
 issued=r.data;const p=decode(issued.access_token).payload;
 if(p.email?.toLowerCase()!=='bob@test.invalid'||!p.sub)throw Error('The returned user is not Bob.');
 const rows=await request(notePath(),{token:issued.access_token});
 if(!rows.ok||!Array.isArray(rows.data)||!rows.data.length)throw Error('Bob has no confirmed note. Run setup.sql after creating the users.');
 if(rows.data.some(row=>row.user_id!==p.sub))throw Error('DATA EXPOSED: Bob’s request returned other-user notes. Fix RLS.');
 save(BASE_KEY,{scope:config.url,sub:p.sub,rows:rows.data.length,at:Date.now()});
 notice('Bob can read his seeded note. His token was not saved. Now sign in as Alice.');
 }finally{
 $('#bob-password').value='';
 if(issued){const r=await request('/auth/v1/logout?scope=local',{method:'POST',token:issued.access_token});if(!r.ok)notice('Bob baseline recorded, but his server logout failed. Check the error before the session.',true);}
 }
});});
$('#login-form').addEventListener('submit',e=>{e.preventDefault();run(e.submitter,async()=>{
 try{
 const r=await request('/auth/v1/token?grant_type=password',{method:'POST',body:{email:$('#email').value.trim(),password:$('#password').value}});
 if(!r.ok)throw Error(error(r));putSession(r.data);initialRestore=false;
 $('#restore-state').textContent='Signed in during this page load. Reload to demonstrate restoring this session.';
 $('#test-results').textContent='';$('#test-results').append(el('div','Evidence checks have not been run for this session.','empty'));
 notice('Supabase issued the session. Continue to Inspect.');
 }finally{$('#password').value='';}
});});
$('#logout').addEventListener('click',e=>run(e.currentTarget,logout));$('#capture-logout').addEventListener('click',e=>run(e.currentTarget,logout));
$('#refresh').addEventListener('click',e=>run(e.currentTarget,async()=>{
 if(!session?.refresh_token)throw Error('Sign in first.');
 const r=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:session.refresh_token}});
 if(!r.ok)throw Error(error(r));putSession(r.data);notice('A fresh token pair was issued. Look at the new expiry.');
}));
$('#load-note').addEventListener('click',e=>run(e.currentTarget,loadNote));
$('#reload-page').addEventListener('click',()=>location.reload());
document.querySelectorAll('[data-part]').forEach(b=>b.addEventListener('click',()=>{part=b.dataset.part;renderToken();}));
$('#tests').addEventListener('click',e=>run(e.currentTarget,async()=>{
 $('#test-results').textContent='';
 try{
 const t=token(),p=decode(t).payload,b=baseline();
 if(p.email?.toLowerCase()!=='alice@test.invalid')throw Error('Run this demo as alice@test.invalid.');
 const own=await request(notePath(),{token:t});
 if(!own.ok||!Array.isArray(own.data)||!own.data.length)throw Error('Your unchanged token did not return a known note: '+error(own)+'. Resolve setup or expiry first.');
 if(own.data.some(row=>row.user_id!==p.sub)){verdict('Owner rule','DATA EXPOSED','Alice’s request returned another user’s note.','bad');return;}
 verdict('1. Replay Alice’s genuine token','ACCEPTED',own.data.length+' Alice note(s) returned. Possession is enough to use this accepted token.','bad');
 const anon=await request(notePath());
 verdict('2. Read with no user token',anon.ok&&Array.isArray(anon.data)?(anon.data.length?'DATA EXPOSED':'NO NOTES'):'INCONCLUSIVE',anon.ok&&Array.isArray(anon.data)?'HTTP '+anon.status+': '+anon.data.length+' note(s). Anonymous access is restricted in this table.':'HTTP '+anon.status+': '+error(anon),anon.data?.length?'bad':!anon.ok?'warn':'');
 const exp=await request(notePath(),{token:mutate(t,{exp:Math.floor(Date.now()/1000)+31536000})});
 verdict('3. Edit expiry without signing',exp.status===401?'REJECTED':exp.ok?'UNEXPECTED':'INCONCLUSIVE','HTTP '+exp.status+': '+(exp.ok?'The API accepted an altered token. Investigate immediately.':error(exp))+'. Editing expiry does not make a valid new signature.',exp.ok?'bad':exp.status!==401?'warn':'');
 if(!b){verdict('4. Bob’s identity and note','NEEDS BASELINE','Verify Bob’s example in Setup. Zero rows alone does not prove another user’s data is protected.','warn');return;}
 const id=await request(notePath(),{token:mutate(t,{sub:b.sub})});
 verdict('4. Edit identity to Bob',id.status===401?'REJECTED':id.ok?'UNEXPECTED':'INCONCLUSIVE','HTTP '+id.status+': '+(id.ok?'Altered token accepted; investigate.':error(id))+'. The original signature was left unchanged.',id.ok?'bad':id.status!==401?'warn':'');
 const other=await request(notePath(b.sub),{token:t}),label=boundary(other,b,config.url,b.sub);
 verdict('5. Read Bob’s confirmed note',label,label==='BOUNDARY HELD'?'HTTP 200: zero notes. Bob previously read '+b.rows+' own note(s) in this project; Alice cannot read them.':label==='DATA EXPOSED'?'Other-user notes returned. Check RLS and grants.':'HTTP '+other.status+': '+error(other)+'. Fix the error before drawing a conclusion.',label==='DATA EXPOSED'?'bad':label==='BOUNDARY HELD'?'':'warn');
 }catch(err){verdict('Checks could not complete','INCONCLUSIVE',err.message,'warn');}
}));
$('#capture').addEventListener('click',e=>run(e.currentTarget,async()=>{
 const t=token(),p=decode(t).payload;if(p.exp<=Date.now()/1000)throw Error('The token has expired. Refresh or sign in first.');
 captured={token:t,config:{...config},exp:p.exp};$('#replay-state').textContent='Token copy held only in memory. It expires at '+new Date(p.exp*1000).toLocaleTimeString()+'. Now sign out.';
}));
$('#replay').addEventListener('click',e=>run(e.currentTarget,async()=>{
 if(!captured)throw Error('Capture Alice’s token first. Page reload clears the copy.');
 const r=await request(notePath(),{token:captured.token,target:captured.config});
 $('#replay-state').textContent='Actual replay → HTTP '+r.status+': '+(Array.isArray(r.data)?r.data.length+' note(s)':error(r))+'. '+(r.ok?'This API still accepts the copied token. Logout did not erase that copy.':'Read the response error: rejection can mean expiry, invalid token or a setup problem.');
}));
$('#clear-capture').addEventListener('click',()=>{captured=null;$('#replay-state').textContent='Copy cleared from memory.';});
function renderGoogle(){$('#google-flow').textContent='';exchanges.forEach((s,i)=>{const c=el('div',null,'hop'+(i===googleStep?' active':''));c.append(el('small','0'+(i+1)),el('b',s[0]),el('span',s[1]));$('#google-flow').append(c);});$('#google-detail').textContent=exchanges[googleStep][2];$('#google-next').disabled=googleStep===exchanges.length-1;}
$('#google-next').addEventListener('click',()=>{googleStep=Math.min(5,googleStep+1);renderGoogle();});$('#google-reset').addEventListener('click',()=>{googleStep=0;renderGoogle();});
$('#setup-open').addEventListener('click',()=>{$('#setup').hidden=false;$('#setup').scrollIntoView({block:'start'});});$('#setup-close').addEventListener('click',()=>{$('#setup').hidden=true;});
$('#script-toggle').addEventListener('click',()=>{const on=$('#speaker').hidden;$('#speaker').hidden=!on;$('#script-toggle').textContent='Speaking notes: '+(on?'on':'off');$('#script-toggle').setAttribute('aria-pressed',String(on));});
$('#previous').addEventListener('click',()=>{location.hash=steps[Math.max(0,steps.indexOf(current())-1)];});
$('#next').addEventListener('click',()=>{location.hash=steps[Math.min(4,steps.indexOf(current())+1)];});
$('#clear-log').addEventListener('click',()=>{$('#trail').textContent='';trailCount=0;});
window.addEventListener('hashchange',navigate);
window.addEventListener('storage',e=>{
 if(busy)return;
 if(e.key===CONFIG_KEY){const c=read(CONFIG_KEY);try{config=c?validateConfig(c.url,c.key):null;}catch{config=null;}captured=null;$('#project-url').value=config?.url||'';$('#public-key').value=config?.key||'';}
 if([SESSION_KEY,CONFIG_KEY].includes(e.key)){session=read(SESSION_KEY);if(session?.scope!==config?.url)session=null;render();notice('Session/configuration changed in another tab. Recheck before continuing.');}
 if(e.key===BASE_KEY)render();
});
$('#project-url').value=config?.url||'';$('#public-key').value=config?.key||'';$('#setup').hidden=!!config;
$('#restore-state').textContent=initialRestore?'A stored session was loaded from localStorage on this page load. The note request still goes to Supabase.':'No stored session loaded on this page load.';
fetch('/setup.sql').then(r=>{if(!r.ok)throw Error('SQL unavailable');return r.text();}).then(s=>$('#sql-text').textContent=s).catch(()=>$('#sql-text').textContent='Open setup.sql from the extracted folder.');
$('#copy-sql').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('#sql-text').textContent);notice('SQL copied. Run it once after creating both users in your test project.');}catch{notice('Clipboard unavailable. Select the SQL text manually or open setup.sql.');}});
render();renderGoogle();navigate();setInterval(tick,1000);
