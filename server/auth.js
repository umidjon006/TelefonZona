import {scrypt as scryptCallback,randomBytes,timingSafeEqual,createHash} from 'node:crypto';
import {promisify} from 'node:util';
import {DEFAULT_PEOPLE} from '../src/access.js';
import {transaction} from './db.js';

const scrypt=promisify(scryptCallback);
const COST={N:2**15,r:8,p:1,keyLength:64};
const MAX_FAILED=5,LOCK_MS=15*60*1000;
const IP_WINDOW_MS=10*60*1000,IP_MAX=30;

export class AuthError extends Error{
  constructor(message,status=401){super(message);this.status=status;}
}

export function checkPasswordPolicy(password){
  if(typeof password!=='string'||password.length<8||password.length>128)throw new AuthError('Parol 8 dan 128 belgigacha bo‘lsin.',422);
  if(new Set(password).size<3)throw new AuthError('Parol juda oddiy. Har xil belgilardan foydalaning.',422);
}

export async function hashPassword(password){
  const salt=randomBytes(16);
  const key=await scrypt(password,salt,COST.keyLength,{N:COST.N,r:COST.r,p:COST.p,maxmem:128*COST.N*COST.r*2});
  return ['scrypt',COST.N,COST.r,COST.p,salt.toString('base64'),key.toString('base64')].join('$');
}

export async function verifyPassword(password,stored){
  const [scheme,N,r,p,salt,hash]=String(stored).split('$');
  if(scheme!=='scrypt'||!hash)return false;
  const expected=Buffer.from(hash,'base64');
  const key=await scrypt(password,Buffer.from(salt,'base64'),expected.length,{N:+N,r:+r,p:+p,maxmem:128*(+N)*(+r)*2});
  return key.length===expected.length&&timingSafeEqual(key,expected);
}

const digest=token=>createHash('sha256').update(token).digest('hex');
let decoyHash;

export class Auth{
  constructor(db,{now=()=>Date.now(),sessionDays=30}={}){
    this.db=db;this.now=now;this.sessionMs=sessionDays*86400000;
    this.attempts=new Map();
    this.purge();
  }
  purge(){this.db.prepare('DELETE FROM sessions WHERE expires_at<?').run(this.now());}

  hasAccount(personId){return !!this.db.prepare('SELECT 1 FROM accounts WHERE person_id=?').get(personId);}

  // Creates or replaces a password and signs the person out everywhere.
  async setPassword(personId,password){
    if(!DEFAULT_PEOPLE.some(p=>p.id===personId))throw new AuthError('Xodim topilmadi.',404);
    checkPasswordPolicy(password);
    const hash=await hashPassword(password),stamp=new Date(this.now()).toISOString();
    transaction(this.db,()=>{
      this.db.prepare(`INSERT INTO accounts(person_id,password_hash,failed,locked_until,created_at,updated_at) VALUES(?,?,0,0,?,?)
        ON CONFLICT(person_id) DO UPDATE SET password_hash=excluded.password_hash,failed=0,locked_until=0,updated_at=excluded.updated_at`).run(personId,hash,stamp,stamp);
      this.db.prepare('DELETE FROM sessions WHERE person_id=?').run(personId);
      // A new password also disconnects every Claude connector that person authorised.
      this.db.prepare('DELETE FROM oauth_tokens WHERE person_id=?').run(personId);
    });
  }

  async changePassword(personId,current,next,keepToken){
    const row=this.db.prepare('SELECT password_hash FROM accounts WHERE person_id=?').get(personId);
    if(!row||!await verifyPassword(String(current??''),row.password_hash))throw new AuthError('Joriy parol noto‘g‘ri.',403);
    await this.setPassword(personId,next);
    // The device that changed it stays signed in.
    if(keepToken)return this.createSession(personId,'');
    return null;
  }

  limitIp(ip){
    const now=this.now(),entry=this.attempts.get(ip);
    if(!entry||now-entry.start>IP_WINDOW_MS){this.attempts.set(ip,{start:now,count:1});return;}
    entry.count++;
    if(entry.count>IP_MAX)throw new AuthError('Juda ko‘p urinish. Birozdan keyin qayta urinib ko‘ring.',429);
  }

  // Verifies a password (with lockout and rate limits) without opening a session.
  async checkCredentials(personId,password,{ip=''}={}){
    this.limitIp(ip);
    const row=DEFAULT_PEOPLE.some(p=>p.id===personId)?this.db.prepare('SELECT * FROM accounts WHERE person_id=?').get(personId):null;
    if(row&&row.locked_until>this.now()){
      const minutes=Math.ceil((row.locked_until-this.now())/60000);
      throw new AuthError(`Ko‘p marta noto‘g‘ri kiritildi. ${minutes} daqiqadan keyin urinib ko‘ring.`,429);
    }
    // Unknown people and missing accounts cost the same time as a real check.
    decoyHash??=await hashPassword('decoy-password-for-timing');
    const ok=await verifyPassword(typeof password==='string'?password:'',row?row.password_hash:decoyHash)&&!!row;
    if(!ok){
      if(row){
        const failed=row.failed+1,lock=failed>=MAX_FAILED?this.now()+LOCK_MS:0;
        this.db.prepare('UPDATE accounts SET failed=?,locked_until=? WHERE person_id=?').run(lock?0:failed,lock,personId);
      }
      throw new AuthError('Xodim yoki parol noto‘g‘ri.',401);
    }
    this.db.prepare('UPDATE accounts SET failed=0,locked_until=0 WHERE person_id=?').run(personId);
    this.attempts.delete(ip);
    return true;
  }

  async login(personId,password,{ip='',userAgent=''}={}){
    await this.checkCredentials(personId,password,{ip});
    return this.createSession(personId,userAgent);
  }

  createSession(personId,userAgent=''){
    const token=randomBytes(32).toString('base64url'),now=this.now(),expires=now+this.sessionMs;
    transaction(this.db,()=>{
      this.db.prepare('INSERT INTO sessions(token_hash,person_id,created_at,last_seen,expires_at,user_agent) VALUES(?,?,?,?,?,?)').run(digest(token),personId,now,now,expires,String(userAgent).slice(0,200));
      // Keep only the ten most recent devices per person.
      this.db.prepare(`DELETE FROM sessions WHERE person_id=? AND token_hash NOT IN
        (SELECT token_hash FROM sessions WHERE person_id=? ORDER BY last_seen DESC LIMIT 10)`).run(personId,personId);
    });
    return {token,expiresAt:expires};
  }

  // Returns the person for a valid cookie token, extending the session at most hourly.
  authenticate(token){
    if(typeof token!=='string'||token.length<20||token.length>100)return null;
    const key=digest(token),now=this.now();
    const row=this.db.prepare('SELECT person_id,last_seen,expires_at FROM sessions WHERE token_hash=?').get(key);
    if(!row)return null;
    if(row.expires_at<=now){this.db.prepare('DELETE FROM sessions WHERE token_hash=?').run(key);return null;}
    if(now-row.last_seen>3600000)this.db.prepare('UPDATE sessions SET last_seen=?,expires_at=? WHERE token_hash=?').run(now,now+this.sessionMs,key);
    return row.person_id;
  }

  logout(token){if(typeof token==='string')this.db.prepare('DELETE FROM sessions WHERE token_hash=?').run(digest(token));}
  revokeAll(personId){
    this.db.prepare('DELETE FROM sessions WHERE person_id=?').run(personId);
    this.db.prepare('DELETE FROM oauth_tokens WHERE person_id=?').run(personId);
  }
}
