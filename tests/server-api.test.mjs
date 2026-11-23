import test from 'node:test';
import assert from 'node:assert/strict';
import {boot,PRODUCT,PASSWORDS} from './server-helpers.mjs';
import {readBackup} from '../src/backup.js';

async function withServer(fn,options){
  const ctx=await boot(options);
  try{await fn(ctx);}finally{await ctx.close();}
}
async function setup(ctx){
  const [boss,boybek,asilbek]=await Promise.all(['aziz','sardor','jasur'].map(id=>ctx.signIn(id)));
  const made=await boss.command('product.register',{data:PRODUCT});
  assert.equal(made.status,200,made.text);
  const product=made.json.view.products[0];
  return {boss,boybek,asilbek,product};
}
const sale=(product,qty=1,price=30000,extra={})=>({cart:[{productId:product.id,qty,price}],received:qty*price,data:{payment:'Naqd',...extra}});

test('sign-in, cookie flags, and write requests need the app header and same origin',async()=>withServer(async ctx=>{
  const anonymous=ctx.client();
  assert.equal((await anonymous.get('/api/state')).status,401);
  assert.equal((await anonymous.login('aziz','noto‘g‘ri-parol')).status,401);
  assert.equal((await anonymous.login('nobody','x')).status,401);
  const ok=await anonymous.login('aziz');
  assert.equal(ok.status,200);
  const cookie=ok.setCookie[0];
  assert.match(cookie,/HttpOnly/);assert.match(cookie,/SameSite=Strict/);
  assert.equal((await anonymous.get('/api/me')).json.user.admin,true);
  const noHeader=await anonymous.post('/api/commands',{command:'notices.markRead'},{sameSite:false});
  assert.equal(noHeader.status,403);
  const foreign=await anonymous.post('/api/commands',{command:'notices.markRead'},{headers:{origin:'https://evil.example'}});
  assert.equal(foreign.status,403);
  const same=await anonymous.post('/api/commands',{command:'notices.markRead'},{headers:{origin:ctx.base}});
  assert.equal(same.status,200);
  assert.equal((await anonymous.post('/api/logout',{})).status,200);
  assert.equal((await anonymous.get('/api/me')).status,401);
}));

test('five wrong passwords lock the account; the right password is then refused for a while',async()=>withServer(async ctx=>{
  const c=ctx.client();
  for(let i=0;i<5;i++)assert.equal((await c.login('jasur','xato-parol-'+i)).status,401);
  const locked=await c.login('jasur');
  assert.equal(locked.status,429);
  assert.match(locked.json.error,/daqiqa/);
  assert.equal((await ctx.client().login('sardor')).status,200,'other accounts are unaffected');
}));

test('accounts without a password cannot sign in and there are no default passwords',async()=>withServer(async ctx=>{
  const c=ctx.client();
  assert.equal((await c.login('aziz','')).status,401);
  assert.equal((await c.login('aziz','admin')).status,401);
},{passwords:false}));

test('a seller sells another owner’s product: seller comes from the session, stock and cost stay correct',async()=>withServer(async ctx=>{
  const {boybek,product}=await setup(ctx);
  const r=await boybek.command('sale.record',sale(product,2));
  assert.equal(r.status,200,r.text);
  assert.equal(r.json.result.seller,'sardor');
  assert.equal(r.json.result.items[0].owner,'aziz');
  assert.equal(r.json.view.products[0].lots[0].qty,8);
  // a forged actor in the payload is ignored: the session decides
  const forged=await boybek.command('sale.record',{...sale(product,1),actor:'aziz',seller:'aziz'});
  assert.equal(forged.json.result.seller,'sardor');
  const {state}=ctx.store.read();
  assert.equal(state.sales.every(s=>s.seller==='sardor'),true);
  assert.equal(state.sales[0].items[0].cost,40000);
}));

