import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const ROOT=fileURLToPath(new URL('../',import.meta.url));

// All settings come from environment variables; nothing secret is stored in code.
export function loadConfig(env=process.env){
  const port=Number(env.PORT||4180);
  if(!Number.isInteger(port)||port<1||port>65535)throw Error('PORT 1 dan 65535 gacha butun son bo‘lsin.');
  const dataDir=path.resolve(env.TZ_DATA_DIR||path.join(ROOT,'data/private'));
  const hours=Number(env.TZ_BACKUP_HOURS??24),keep=Number(env.TZ_BACKUP_KEEP??14);
  return {
    root:ROOT,
    dataDir,
    dbFile:env.TZ_DB?path.resolve(env.TZ_DB):path.join(dataDir,'telefonzona.db'),
    backupDir:path.join(dataDir,'backups'),
    // Loopback by default. Set HOST=0.0.0.0 only to try the app from a phone on the same Wi-Fi.
    host:env.HOST||'127.0.0.1',
    port,
    // Serve the build output instead of the sources when TZ_STATIC=dist.
    staticDir:env.TZ_STATIC==='dist'?path.join(ROOT,'dist'):ROOT,
    secureCookies:env.TZ_COOKIE_SECURE==='1',
    trustProxy:env.TZ_TRUST_PROXY==='1',
    allowedOrigins:String(env.TZ_ALLOWED_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean),
    sessionDays:30,
    backupEveryHours:Number.isFinite(hours)&&hours>=0?hours:24,
    backupKeep:Number.isInteger(keep)&&keep>=1?keep:14,
  };
}
