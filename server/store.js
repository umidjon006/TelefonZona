import {createEmptyState} from '../src/model.js';
import {prepareState} from '../src/business.js';
import {readBackup,MAX_BACKUP_BYTES} from '../src/backup.js';
import {transaction} from './db.js';
import {runCommand,CommandError} from './commands.js';

const OP_ID=/^[A-Za-z0-9_-]{8,100}$/;

// The single place where shop records change. Commands run one at a time (this
// process is the only writer and SQLite calls are synchronous), inside one
// transaction, against the latest saved state. Nothing is saved unless the whole
// command succeeds and the result still passes the same checks as a backup file.
export class Store{
  constructor(db,{now=()=>new Date(),validate=true,onWarning=()=>{}}={}){
    this.db=db;this.now=now;this.validate=validate;this.onWarning=onWarning;
    if(!db.prepare('SELECT 1 FROM app_state WHERE id=1').get()){
      const state=prepareState(createEmptyState());
      db.prepare('INSERT INTO app_state(id,version,json,updated_at) VALUES(1,0,?,?)').run(JSON.stringify(state),now().toISOString());
    }
  }

  read(){
    const row=this.db.prepare('SELECT version,json FROM app_state WHERE id=1').get();
    return {version:row.version,state:JSON.parse(row.json)};
  }
  version(){return this.db.prepare('SELECT version FROM app_state WHERE id=1').get().version;}

  execute({actor,command,args,opId}){
    return this.transact({actor,command,opId},state=>runCommand(state,command,args,actor));
  }

  // The one place a change is applied: everything fn does to the state is saved together or not at all.
  // `source` marks the new history entries (for example "claude") so they can be told apart later.
  // fn may also write to other tables on this connection; they are part of the same transaction.
  transact({actor,command,opId,source=null},fn){
    if(opId!==undefined&&!OP_ID.test(opId))throw new CommandError('Amal raqami noto‘g‘ri.',400);
    return transaction(this.db,()=>{
      if(opId){
        const done=this.db.prepare('SELECT actor,command,version,response FROM operations WHERE op_id=?').get(opId);
        if(done){
          if(done.actor!==actor||done.command!==command)throw new CommandError('Bu amal raqami boshqa amal uchun ishlatilgan.',409);
          return {result:JSON.parse(done.response),version:done.version,replayed:true};
        }
      }
      const {version,state}=this.read();
      const historyBefore=state.audit.length;
      const raw=fn(state);
      const result=raw===undefined?null:raw;
      if(source)for(let i=0;i<state.audit.length-historyBefore;i++)state.audit[i].via=source;
      this.check(state);
      const next=version+1,json=JSON.stringify(state);
      this.db.prepare('UPDATE app_state SET version=?,json=?,updated_at=? WHERE id=1').run(next,json,this.now().toISOString());
      if(opId)this.db.prepare('INSERT INTO operations(op_id,actor,command,version,response,created_at) VALUES(?,?,?,?,?,?)')
        .run(opId,actor,command,next,JSON.stringify(result),this.now().toISOString());
      return {result,version:next,replayed:false};
    });
  }

  // Fail closed: a command that would leave inconsistent records is rejected.
  check(state){
    if(!this.validate)return;
    const raw=JSON.stringify(state);
    if(Buffer.byteLength(raw)>=MAX_BACKUP_BYTES){this.onWarning('Holat hajmi tekshiruv chegarasidan oshdi; tekshiruv o‘tkazib yuborildi.');return;}
    try{readBackup(raw);}catch(error){
      this.onWarning('Amal natijasi tekshiruvdan o‘tmadi: '+error.message);
      throw new CommandError('Amal hisob mosligini buzgani uchun bajarilmadi. Ma’lumotlar o‘zgarmadi.',409);
    }
  }
}
