import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {DEFAULT_PEOPLE,people,isAdmin,can} from '../src/access.js';
import {remindersFor} from '../src/reminders.js';
import {Auth,AuthError} from './auth.js';
import {CommandError,assertPlain} from './commands.js';
import {viewFor,receiptFor} from './view.js';
import {isFrontendPath,CONTENT_TYPES} from '../scripts/frontend-files.mjs';

const COOKIE='tz_session';
const MAX_BODY=1024*1024;

class HttpError extends Error{constructor(message,status){super(message);this.status=status;}}

function parseCookies(header=''){
  const out={};
  for(const part of header.split(';')){const i=part.indexOf('=');if(i>0)out[part.slice(0,i).trim()]=part.slice(i+1).trim();}
  return out;
}

async function readJson(req){
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
    if(!body||typeof body!=='object'||Array.isArray(body))throw 0;
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

export async function createApp({store,auth,config,log=()=>{}}){
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

  return http.createServer(async(req,res)=>{
    try{
      const url=new URL(req.url,'http://localhost');
      if(url.pathname.startsWith('/api/'))return await api(req,res,url);
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