test('a retried command with the same operation id is answered, never applied twice',async()=>withServer(async ctx=>{
  const {boybek,product}=await setup(ctx);
  const first=await boybek.command('sale.record',sale(product,3),'op-double-tap-0001');
  const second=await boybek.command('sale.record',sale(product,3),'op-double-tap-0001');
  assert.equal(second.status,200);
  assert.equal(second.json.replayed,true);
  assert.equal(second.json.result.id,first.json.result.id);
  assert.equal(ctx.store.read().state.products[0].lots[0].qty,7);
  const other=await boybek.command('sale.record',sale(product,1),'op-double-tap-0001');
  assert.equal(other.status,200,'same command and person replays');
  const reused=await ctx.client().login('jasur').then(()=>null);void reused;
  const asilbek=await ctx.signIn('jasur');
  const clash=await asilbek.command('sale.record',sale(product,1),'op-double-tap-0001');
  assert.equal(clash.status,409,'an id used by someone else is refused');
}));

test('selling more than is in stock is refused and leaves the records untouched',async()=>withServer(async ctx=>{
  const {boybek,asilbek,product}=await setup(ctx);
  const before=ctx.store.version();
  const r=await boybek.command('sale.record',sale(product,11));
  assert.equal(r.status,422);
  assert.equal(ctx.store.version(),before);
  // two people racing for the last units: the second is told no
  assert.equal((await boybek.command('sale.record',sale(product,6))).status,200);
  const late=await asilbek.command('sale.record',sale(product,6));
  assert.equal(late.status,422);
  assert.equal(ctx.store.read().state.products[0].lots[0].qty,4);
}));

test('boss-only commands are refused for sellers on the server, whatever the screen shows',async()=>withServer(async ctx=>{
  const {boybek}=await setup(ctx);
  for(const [command,args] of [['closing.close',{data:{actual:1,float:0,handover:false,note:'x'}}],['settings.update',{shop:'Boshqa',adminName:'Otabek'}],
    ['intake.create',{data:{worker:'sardor',lines:[{label:'x',qty:1}]}}],['opening.set',{accounts:{cash:5},payables:{},note:'x'}],['notices.markRead',{}],
    ['staff.permissions',{person:'sardor',name:'Boybek',permissions:{}}],['rent.set',{month:'2026-11',amount:5,note:'x'}]]){
    const r=await boybek.command(command,args);
    assert.equal(r.status,403,command);
  }
  assert.equal((await boybek.post('/api/commands',{command:'yo‘q.amal'})).status,404);
  assert.equal((await boybek.post('/api/commands',{command:'__proto__'})).status,404);
  const poisoned=await boybek.post('/api/commands','{"command":"flow.record","args":{"data":{"__proto__":{"admin":true}}}}'.length&&{command:'flow.record',args:JSON.parse('{"data":{"__proto__":{"x":1}}}')});
  assert.equal(poisoned.status,400);
  assert.equal((await boybek.get('/api/export')).status,403);
}));

test('Otabek turns a permission off and the server stops that seller',async()=>withServer(async ctx=>{
  const {boss,asilbek,product}=await setup(ctx);
  const me=(await asilbek.get('/api/me')).json.user;
  assert.equal(me.permissions.sell,true);
  const permissions={...me.permissions};
  const ids=['sell','credit','priceException','inventory','products','services','stock','prices','cash','debts','returns','defects','reverse'];
  const full=Object.fromEntries(ids.map(id=>[id,me.permissions[id]]));full.sell=false;void permissions;
  assert.equal((await boss.command('staff.permissions',{person:'jasur',name:'Asilbek',permissions:full})).status,200);
  const r=await asilbek.command('sale.record',sale(product,1));
  assert.equal(r.status,422);
  assert.match(r.json.error,/ruxsat/i);
}));

