import {openDatabase} from '../server/db.js';
import {Store} from '../server/store.js';
import {Auth} from '../server/auth.js';
import {createApp} from '../server/http.js';
import {ROOT} from '../server/config.js';

export const PASSWORDS={aziz:'otabek-sinov-1',sardor:'boybek-sinov-1',jasur:'asilbek-sinov-1'};
export const PRODUCT={name:'Sinov kabel',variant:'USB-C · 1 metr',note:'Birinchi kirim',owner:'aziz',category:'Kabellar',brand:'other',qty:10,cost:20000,price:30000,minPrice:25000,min:2};

export class Client{
  constructor(base){this.base=base;this.cookie='';this.opCounter=0;}
  async call(method,path,body,{headers={},sameSite=true}={}){
    const init={method,headers:{...(sameSite?{'x-tz-client':'web'}:{}),...headers}};
    if(this.cookie)init.headers.cookie=this.cookie;
    if(body!==undefined){init.headers['content-type']='application/json';init.body=JSON.stringify(body);}
    const res=await fetch(this.base+path,init);
    const set=res.headers.getSetCookie?.()||[];
    for(const line of set){const pair=line.split(';')[0];this.cookie=pair.endsWith('=')?'':pair;}
    const text=await res.text();
    let json;try{json=JSON.parse(text);}catch{json=undefined;}
    return {status:res.status,json,text,headers:res.headers,setCookie:set};
  }
  get(path,options){return this.call('GET',path,undefined,options);}
  post(path,body,options){return this.call('POST',path,body,options);}
  async login(person,password=PASSWORDS[person]){return this.post('/api/login',{person,password});}
  command(command,args={},opId){return this.post('/api/commands',{command,args,opId:opId||`op-${command.replace(/\W/g,'-')}-${++this.opCounter}-${Math.random().toString(36).slice(2,10)}`});}
}

export async function boot({passwords=true,staticDir=ROOT}={}){
  const db=openDatabase(':memory:');
  const warnings=[];
  const store=new Store(db,{onWarning:message=>warnings.push(message)});
  const auth=new Auth(db);
  if(passwords)for(const [id,password] of Object.entries(PASSWORDS))await auth.setPassword(id,password);
  const config={staticDir,allowedOrigins:[],trustProxy:false,secureCookies:false};
  const server=await createApp({store,auth,config,log:()=>{}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  const client=()=>new Client(base);
  async function signIn(person){const c=client();const r=await c.login(person);if(r.status!==200)throw Error('login failed '+r.status+' '+r.text);return c;}
  return {db,store,auth,server,base,client,signIn,warnings,close:async()=>{await new Promise(resolve=>server.close(resolve));db.close();}};
}
