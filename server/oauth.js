// OAuth 2.1 authorization server for Claude custom connectors: dynamic client
// registration, authorization code + PKCE (S256), short access tokens, rotating
// refresh tokens. People sign in with their normal TelefonZona password, so a
// connector can never do more than that person may, and a password change cuts it off.
import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {DEFAULT_PEOPLE} from '../src/access.js';
import {transaction} from './db.js';

export const SCOPE_READ='mcp:read',SCOPE_WRITE='mcp:write';
export const SCOPE=SCOPE_READ;
export const SCOPES=[SCOPE_READ,SCOPE_WRITE];
const ACCESS_MS=60*60*1000,REFRESH_MS=30*24*60*60*1000,CODE_MS=10*60*1000;
const MAX_CLIENTS=200;
const hash=value=>createHash('sha256').update(value).digest('hex');
const random=bytes=>randomBytes(bytes).toString('base64url');

export class OAuthError extends Error{
  constructor(code,description,status=400){super(description);this.code=code;this.status=status;}
}

// Claude's own callback addresses, plus loopback for developer tools. Nothing else.
const REDIRECTS=[
  /^https:\/\/claude\.ai\/api\/mcp\/auth_callback$/,
  /^https:\/\/claude\.com\/api\/mcp\/auth_callback$/,
  /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?\/[A-Za-z0-9_\-./]*$/,
];
export function redirectAllowed(uri){
  if(typeof uri!=='string'||uri.length>300)return false;
  try{const url=new URL(uri);if(url.hash||url.username||url.password)return false;}catch{return false;}
  return REDIRECTS.some(pattern=>pattern.test(uri));
}

const equal=(a,b)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);};

export class OAuth{
  constructor(db,auth,{now=()=>Date.now()}={}){
    this.db=db;this.auth=auth;this.now=now;this.registrations=new Map();
    this.purge();
  }
  purge(){
    const now=this.now();
    this.db.prepare('DELETE FROM oauth_codes WHERE expires_at<?').run(now);
    this.db.prepare('DELETE FROM oauth_tokens WHERE expires_at<?').run(now);
  }

  limitRegistration(ip){
    const now=this.now(),entry=this.registrations.get(ip);
    if(!entry||now-entry.start>3600000){this.registrations.set(ip,{start:now,count:1});return;}
    if(++entry.count>20)throw new OAuthError('temporarily_unavailable','Juda ko‘p urinish. Keyinroq qayta urinib ko‘ring.',429);
  }