test('a seller’s device never receives reports, rent, closings, audit or other people’s receipts',async()=>withServer(async ctx=>{
  const {boss,boybek,asilbek,product}=await setup(ctx);
  const month=new Date().toISOString().slice(0,7);
  assert.equal((await boss.command('rent.set',{month,amount:777777,note:'IJARA-MAXFIY'})).status,200);
  assert.equal((await boss.command('flow.record',{data:{kind:'expense',category:'Elektr',account:'cash',amount:55555,note:'XARAJAT-MAXFIY'}})).status,200);
  assert.equal((await boss.command('closing.close',{data:{actual:100000,float:50000,handover:false,note:'SANOQ-MAXFIY'}})).status,200);
  assert.equal((await boss.command('opening.set',{accounts:{cash:123456},payables:{jasur:0,sardor:0},note:'BOSHLANGICH-MAXFIY'})).status,200);
  assert.equal((await boss.command('sale.record',sale(product,1))).status,200);
  const mine=(await boybek.command('sale.record',sale(product,2))).json.result;
  const bossView=(await boss.get('/api/state')).text,staffView=(await asilbek.get('/api/state')).text,boybekView=(await boybek.get('/api/state')).json.view;
  for(const secret of ['IJARA-MAXFIY','XARAJAT-MAXFIY','SANOQ-MAXFIY','BOSHLANGICH-MAXFIY'])assert.ok(bossView.includes(secret),'boss sees '+secret),assert.ok(!staffView.includes(secret),'staff must not see '+secret);
  assert.deepEqual(boybekView.sales.map(s=>s.id),[mine.id],'only own receipts');
  assert.equal('cost' in boybekView.sales[0].items[0],false);
  assert.equal('alloc' in boybekView.sales[0].items[0],false);
  assert.equal(boybekView.audit.length,0);assert.equal(boybekView.closings.length,0);assert.equal(boybekView.rents.length,0);
  assert.equal(boybekView.settings.permissions.aziz,undefined);
  assert.equal(boybekView.settings.openingAccounts.cash,0);
}));

test('a debt due today reminds Otabek and the sellers; contacts show only to those who may collect',async()=>withServer(async ctx=>{
  const {boss,boybek,asilbek,product}=await setup(ctx);
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tashkent'}).format(new Date());
  const credit=await boybek.command('sale.record',{cart:[{productId:product.id,qty:2,price:30000}],received:10000,data:{payment:'Naqd',customer:'Ali Valiyev',phone:'+998901234567',due:today,note:'nasiya'}});
  assert.equal(credit.status,200,credit.text);
  for(const c of [boss,boybek,asilbek]){
    const {reminders}=(await c.get('/api/reminders')).json;
    const debt=reminders.find(r=>r.kind==='debt');
    assert.ok(debt,'reminder reaches everyone');
    assert.equal(debt.level,'today');
    assert.match(debt.text,/^Bugun Ali Valiyev qarzini berishi kerak · 50 000 so‘m$/);
    assert.equal(debt.phone,'+998901234567');
  }
  const me=(await asilbek.get('/api/me')).json.user.permissions;
  const ids=['sell','credit','priceException','inventory','products','services','stock','prices','cash','debts','returns','defects','reverse'];
  const full=Object.fromEntries(ids.map(id=>[id,me[id]]));full.debts=false;
  await boss.command('staff.permissions',{person:'jasur',name:'Asilbek',permissions:full});
  const limited=(await asilbek.get('/api/reminders')).json.reminders.find(r=>r.kind==='debt');
  assert.match(limited.text,/Ali Valiyev/);
  assert.equal(limited.phone,undefined);assert.equal(limited.debtId,undefined);
  // paying it off removes the reminder everywhere
  const debtId=(await boss.get('/api/state')).json.view.debts[0].id;
  assert.equal((await boss.command('debt.repay',{id:debtId,amount:50000,note:'to‘liq to‘landi'})).status,200);
  assert.equal((await boybek.get('/api/reminders')).json.reminders.some(r=>r.kind==='debt'),false);
}));

