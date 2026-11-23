// Thin client for the TelefonZona server. It is only used when the page itself
// was served by that server (it adds <meta name="telefonzona-server">). On static
// hosting the app keeps working locally exactly as before.
export class ApiError extends Error{
  constructor(message,status=0){super(message);this.status=status;}
}

export const isServerPage=()=>typeof document!=='undefined'&&!!document.querySelector('meta[name="telefonzona-server"]');

const TIMEOUT_MS=20000;

async function request(method,path,body,{text=false}={}){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
  let response;
  try{
    response=await fetch(path,{
      method,credentials:'same-origin',cache:'no-store',signal:controller.signal,
      headers:{'X-TZ-Client':'web',...(body!==undefined?{'Content-Type':'application/json'}:{})},
      body:body===undefined?undefined:JSON.stringify(body),
    });
  }catch{
    throw new ApiError('Server bilan aloqa yo‘q. Internetni tekshirib, qayta urinib ko‘ring.',0);
  }finally{clearTimeout(timer);}
  if(text&&response.ok)return response.text();
  let json=null;
  try{json=await response.json();}catch{}
  if(!response.ok)throw new ApiError(json?.error||`Server xatosi (${response.status}).`,response.status);
  return json;
}

export const api={
  people:()=>request('GET','/api/people'),
  login:(person,password)=>request('POST','/api/login',{person,password}),
  logout:()=>request('POST','/api/logout',{}),
  me:()=>request('GET','/api/me'),
  // Without `since` the full snapshot is returned; with it, {unchanged:true} if nothing changed.
  state:since=>request('GET','/api/state'+(since===undefined?'':'?since='+encodeURIComponent(since))),
  command:(command,args,opId)=>request('POST','/api/commands',{command,args,opId}),
  receipt:id=>request('GET','/api/receipts/'+encodeURIComponent(id)),
  changePassword:(current,next)=>request('POST','/api/password',{current,next}),
  resetPassword:(person,password)=>request('POST','/api/admin/password',{person,password}),
  exportBackup:()=>request('GET','/api/export',undefined,{text:true}),
};