  registerClient(metadata,ip=''){
    this.limitRegistration(ip);
    const uris=metadata?.redirect_uris;
    if(!Array.isArray(uris)||!uris.length||uris.length>5||!uris.every(redirectAllowed))
      throw new OAuthError('invalid_redirect_uri','Faqat Claude va mahalliy (localhost) qaytish manzillariga ruxsat beriladi.');
    const name=String(metadata.client_name||'Claude').replace(/[\u0000-\u001f<>"']/g,'').trim().slice(0,60)||'Claude';
    const clientId='tzc_'+random(18);
    transaction(this.db,()=>{
      this.db.prepare('INSERT INTO oauth_clients(client_id,name,redirect_uris,created_at) VALUES(?,?,?,?)').run(clientId,name,JSON.stringify(uris),this.now());
      this.db.prepare(`DELETE FROM oauth_clients WHERE client_id NOT IN (SELECT client_id FROM oauth_clients ORDER BY created_at DESC LIMIT ${MAX_CLIENTS})`).run();
    });
    return {client_id:clientId,client_name:name,redirect_uris:uris,grant_types:['authorization_code','refresh_token'],response_types:['code'],token_endpoint_auth_method:'none',scope:SCOPE};
  }

  client(clientId){
    const row=typeof clientId==='string'?this.db.prepare('SELECT * FROM oauth_clients WHERE client_id=?').get(clientId):null;
    return row?{id:row.client_id,name:row.name,redirectUris:JSON.parse(row.redirect_uris)}:null;
  }

  // The authorization request is checked once when the form is shown and again on submit.
  validateRequest(params){
    const client=this.client(params.client_id);
    if(!client)throw new OAuthError('invalid_client','Noma’lum ilova. Connectorni qaytadan qo‘shing.');
    if(!client.redirectUris.includes(params.redirect_uri))throw new OAuthError('invalid_request','Qaytish manzili ro‘yxatdan o‘tgan manzilga mos emas.');
    if(params.response_type!=='code')throw new OAuthError('unsupported_response_type','Faqat code turi qo‘llanadi.');
    if(params.code_challenge_method!=='S256'||!/^[A-Za-z0-9_-]{43}$/.test(params.code_challenge||''))
      throw new OAuthError('invalid_request','PKCE (S256) talab qilinadi.');
    return client;
  }

  // scope is chosen by the person on the sign-in page, never by the app asking for access.
  issueCode({client,personId,redirectUri,challenge,scope=SCOPE_READ}){
    const parts=String(scope).split(' ');
    if(!parts.every(part=>SCOPES.includes(part))||!parts.includes(SCOPE_READ))throw new OAuthError('invalid_scope','Ruxsat turi noto‘g‘ri.');
    const code=random(32);
    this.db.prepare('INSERT INTO oauth_codes(code_hash,client_id,person_id,redirect_uri,challenge,scope,expires_at) VALUES(?,?,?,?,?,?,?)')
      .run(hash(code),client.id,personId,redirectUri,challenge,scope,this.now()+CODE_MS);
    return code;
  }

  tokens(clientId,personId,family,scope,createdAt){
    const access=random(32),refresh=random(32),now=this.now(),since=createdAt||now;
    const insert=this.db.prepare('INSERT INTO oauth_tokens(token_hash,kind,client_id,person_id,family,scope,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?)');
    insert.run(hash(access),'access',clientId,personId,family,scope,since,now+ACCESS_MS);
    insert.run(hash(refresh),'refresh',clientId,personId,family,scope,since,now+REFRESH_MS);
    return {access_token:access,token_type:'Bearer',expires_in:ACCESS_MS/1000,refresh_token:refresh,scope};
  }

  exchangeCode({code,clientId,redirectUri,verifier}){
    if(typeof code!=='string'||typeof verifier!=='string'||!/^[A-Za-z0-9\-._~]{43,128}$/.test(verifier))
      throw new OAuthError('invalid_request','Kod yoki PKCE tekshiruvi noto‘g‘ri.');
    // The outcome is decided inside the transaction and thrown after it: a failed attempt must
    // still burn the code, so the deletion has to be committed.
    const outcome=transaction(this.db,()=>{
      const row=this.db.prepare('SELECT * FROM oauth_codes WHERE code_hash=?').get(hash(code));
      // A code works once, whatever happens next.
      this.db.prepare('DELETE FROM oauth_codes WHERE code_hash=?').run(hash(code));
      if(!row||row.expires_at<this.now()||row.client_id!==clientId||row.redirect_uri!==redirectUri)
        return {error:'Kod yaroqsiz yoki muddati o‘tgan.'};
      const challenge=createHash('sha256').update(verifier).digest('base64url');
      if(!equal(challenge,row.challenge))return {error:'PKCE tekshiruvi o‘tmadi.'};
      return {tokens:this.tokens(row.client_id,row.person_id,random(12),row.scope)};
    });
    if(outcome.error)throw new OAuthError('invalid_grant',outcome.error);
    return outcome.tokens;
  }

  refresh({refreshToken,clientId}){
    if(typeof refreshToken!=='string')throw new OAuthError('invalid_request','Refresh token kerak.');
    const outcome=transaction(this.db,()=>{
      const row=this.db.prepare("SELECT * FROM oauth_tokens WHERE token_hash=? AND kind IN ('refresh','spent')").get(hash(refreshToken));
      if(!row||row.kind==='spent'||row.expires_at<this.now()||row.client_id!==clientId){
        // A spent refresh token coming back may mean a leak: end that whole login (committed, then reported).
        if(row)this.db.prepare('DELETE FROM oauth_tokens WHERE family=?').run(row.family);
        return {error:true};
      }
      // Rotation: the old pair stops working; the spent refresh token is remembered to detect reuse.
      this.db.prepare("DELETE FROM oauth_tokens WHERE family=? AND kind='access'").run(row.family);
      this.db.prepare("UPDATE oauth_tokens SET kind='spent' WHERE family=? AND kind='refresh'").run(row.family);
      return {tokens:this.tokens(row.client_id,row.person_id,row.family,row.scope,row.created_at)};
    });
    if(outcome.error)throw new OAuthError('invalid_grant','Refresh token yaroqsiz.');
    return outcome.tokens;
  }

  authenticate(bearer){
    if(typeof bearer!=='string'||bearer.length<20||bearer.length>200)return null;
    const row=this.db.prepare("SELECT person_id,client_id,scope,expires_at FROM oauth_tokens WHERE token_hash=? AND kind='access'").get(hash(bearer));
    if(!row||row.expires_at<this.now())return null;
    return DEFAULT_PEOPLE.some(p=>p.id===row.person_id)?{personId:row.person_id,clientId:row.client_id,scope:row.scope,canWrite:row.scope.split(' ').includes(SCOPE_WRITE)}:null;
  }

  // Connections (one per authorisation), for the boss's and each person's "Claude ulanishlari" list.
  connections(personId=null){
    const rows=this.db.prepare(`SELECT t.family,t.client_id,t.person_id,t.scope,MIN(t.created_at) since,MAX(t.expires_at) until,c.name
      FROM oauth_tokens t LEFT JOIN oauth_clients c ON c.client_id=t.client_id WHERE t.kind IN ('access','refresh') GROUP BY t.family ORDER BY since DESC`).all();
    return rows.filter(r=>!personId||r.person_id===personId).map(r=>({id:r.family,client:r.name||'Claude',person:r.person_id,scope:r.scope,since:r.since||null,until:r.until}));
  }
  revokeConnection(family,personId=null){
    const row=this.db.prepare('SELECT person_id FROM oauth_tokens WHERE family=? LIMIT 1').get(String(family));
    if(!row||(personId&&row.person_id!==personId))return false;
    this.db.prepare('DELETE FROM oauth_tokens WHERE family=?').run(String(family));
    return true;
  }

  // Disconnect every connector a person authorised (also done on password change).
  revoke(personId){this.db.prepare('DELETE FROM oauth_tokens WHERE person_id=?').run(personId);}
}
