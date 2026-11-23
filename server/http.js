import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {DEFAULT_PEOPLE,people,isAdmin,can} from '../src/access.js';
import {remindersFor} from '../src/reminders.js';
import {Auth,AuthError} from './auth.js';
import {CommandError,assertPlain} from './commands.js';
import {viewFor,receiptFor} from './view.js';
import {OAuth,OAuthError,SCOPE} from './oauth.js';
import {handleMcp} from './mcp.js';
import {isFrontendPath,CONTENT_TYPES} from '../scripts/frontend-files.mjs';

const COOKIE='tz_session';
const MAX_BODY=1024*1024;

class HttpError extends Error{constructor(message,status){super(message);this.status=status;}}

function parseCookies(header=''){
  const out={};
  for(const part of header.split(';')){const i=part.indexOf('=');if(i>0)out[part.slice(0,i).trim()]=part.slice(i+1).trim();}
  return out;
}

async function readJson(req,{allowArray=false}={}){
  const type=String(req.headers['content-type']||'');
  if(!type.toLowerCase().startsWith('application/json'))throw new HttpError('JSON yuboring.',415);
  const chunks=[];let size=0;
  for await(const chunk of req){
    size+=chunk.length;
    if(size>MAX_BODY)throw new HttpError('So‘rov juda katta.',413);
    chunks.push(chunk);
  }
  try{
    const body=JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');
    if(!body||typeof body!=='object'||(Array.isArray(body)&&!allowArray))throw 0;
    assertPlain(body);
    return body;
  }catch(error){
    if(error instanceof CommandError)throw error;
    throw new HttpError('JSON noto‘g‘ri.',400);
  }
}

// Hash of the one inline script in index.html so CSP can stay strict.
async function pageSecurity(staticDir){
  try{
    const html=await readFile(path.join(staticDir,'index.html'),'utf8');
    const hashes=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>`'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`);
    return `default-src 'self'; script-src 'self' ${hashes.join(' ')}; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`;
  }catch{return "default-src 'self'";}
}