test('goods handed to a worker: others are blocked, the worker records receipts, history shows who entered what',async()=>withServer(async ctx=>{
  const {boss,boybek,asilbek,product}=await setup(ctx);
  const made=await boss.command('intake.create',{data:{worker:'jasur',note:'Ertalabki yuk',lines:[{productId:product.id,label:'Sinov kabel',qty:5}]}});
  assert.equal(made.status,200,made.text);
  const intake=made.json.result;
  const blocked=await boybek.command('stock.purchase',{id:product.id,qty:1,cost:20000});
  assert.equal(blocked.status,422);
  assert.match(blocked.json.error,/Asilbek/);
  const task=(await asilbek.get('/api/reminders')).json.reminders;
  assert.ok(task.some(r=>r.kind==='intake'&&/5 dona/.test(r.text)));
  assert.ok(task.some(r=>r.kind==='inbox'));
  const wrongPerson=await boybek.command('intake.receive',{intakeId:intake.id,lineId:intake.lines[0].id,mode:'purchase',data:{qty:1,cost:20000}});
  assert.equal(wrongPerson.status,422);
  const part=await asilbek.command('intake.receive',{intakeId:intake.id,lineId:intake.lines[0].id,mode:'purchase',data:{qty:3,cost:21000,note:'3 dona keldi'}});
  assert.equal(part.status,200,part.text);
  assert.equal(part.json.result.status,'open');
  const rest=await asilbek.command('intake.receive',{intakeId:intake.id,lineId:intake.lines[0].id,mode:'purchase',data:{qty:2,cost:21000}});
  assert.equal(rest.json.result.status,'done');
  assert.equal((await boybek.command('stock.purchase',{id:product.id,qty:1,cost:20000})).status,200,'free again once finished');
  const {state}=ctx.store.read();
  assert.equal(state.products[0].lots.reduce((a,l)=>a+l.qty,0),10+5+1);
  const entered=state.purchases.filter(p=>p.intakeId===intake.id);
  assert.equal(entered.length,2);assert.ok(entered.every(p=>p.actor==='jasur'));
  assert.ok(state.notices.some(n=>/yakunlandi/.test(n.text)),'Otabek is told');
  const {entriesByWorker}=await import('../src/intake.js');
  const byWorker=Object.fromEntries(entriesByWorker(state).map(w=>[w.worker,w.units]));
  assert.deepEqual(byWorker,{aziz:10,sardor:1,jasur:5});
}));

test('a task line for a not-yet-listed product is fulfilled by registering it; the same product cannot be created twice',async()=>withServer(async ctx=>{
  const {boss,boybek,asilbek}=await setup(ctx);
  const intake=(await boss.command('intake.create',{data:{worker:'jasur',lines:[{label:'Yangi quvvatlagich 20W',qty:4}]}})).json.result;
  const data={name:'Quvvatlagich 20W',variant:'Type-C · oq',note:'Yangi kirim',owner:'jasur',category:'Quvvatlagichlar',brand:'other',qty:4,cost:50000,price:80000,minPrice:70000,min:2};
  const done=await asilbek.command('intake.receive',{intakeId:intake.id,lineId:intake.lines[0].id,mode:'product',data});
  assert.equal(done.status,200,done.text);
  assert.equal(done.json.result.status,'done');
  const created=ctx.store.read().state.products.find(p=>p.name==='Quvvatlagich 20W');
  assert.equal(created.createdBy,'jasur');
  const dup=await boybek.command('product.register',{data:{...data,qty:2}});
  assert.equal(dup.status,422);
  assert.match(dup.json.error,/ro‘yxatda bor/);
}));

test('reassigning and cancelling tasks keeps goods already received',async()=>withServer(async ctx=>{
  const {boss,boybek,product}=await setup(ctx);
  const intake=(await boss.command('intake.create',{data:{worker:'jasur',lines:[{productId:product.id,label:'Kabel',qty:5}]}})).json.result;
  assert.equal((await boss.command('intake.reassign',{id:intake.id,worker:'sardor'})).status,200);
  assert.equal((await boybek.command('intake.receive',{intakeId:intake.id,lineId:intake.lines[0].id,mode:'purchase',data:{qty:2,cost:20000}})).status,200);
  assert.equal((await boss.command('intake.cancel',{id:intake.id,note:'Yuk kelmadi'})).status,200);
  const {state}=ctx.store.read();
  assert.equal(state.products[0].lots.reduce((a,l)=>a+l.qty,0),12);
  assert.equal(state.intakes[0].status,'cancelled');
  assert.equal(state.intakes[0].assignments.length,2);
}));

