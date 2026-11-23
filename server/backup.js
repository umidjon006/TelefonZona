import {readdirSync,rmSync,chmodSync,mkdirSync} from 'node:fs';
import path from 'node:path';

const PATTERN=/^telefonzona-\d{8}-\d{6}\.db$/;

// Consistent copy of the live database (includes accounts); keep the folder private.
export function backupNow(db,dir,now=new Date()){
  mkdirSync(dir,{recursive:true,mode:0o700});
  const stamp=now.toISOString().replace(/[-:]/g,'').replace('T','-').slice(0,15);
  const file=path.join(dir,`telefonzona-${stamp}.db`);
  db.prepare('VACUUM INTO ?').run(file);
  try{chmodSync(file,0o600);}catch{}
  return file;
}

export function pruneBackups(dir,keep){
  let names;
  try{names=readdirSync(dir).filter(n=>PATTERN.test(n)).sort();}catch{return [];}
  const remove=names.slice(0,Math.max(0,names.length-keep));
  for(const name of remove)rmSync(path.join(dir,name),{force:true});
  return remove;
}