export async function createApp({store,auth,config,log=()=>{},oauth=new OAuth(store.db,auth)}){
  const csp=await pageSecurity(config.staticDir);

  const baseHeaders=extra=>({
    'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY',
    'Cross-Origin-Opener-Policy':'same-origin',...extra,
  });
  const send=(res,status,body,extra={})=>{
    const json=JSON.stringify(body);
    res.writeHead(status,baseHeaders({'Content-Type':'application/json; charset=utf-8','Content-Length':Buffer.byteLength(json),...extra}));
    res.end(json);
  };
  const clientIp=req=>{
    if(config.trustProxy){const forwarded=String(req.headers['x-forwarded-for']||'').split(',')[0].trim();if(forwarded)return forwarded;}
    return req.socket.remoteAddress||'';
  };
  const secure=req=>config.secureCookies||(config.trustProxy&&req.headers['x-forwarded-proto']==='https');
  const sessionCookie=(req,token,maxAgeMs)=>`${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(maxAgeMs/1000)}${secure(req)?'; Secure':''}`;
  const clearCookie=req=>`${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure(req)?'; Secure':''}`;

  // Cookies alone must never authorise a write coming from another site.
  function assertSameSite(req){
    if(req.headers['x-tz-client']!=='web')throw new HttpError('So‘rov rad etildi.',403);
    const origin=req.headers.origin;
    if(origin&&origin!=='null'){
      let host;try{host=new URL(origin).host;}catch{throw new HttpError('So‘rov rad etildi.',403);}
      if(host!==req.headers.host&&!config.allowedOrigins.includes(origin))throw new HttpError('So‘rov rad etildi.',403);
    }
  }

  function identify(req){
    const token=parseCookies(req.headers.cookie)[COOKIE];
    const actor=auth.authenticate(token);
    if(!actor)throw new HttpError('Tizimga kiring.',401);
    return {actor,token};
  }

  const snapshot=(actor)=>{
    const {version,state}=store.read();
    return {version,view:viewFor(state,actor,version),reminders:remindersFor(state,actor)};
  };
  const profile=(actor,state)=>{
    const person=people(state).find(p=>p.id===actor);
    return {id:actor,name:person.name,role:person.role,admin:isAdmin(actor),permissions:Object.fromEntries(['sell','credit','priceException','inventory','products','services','stock','prices','cash','debts','returns','defects','reverse'].map(id=>[id,can(state,actor,id)]))};
  };

  async function api(req,res,url){
    const route=`${req.method} ${url.pathname}`;
    if(route==='GET /api/health')return send(res,200,{ok:true,version:store.version()});
    if(route==='GET /api/people'){
      const {state}=store.read();
      return send(res,200,{people:people(state).map(p=>({id:p.id,name:p.name,initials:p.initials}))});
    }
    if(req.method!=='GET')assertSameSite(req);

    if(route==='POST /api/login'){
      const body=await readJson(req);
      const {token,expiresAt}=await auth.login(String(body.person??''),body.password,{ip:clientIp(req),userAgent:req.headers['user-agent']});
      const {state,version}=store.read();
      return send(res,200,{ok:true,user:profile(body.person,state),version},{'Set-Cookie':sessionCookie(req,token,expiresAt-Date.now())});
    }
    if(route==='POST /api/logout'){
      auth.logout(parseCookies(req.headers.cookie)[COOKIE]);
      return send(res,200,{ok:true},{'Set-Cookie':clearCookie(req)});
    }

    const {actor,token}=identify(req);
    if(route==='GET /api/me'){
      const {state,version}=store.read();
      return send(res,200,{user:profile(actor,state),version});
    }
    if(route==='GET /api/state'){
      const since=url.searchParams.get('since');
      if(since!==null&&Number(since)===store.version())return send(res,200,{unchanged:true,version:store.version()});
      return send(res,200,{...snapshot(actor)});
    }
    if(req.method==='GET'&&url.pathname.startsWith('/api/receipts/')){
      let id;try{id=decodeURIComponent(url.pathname.slice('/api/receipts/'.length));}catch{throw new HttpError('Chek raqami noto‘g‘ri.',400);}
      const {state}=store.read();
      const sale=receiptFor(state,actor,id.trim().replace(/^#/,'').toUpperCase());
      if(!sale)throw new HttpError('Bu raqamdagi chek topilmadi.',404);
      return send(res,200,{sale});
    }
    if(route==='GET /api/reminders'){
      const {state}=store.read();
      return send(res,200,{reminders:remindersFor(state,actor)});
    }
    if(route==='POST /api/commands'){
      const body=await readJson(req);
      if(typeof body.command!=='string')throw new HttpError('Amal nomi kerak.',400);
      const outcome=store.execute({actor,command:body.command,args:body.args??{},opId:body.opId});
      return send(res,200,{ok:true,result:outcome.result,replayed:outcome.replayed,...snapshot(actor)});
    }
    if(route==='POST /api/password'){
      const body=await readJson(req);
      const fresh=await auth.changePassword(actor,body.current,body.next,true);
      return send(res,200,{ok:true},{'Set-Cookie':sessionCookie(req,fresh.token,fresh.expiresAt-Date.now())});
    }
    if(route==='POST /api/admin/password'){
      if(!isAdmin(actor))throw new HttpError('Bu amal faqat Otabek uchun.',403);
      const body=await readJson(req);
      if(!DEFAULT_PEOPLE.some(p=>p.id===body.person))throw new HttpError('Xodimni tanlang.',422);
      await auth.setPassword(body.person,body.password);
      // Changing his own password signed him out everywhere; keep this device.
      if(body.person===actor){const fresh=auth.createSession(actor,req.headers['user-agent']);return send(res,200,{ok:true},{'Set-Cookie':sessionCookie(req,fresh.token,fresh.expiresAt-Date.now())});}
      return send(res,200,{ok:true});
    }
    if(route==='GET /api/export'){
      if(!isAdmin(actor))throw new HttpError('Bu amal faqat Otabek uchun.',403);
      const {state}=store.read();
      const stamp=new Date().toISOString().slice(0,10);
      const json=JSON.stringify(state,null,2);
      res.writeHead(200,baseHeaders({'Content-Type':'application/json; charset=utf-8','Content-Disposition':`attachment; filename="telefonzona-nusxa-${stamp}.json"`,'Content-Length':Buffer.byteLength(json)}));
      return void res.end(json);
    }
    throw new HttpError('Topilmadi.',404);
  }

  async function serveStatic(req,res,url){
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,baseHeaders({Allow:'GET, HEAD'}));return void res.end();}
    let pathname=url.pathname==='/'?'/index.html':url.pathname;
    if(!isFrontendPath(pathname)){res.writeHead(404,baseHeaders({'Content-Type':'text/plain; charset=utf-8'}));return void res.end('Topilmadi');}
    try{
      let content=await readFile(path.join(config.staticDir,pathname));
      const headers={'Content-Type':CONTENT_TYPES[path.extname(pathname)]||'application/octet-stream'};
      if(pathname==='/index.html'){
        headers['Content-Security-Policy']=csp;
        // Tells the app it is served by this server, so it signs in and saves here instead of locally.
        content=Buffer.from(content.toString('utf8').replace('<head>','<head><meta name="telefonzona-server" content="1">'));
      }
      res.writeHead(200,baseHeaders(headers));
      res.end(req.method==='HEAD'?undefined:content);
    }catch(error){
      res.writeHead(error.code==='ENOENT'?404:500,baseHeaders({'Content-Type':'text/plain; charset=utf-8'}));
      res.end(error.code==='ENOENT'?'Topilmadi':'Faylni ochib bo‘lmadi.');
    }
  }

  // ---- Claude connector: OAuth endpoints and the MCP endpoint ----
  const publicBase=req=>{
    if(config.publicUrl)return config.publicUrl;
    const proto=(config.trustProxy&&req.headers['x-forwarded-proto'])||'http';
    return `${proto}://${req.headers.host}`;
  };
  const oauthError=(res,error,status=400)=>send(res,status,{error:error.code||'invalid_request',error_description:error.message},{'Cache-Control':'no-store'});
  async function readForm(req){
    const type=String(req.headers['content-type']||'').toLowerCase();
    if(!type.startsWith('application/x-www-form-urlencoded'))throw new OAuthError('invalid_request','Forma ma’lumoti kerak.');
    const chunks=[];let size=0;
    for await(const chunk of req){size+=chunk.length;if(size>16384)throw new OAuthError('invalid_request','So‘rov juda katta.',413);chunks.push(chunk);}
    return Object.fromEntries(new URLSearchParams(Buffer.concat(chunks).toString('utf8')));
  }
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const PAGE_CSP="default-src 'none'; style-src 'unsafe-inline'; form-action 'self' https://claude.ai https://claude.com http://localhost:* http://127.0.0.1:*; frame-ancestors 'none'; base-uri 'none'";
  const html=(res,status,body)=>{
    res.writeHead(status,baseHeaders({'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':PAGE_CSP}));
    res.end(`<!doctype html><html lang="uz"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>TelefonZona — ruxsat berish</title><style>
:root{color-scheme:light dark;--bg:#f5f7f3;--panel:#fff;--ink:#20382c;--muted:#6b7a70;--line:#dbe4d8;--accent:#285b3e;--danger:#b75a40}
@media(prefers-color-scheme:dark){:root{--bg:#0f1f1b;--panel:#163832;--ink:#e6f2e9;--muted:#9db8a8;--line:#235347;--accent:#8eb69b}}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,sans-serif;min-height:100vh;display:grid;place-items:center;padding:20px}
main{width:min(440px,100%);background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:24px}
h1{margin:0 0 8px;font-size:24px}p{margin:8px 0;color:var(--muted)}b{color:var(--ink)}
label.p{display:flex;gap:12px;align-items:center;padding:12px 14px;border:1px solid var(--line);border-radius:12px;margin:8px 0;cursor:pointer;min-height:52px}
label.p:has(input:checked){border-color:var(--accent);box-shadow:0 0 0 2px var(--accent)}
input[type=password]{width:100%;box-sizing:border-box;padding:14px;border:1px solid var(--line);border-radius:10px;background:transparent;color:var(--ink);font-size:16px;margin:6px 0 12px}
button{width:100%;min-height:50px;border-radius:12px;border:1px solid var(--accent);font:inherit;font-weight:600;cursor:pointer;margin-top:8px}
.go{background:var(--accent);color:var(--bg)}.no{background:transparent;color:var(--ink);border-color:var(--line)}
.err{color:var(--danger);min-height:1.4em}</style></head><body><main>${body}</main></body></html>`);
  };
  const authorizeFields=params=>['response_type','client_id','redirect_uri','code_challenge','code_challenge_method','state','scope','resource']
    .map(key=>`<input type="hidden" name="${key}" value="${esc(params[key]??'')}">`).join('');
  function authorizePage(res,params,client,message=''){
    const {state}=store.read();
    let host='';try{host=new URL(params.redirect_uri).host;}catch{}
    html(res,message?401:200,`<h1>TelefonZona</h1><p><b>${esc(client.name)}</b> sizning nomingizdan TelefonZona ma’lumotlarini <b>faqat o‘qimoqchi</b>. U hech narsani o‘zgartira olmaydi va faqat siz ko‘ra oladigan ma’lumotni ko‘radi.</p><p>Qaytish manzili: <b>${esc(host)}</b></p>
<form method="post" action="/authorize">${authorizeFields(params)}${people(state).map(p=>`<label class="p"><input type="radio" name="person" value="${esc(p.id)}" required> <b>${esc(p.name)}</b></label>`).join('')}
<label>Parol<input type="password" name="password" autocomplete="current-password" required></label><div class="err" role="alert">${esc(message)}</div>
<button class="go" type="submit" name="decision" value="allow">Ruxsat berish</button><button class="no" type="submit" name="decision" value="deny" formnovalidate>Rad etish</button></form>`);
  }
  const redirectBack=(res,params,extra)=>{
    const target=new URL(params.redirect_uri);
    for(const [key,value] of Object.entries(extra))target.searchParams.set(key,value);
    if(params.state)target.searchParams.set('state',params.state);
    res.writeHead(302,baseHeaders({Location:target.toString()}));res.end();
  };
  const originAllowed=(req,base)=>{
    const origin=req.headers.origin;
    if(!origin)return true;
    return origin===base||config.allowedOrigins.includes(origin)||origin==='https://claude.ai'||origin==='https://claude.com';
  };

  async function connector(req,res,url){
    const path=url.pathname,base=publicBase(req);
    if(['/.well-known/oauth-protected-resource','/.well-known/oauth-protected-resource/mcp'].includes(path)&&req.method==='GET'){
      send(res,200,{resource:base+'/mcp',authorization_servers:[base],bearer_methods_supported:['header'],scopes_supported:[SCOPE],resource_name:'TelefonZona'});return true;
    }
    if(path==='/.well-known/oauth-authorization-server'&&req.method==='GET'){
      send(res,200,{issuer:base,authorization_endpoint:base+'/authorize',token_endpoint:base+'/token',registration_endpoint:base+'/register',
        response_types_supported:['code'],grant_types_supported:['authorization_code','refresh_token'],code_challenge_methods_supported:['S256'],
        token_endpoint_auth_methods_supported:['none'],scopes_supported:[SCOPE]});return true;
    }
    if(path==='/register'&&req.method==='POST'){
      try{send(res,201,oauth.registerClient(await readJson(req),clientIp(req)));}catch(error){
        if(error instanceof OAuthError)oauthError(res,error,error.status);
        else if(error instanceof HttpError||error instanceof CommandError)oauthError(res,new OAuthError('invalid_client_metadata','So‘rov noto‘g‘ri.'));
        else throw error;
      }
      return true;
    }
    if(path==='/authorize'&&(req.method==='GET'||req.method==='POST')){
      try{
        const params=req.method==='GET'?Object.fromEntries(url.searchParams):await readForm(req);
        const client=oauth.validateRequest(params);
        if(req.method==='GET'){authorizePage(res,params,client);return true;}
        if(params.decision==='deny'){redirectBack(res,params,{error:'access_denied'});return true;}
        try{await auth.checkCredentials(String(params.person??''),params.password,{ip:clientIp(req)});}
        catch(error){if(error instanceof AuthError){authorizePage(res,params,client,error.message);return true;}throw error;}
        redirectBack(res,params,{code:oauth.issueCode({client,personId:params.person,redirectUri:params.redirect_uri,challenge:params.code_challenge})});
      }catch(error){
        if(!(error instanceof OAuthError))throw error;
        // Never redirect to an address that was not validated: show the problem here instead.
        html(res,error.status||400,`<h1>TelefonZona</h1><p class="err">${esc(error.message)}</p>`);
      }
      return true;
    }
    if(path==='/token'&&req.method==='POST'){
      try{
        const form=await readForm(req);
        if(form.grant_type==='authorization_code')send(res,200,oauth.exchangeCode({code:form.code,clientId:form.client_id,redirectUri:form.redirect_uri,verifier:form.code_verifier}),{'Cache-Control':'no-store',Pragma:'no-cache'});
        else if(form.grant_type==='refresh_token')send(res,200,oauth.refresh({refreshToken:form.refresh_token,clientId:form.client_id}),{'Cache-Control':'no-store',Pragma:'no-cache'});
        else throw new OAuthError('unsupported_grant_type','Qo‘llanmaydigan grant turi.');
      }catch(error){if(error instanceof OAuthError)oauthError(res,error,error.status);else throw error;}
      return true;
    }
    if(path==='/mcp'){
      if(req.method!=='POST'){res.writeHead(405,baseHeaders({Allow:'POST'}));res.end();return true;}
      if(!originAllowed(req,base)){send(res,403,{error:'forbidden_origin'});return true;}
      const bearer=/^Bearer ([A-Za-z0-9_-]+)$/.exec(String(req.headers.authorization||''))?.[1];
      const grant=oauth.authenticate(bearer);
      if(!grant){
        send(res,401,{error:'invalid_token',error_description:'Kirish talab qilinadi.'},{'WWW-Authenticate':`Bearer resource_metadata="${base}/.well-known/oauth-protected-resource", scope="${SCOPE}"`});
        return true;
      }
      const message=await readJson(req,{allowArray:true});
      const reply=handleMcp({store,actor:grant.personId,message});
      if(reply===null){res.writeHead(202,baseHeaders());res.end();}
      else send(res,200,reply);
      return true;
    }
    return false;
  }

  return http.createServer(async(req,res)=>{
    try{
      const url=new URL(req.url,'http://localhost');
      if(url.pathname.startsWith('/api/'))return await api(req,res,url);
      if(await connector(req,res,url))return;
      return await serveStatic(req,res,url);
    }catch(error){
      if(error instanceof HttpError||error instanceof AuthError||error instanceof CommandError)
        return send(res,error.status,{ok:false,error:error.message});
      // Business rules throw plain Error with a readable Uzbek message; anything else is a bug.
      if(error&&error.constructor===Error)return send(res,422,{ok:false,error:error.message});
      log('Kutilmagan xato: '+(error?.stack||error));
      return send(res,500,{ok:false,error:'Server xatosi. Amal bajarilmadi.'});
    }
  });
}