test('changing a password signs other devices out and keeps this one',async()=>withServer(async ctx=>{
  const phone=await ctx.signIn('sardor'),laptop=await ctx.signIn('sardor');
  const bad=await phone.post('/api/password',{current:'xato',next:'yangi-parol-123'});
  assert.equal(bad.status,403);
  assert.equal((await phone.post('/api/password',{current:PASSWORDS.sardor,next:'yangi-parol-123'})).status,200);
  assert.equal((await phone.get('/api/me')).status,200);
  assert.equal((await laptop.get('/api/me')).status,401);
  assert.equal((await ctx.client().login('sardor')).status,401);
  assert.equal((await ctx.client().login('sardor','yangi-parol-123')).status,200);
  assert.equal((await phone.post('/api/password',{current:'yangi-parol-123',next:'123'})).status,422);
}));

test('Otabek resets a seller’s password; sellers cannot reset anyone’s',async()=>withServer(async ctx=>{
  const boss=await ctx.signIn('aziz'),boybek=await ctx.signIn('sardor');
  assert.equal((await boybek.post('/api/admin/password',{person:'jasur',password:'hujum-parol-1'})).status,403);
  assert.equal((await boss.post('/api/admin/password',{person:'sardor',password:'tiklangan-parol-1'})).status,200);
  assert.equal((await boybek.get('/api/me')).status,401);
  assert.equal((await ctx.client().login('sardor','tiklangan-parol-1')).status,200);
}));

test('only the frontend files are served; code, tests, data and git are not',async()=>withServer(async ctx=>{
  const c=ctx.client();
  for(const path of ['/package.json','/server/auth.js','/server/db.js','/tests/fixtures.mjs','/data/private/telefonzona.db','/.git/config','/.env','/docs/CLAUDE_HANDOFF.md','/src/../package.json','/%2e%2e/package.json'])
    assert.equal((await c.get(path)).status,404,path);
  const page=await c.get('/');
  assert.equal(page.status,200);
  const csp=page.headers.get('content-security-policy');
  assert.match(csp,/script-src 'self' 'sha256-/);assert.match(csp,/frame-ancestors 'none'/);
  assert.equal((await c.get('/src/app.js')).status,200);
  assert.equal((await c.get('/src/intake.js')).status,200);
  assert.equal(page.headers.get('cache-control'),'no-store');
  const manifest=await c.get('/manifest.webmanifest');
  assert.equal(manifest.status,200);
  assert.match(manifest.headers.get('content-type'),/manifest\+json/);
  const parsed=JSON.parse(manifest.text);
  assert.equal(parsed.display,'standalone');
  for(const icon of parsed.icons){
    const file=await fetch(ctx.base+'/'+icon.src);
    assert.equal(file.status,200,icon.src);
    assert.equal(file.headers.get('content-type'),'image/png');
    assert.deepEqual([...new Uint8Array(await file.arrayBuffer()).slice(0,4)],[0x89,0x50,0x4e,0x47]);
  }
  assert.equal((await c.get('/icons/../package.json')).status,404);
}));

test('Otabek can download a full backup that passes the same checks as a restore file',async()=>withServer(async ctx=>{
  const {boss,boybek,product}=await setup(ctx);
  await boybek.command('sale.record',sale(product,2));
  const file=await boss.get('/api/export');
  assert.equal(file.status,200);
  assert.match(file.headers.get('content-disposition'),/attachment; filename="telefonzona-nusxa-\d{4}-\d{2}-\d{2}\.json"/);
  const restored=readBackup(file.text);
  assert.equal(restored.sales.length,1);
}));

test('the state check fails closed: records that break the rules are never saved',async()=>withServer(async ctx=>{
  assert.throws(()=>ctx.store.check({version:1,products:[],settings:{}}),/hisob mosligi/);
  assert.ok(ctx.warnings.length>0);
}));

test('polling: unchanged state answers cheaply, changes bump the version',async()=>withServer(async ctx=>{
  const {boss,boybek}=await setup(ctx);
  const first=(await boybek.get('/api/state')).json;
  const same=(await boybek.get('/api/state?since='+first.version)).json;
  assert.deepEqual(same,{unchanged:true,version:first.version});
  await boss.command('product.register',{data:{...PRODUCT,name:'Boshqa kabel'}});
  const next=(await boybek.get('/api/state?since='+first.version)).json;
  assert.equal(next.version,first.version+1);
  assert.equal(next.view.products.length,2);
}));
