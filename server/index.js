import {loadConfig} from './config.js';
import {openDatabase} from './db.js';
import {Store} from './store.js';
import {Auth} from './auth.js';
import {createApp} from './http.js';
import {backupNow,pruneBackups} from './backup.js';
import {DEFAULT_PEOPLE} from '../src/access.js';

const config=loadConfig();
const log=message=>console.error(`[${new Date().toISOString()}] ${message}`);
const db=openDatabase(config.dbFile);
const store=new Store(db,{onWarning:log});
const auth=new Auth(db,{sessionDays:config.sessionDays});
const server=await createApp({store,auth,config,log});

const missing=DEFAULT_PEOPLE.filter(p=>!auth.hasAccount(p.id));
function runBackup(){
  try{
    const file=backupNow(db,config.backupDir);
    pruneBackups(config.backupDir,config.backupKeep);
    log('Zaxira nusxa yaratildi: '+file);
  }catch(error){log('Zaxira nusxa yaratilmadi: '+error.message);}
}
if(config.backupEveryHours>0){
  runBackup();
  setInterval(runBackup,config.backupEveryHours*3600000).unref();
}
setInterval(()=>auth.purge(),3600000).unref();

server.on('error',error=>{
  log(error.code==='EADDRINUSE'?`${config.port} port band. PORT=4181 bilan qayta urinib ko‘ring.`:error.message);
  process.exitCode=1;
});
server.listen(config.port,config.host,()=>{
  console.log(`TelefonZona server: http://${config.host==='0.0.0.0'?'localhost':config.host}:${config.port}`);
  console.log(`Ma’lumotlar bazasi: ${config.dbFile}`);
  if(config.publicUrl)console.log(`Claude connector manzili: ${config.publicUrl}/mcp (docs/MCP.md)`);
  if(missing.length)console.log(`Parol o‘rnatilmagan: ${missing.map(p=>p.id).join(', ')}. Buyruq: npm run server:passwd -- <id>`);
  if(config.host!=='127.0.0.1'&&config.host!=='localhost'&&!config.secureCookies)console.log('Ogohlantirish: HTTPS yo‘q. Ochiq internetga chiqarishdan oldin HTTPS va TZ_COOKIE_SECURE=1 kerak.');
});

let closing=false;
function shutdown(){
  if(closing)return;closing=true;
  server.close(()=>{try{db.close();}catch{}process.exit(0);});
  setTimeout(()=>{try{db.close();}catch{}process.exit(0);},5000).unref();
}
process.on('SIGINT',shutdown);
process.on('SIGTERM',shutdown);
