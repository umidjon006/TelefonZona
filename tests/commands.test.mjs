import test from 'node:test';
import assert from 'node:assert/strict';
import {createEmptyState} from '../src/model.js';
import {prepareState} from '../src/business.js';
import {runCommand,COMMAND_NAMES,isBossCommand,assertPlain,CommandError} from '../src/commands.js';
import {canVisit} from '../src/access.js';
import {remindersFor} from '../src/reminders.js';
import {entriesByWorker} from '../src/intake.js';

const fresh=()=>prepareState(createEmptyState());
const PRODUCT={name:'Sinov kabel',variant:'USB-C · 1 metr',note:'Birinchi kirim',owner:'aziz',category:'Kabellar',brand:'other',qty:10,cost:20000,price:30000,minPrice:25000,min:2};

test('the same commands run in the browser (local mode) and on the server',()=>{
  const s=fresh();
  const product=runCommand(s,'product.register',{data:PRODUCT},'aziz');
  const sale=runCommand(s,'sale.record',{cart:[{productId:product.id,qty:2,price:30000}],received:60000,data:{payment:'Naqd'}},'sardor');
  assert.equal(sale.seller,'sardor');
  assert.equal(s.products[0].lots.reduce((a,l)=>a+l.qty,0),8);
});

test('boss-only commands are refused for sellers even when called directly',()=>{
  const s=fresh();
  const boss=COMMAND_NAMES.filter(isBossCommand);
  assert.ok(boss.includes('closing.close')&&boss.includes('intake.create')&&boss.includes('settings.update'));
  for(const name of boss)assert.throws(()=>runCommand(s,name,{},'sardor'),e=>e instanceof CommandError&&e.status===403,name);
  assert.throws(()=>runCommand(s,'yo‘q.amal',{},'aziz'),/Noma’lum amal/);
  assert.throws(()=>runCommand(s,'toString',{},'aziz'),/Noma’lum amal/);
});

test('rent can be paid from the cash box or from a seller’s own pocket',()=>{
  const s=fresh();
  const month=new Date().toISOString().slice(0,7);
  runCommand(s,'rent.set',{month,amount:900000,note:'Ijara'},'aziz');
  const id=s.rents[0].id;
  runCommand(s,'rent.pay',{id,amount:100000,account:'cash',note:'Kassadan'},'aziz');
  runCommand(s,'rent.pay',{id,amount:50000,account:'personal',note:'O‘z cho‘ntagimdan'},'sardor');
  assert.equal(s.rents[0].paid,150000);
  assert.ok(s.movements.some(m=>m.kind==='rent-payment'&&m.account==='personal'));
});

test('receipt tasks work end to end in local mode, with who-entered-what history and reminders',()=>{
  const s=fresh();
  const product=runCommand(s,'product.register',{data:PRODUCT},'aziz');
  const intake=runCommand(s,'intake.create',{data:{worker:'jasur',note:'Yuk',lines:[{productId:product.id,label:'Kabel',qty:4}]}},'aziz');
  assert.match(intake.code,/^K-\d+$/);
  assert.throws(()=>runCommand(s,'stock.purchase',{id:product.id,qty:1,cost:20000},'sardor'),/Asilbek/);
  assert.ok(remindersFor(s,'jasur').some(r=>r.kind==='intake'&&/4 dona/.test(r.text)));
  const line=intake.lines[0];
  runCommand(s,'intake.receive',{intakeId:intake.id,lineId:line.id,mode:'purchase',data:{qty:4,cost:21000}},'jasur');
  assert.equal(s.intakes[0].status,'done');
  assert.equal(entriesByWorker(s).find(w=>w.worker==='jasur').units,4);
  runCommand(s,'stock.purchase',{id:product.id,qty:1,cost:20000},'sardor');
  runCommand(s,'inbox.markRead',{},'jasur');
  assert.equal(s.inbox.filter(n=>n.to==='jasur'&&!n.read).length,0);
});

test('every seller can open the receipt-tasks page; other boss pages stay closed',()=>{
  const s=fresh();
  assert.equal(canVisit(s,'sardor','intake'),true);
  for(const page of ['reports','employees','admin'])assert.equal(canVisit(s,'sardor',page),false);
});

test('request data is checked before any command runs',()=>{
  assert.doesNotThrow(()=>assertPlain({a:[1,'x',{b:true}]}));
  assert.throws(()=>assertPlain(JSON.parse('{"x":{"__proto__":{"admin":true}}}')),CommandError);
  assert.throws(()=>assertPlain({a:'x'.repeat(6000)}),CommandError);
  let deep={};const root=deep;for(let i=0;i<12;i++){deep.n={};deep=deep.n;}
  assert.throws(()=>assertPlain(root),CommandError);
  assert.throws(()=>assertPlain({n:Infinity}),CommandError);
});
