import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,chmodSync,existsSync} from 'node:fs';
import path from 'node:path';

const SCHEMA=`
CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value TEXT NOT NULL);
-- The shop's records are one authoritative document, changed only by whole commands.
CREATE TABLE IF NOT EXISTS app_state(
  id INTEGER PRIMARY KEY CHECK(id=1),
  version INTEGER NOT NULL,
  json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS accounts(
  person_id TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  failed INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions(
  token_hash TEXT PRIMARY KEY,
  person_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  user_agent TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS sessions_person ON sessions(person_id);
-- Claude connectors (OAuth 2.1 + PKCE). Only hashes of codes and tokens are stored.
CREATE TABLE IF NOT EXISTS oauth_clients(
  client_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  redirect_uris TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS oauth_codes(
  code_hash TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  person_id TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  challenge TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'mcp:read',
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS oauth_tokens(
  token_hash TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  client_id TEXT NOT NULL,
  person_id TEXT NOT NULL,
  family TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'mcp:read',
  created_at INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL
);
-- Changes proposed through a connector: shown to the person first, applied only on confirmation.
CREATE TABLE IF NOT EXISTS mcp_proposals(
  id TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  plan TEXT NOT NULL,
  digest TEXT NOT NULL,
  preview TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  committed_at INTEGER
);
CREATE INDEX IF NOT EXISTS oauth_tokens_person ON oauth_tokens(person_id);
-- Idempotency: a retried command (bad network, double tap) is answered, never applied twice.
CREATE TABLE IF NOT EXISTS operations(
  op_id TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  command TEXT NOT NULL,
  version INTEGER NOT NULL,
  response TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`;

export function openDatabase(file){
  if(file!==':memory:'){
    mkdirSync(path.dirname(file),{recursive:true,mode:0o700});
  }
  const db=new DatabaseSync(file);
  // FULL keeps every committed command durable across a power cut.
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  db.exec(SCHEMA);
  addMissingColumns(db);
  if(file!==':memory:'){
    for(const suffix of ['','-wal','-shm'])if(existsSync(file+suffix))try{chmodSync(file+suffix,0o600);}catch{}
  }
  return db;
}

// Databases created before a column existed get it added (existing rows keep the safe default).
function addMissingColumns(db){
  for(const [table,column,ddl] of [
    ['oauth_codes','scope',"TEXT NOT NULL DEFAULT 'mcp:read'"],
    ['oauth_tokens','scope',"TEXT NOT NULL DEFAULT 'mcp:read'"],
    ['oauth_tokens','created_at','INTEGER NOT NULL DEFAULT 0'],
  ]){
    if(!db.prepare(`PRAGMA table_info(${table})`).all().some(c=>c.name===column))db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
  }
}

// Runs fn inside one write transaction; any thrown error rolls everything back.
export function transaction(db,fn){
  db.exec('BEGIN IMMEDIATE');
  try{
    const result=fn();
    db.exec('COMMIT');
    return result;
  }catch(error){
    try{db.exec('ROLLBACK');}catch{}
    throw error;
  }
}
