// Offline maintenance. Passwords are typed (hidden) or piped on stdin, never put in arguments.
import {loadConfig} from './config.js';
import {openDatabase} from './db.js';
import {Auth,AuthError} from './auth.js';
import {backupNow,pruneBackups} from './backup.js';
import {DEFAULT_PEOPLE} from '../src/access.js';

async function readSecret(question){
  if(!process.stdin.isTTY){
    let data='';
    for await(const chunk of process.stdin)data+=chunk;
    return data.split(/\r?\n/)[0];
  }
  process.stdout.write(question);
  return new Promise(resolve=>{
    let value='';
    process.stdin.setRawMode(true);process.stdin.resume();process.stdin.setEncoding('utf8');
    const onData=text=>{
      for(const ch of text){
        if(ch==='\r'||ch==='\n'){
          process.stdin.setRawMode(false);process.stdin.pause();process.stdin.off('data',onData);
          process.stdout.write('\n');return resolve(value);
        }
        if(ch==='\u0003'){process.stdout.write('\n');process.exit(130);}
        if(ch==='\u007f'||ch==='\b')value=value.slice(0,-1);else value+=ch;
      }
    };
    process.stdin.on('data',onData);
  });
}

const [,,command,argument]=process.argv;
const config=loadConfig();
const usage=`Buyruqlar:
  passwd <id>   xodim parolini o‘rnatish yoki almashtirish (id: ${DEFAULT_PEOPLE.map(p=>p.id).join(', ')})
  people        xodimlar va parol holati
  backup        bazaning zaxira nusxasini yaratish
  check         baza butunligini tekshirish`;

if(!['passwd','people','backup','check'].includes(command)){console.log(usage);process.exit(command?1:0);}
const db=openDatabase(config.dbFile);
try{
  const auth=new Auth(db,{sessionDays:config.sessionDays});
  if(command==='people'){
    for(const p of DEFAULT_PEOPLE)console.log(`${p.id.padEnd(8)} ${p.name.padEnd(10)} ${auth.hasAccount(p.id)?'parol bor':'parol YO‘Q'}`);
  }else if(command==='passwd'){
    if(!DEFAULT_PEOPLE.some(p=>p.id===argument)){console.log(usage);process.exit(1);}
    const first=await readSecret('Yangi parol: ');
    if(process.stdin.isTTY){
      const again=await readSecret('Parolni takrorlang: ');
      if(first!==again){console.error('Parollar mos kelmadi.');process.exit(1);}
    }
    await auth.setPassword(argument,first);
    console.log(`${argument} uchun parol o‘rnatildi. U barcha qurilmalardan chiqarildi.`);
  }else if(command==='backup'){
    const file=backupNow(db,config.backupDir);
    pruneBackups(config.backupDir,config.backupKeep);
    console.log('Zaxira nusxa: '+file);
  }else if(command==='check'){
    const rows=db.prepare('PRAGMA integrity_check').all();
    const ok=rows.length===1&&Object.values(rows[0])[0]==='ok';
    console.log(ok?'Baza butun: ok':'Baza muammosi: '+JSON.stringify(rows));
    process.exitCode=ok?0:1;
  }
}catch(error){
  console.error(error instanceof AuthError?error.message:'Xato: '+error.message);
  process.exitCode=1;
}finally{db.close();}
