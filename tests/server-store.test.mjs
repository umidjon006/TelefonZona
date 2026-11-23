import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,existsSync,readdirSync,statSync,utimesSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {openDatabase} from '../server/db.js';
import {Store} from '../server/store.js';
import {backupNow,pruneBackups} from '../server/backup.js';
import {remindersFor} from '../src/reminders.js';
import {boot,PRODUCT} from './server-helpers.mjs';

const tempDir=()=>mkdtempSync(path.join(tmpdir(),'tz-test-'));
const BOSS='aziz';

test('records survive closing and reopening the database file; the version keeps counting',()=>{
  const dir=tempDir(),file=path.join(dir,'shop.db');
  try{
    let db=openDatabase(file),store=new Store(db);
    assert.equal(store.version(),0);
    store.execute({actor:BOSS,command:'product.register',args:{data:PRODUCT},opId:'op-persist-0001'});
    db.close();
    db=openDatabase(file);store=new Store(db);
    assert.equal(store.version(),1);
    assert.equal(store.read().state.products.length,1);
    const again=store.execute({actor:BOSS,command:'product.register',args:{data:PRODUCT},opId:'op-persist-0001'});
    assert.equal(again.replayed,true,'the retry after a restart is still recognised');
    assert.equal(store.read().state.products.length,1);
    db.close();
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('a new shop starts empty with zero totals and no sample data',()=>{
  const db=openDatabase(':memory:'),store=new Store(db);
  const {state}=store.read();
  assert.deepEqual([state.products.length,state.sales.length,state.debts.length,state.purchases.length,state.intakes.length],[0,0,0,0,0]);
  assert.equal(state.settings.openingAccounts.cash,0);
  db.close();
});

test('a failing command leaves no trace: not the state, not the version, not the retry key',()=>{
  const db=openDatabase(':memory:'),store=new Store(db);
  store.execute({actor:BOSS,command:'product.register',args:{data:PRODUCT}});
  const before=JSON.stringify(store.read());
  assert.throws(()=>store.execute({actor:BOSS,command:'stock.purchase',args:{id:'yoq',qty:1,cost:1},opId:'op-fail-000001'}),/topilmadi/);
  assert.equal(JSON.stringify(store.read()),before);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM operations WHERE op_id=?').get('op-fail-000001').n,0);
  db.close();
});

test('backups are consistent copies, private to the owner, and old ones are pruned',()=>{
  const dir=tempDir();
  try{
    const db=openDatabase(path.join(dir,'shop.db')),store=new Store(db);
    store.execute({actor:BOSS,command:'product.register',args:{data:PRODUCT}});
    const out=path.join(dir,'backups');
    const files=[0,1,2,3].map(i=>backupNow(db,out,new Date(Date.UTC(2026,10,20+i,12,0,0))));
    assert.equal(statSync(files[0]).mode&0o077,0,'not readable by other users');
    const copy=new DatabaseSync(files[3],{readOnly:true});
    assert.equal(JSON.parse(copy.prepare('SELECT json FROM app_state').get().json).products.length,1);
    copy.close();
    const removed=pruneBackups(out,2);
    assert.equal(removed.length,2);
    assert.deepEqual(readdirSync(out).sort(),files.slice(2).map(f=>path.basename(f)));
    assert.equal(existsSync(files[0]),false);
    db.close();
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('an overdue debt says how many days late; a debt due later is not a reminder yet',()=>{
  const db=openDatabase(':memory:'),store=new Store(db);
  store.execute({actor:BOSS,command:'product.register',args:{data:PRODUCT}});
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tashkent'}).format(new Date());
  const later=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tashkent'}).format(new Date(Date.now()+5*86400000));
  const product=store.read().state.products[0];
  const credit=(customer,due)=>store.execute({actor:'sardor',command:'sale.record',args:{cart:[{productId:product.id,qty:1,price:30000}],received:0,data:{payment:'Naqd',customer,phone:'+998901112233',due,note:'nasiya'}}});
  credit('Vali',today);credit('Sali',later);
  const {state}=store.read();
  assert.deepEqual(remindersFor(state,'jasur').filter(r=>r.kind==='debt').map(r=>r.customer),['Vali']);
  const inThreeDays=remindersFor(state,'jasur',new Date(Date.now()+3*86400000)).filter(r=>r.kind==='debt');
  assert.match(inThreeDays.find(r=>r.customer==='Vali').text,/3 kun kechiktirdi/);
  assert.equal(inThreeDays.find(r=>r.customer==='Vali').level,'overdue');
  db.close();
});

test('a full working day through the server keeps every record consistent (no check ever fails)',async()=>{
  const ctx=await boot();
  try{
    const boss=await ctx.signIn('aziz'),boybek=await ctx.signIn('sardor'),asilbek=await ctx.signIn('jasur');
    const ok=async(promise)=>{const r=await promise;assert.equal(r.status,200,r.text);return r.json;};
    const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tashkent'}).format(new Date());
    const first=await ok(boss.command('product.register',{data:PRODUCT}));
    const p=first.view.products[0];
    await ok(boss.command('product.groups',{data:{brand:'samsung',model:'S23 Ultra',audience:'men',material:'Karbon',owner:'sardor',min:3,rows:[{quality:'standard',qty:20,cost:25000,price:45000,minPrice:35000}]}}));
    const cash=await ok(boybek.command('sale.record',{cart:[{productId:p.id,qty:2,price:28000}],received:56000,data:{payment:'Karta'}}));
    const credit=await ok(asilbek.command('sale.record',{cart:[{productId:p.id,qty:3,price:30000}],received:40000,data:{payment:'Naqd',customer:'Karim',phone:'+998 90 123 45 67',due:today,note:'ertaga beradi'}}));
    const debtId=(await boss.get('/api/state')).json.view.debts[0].id;
    await ok(asilbek.command('debt.repay',{id:debtId,amount:20000,note:'qisman'}));
    await ok(boss.command('flow.record',{data:{kind:'expense',category:'Transport',account:'cash',amount:15000,note:'Yo‘l kira'}}));
    await ok(boybek.command('flow.record',{data:{kind:'contribution',category:'Shaxsiy pul',account:'cash',amount:50000,note:'O‘z pulim qo‘shildi'}}));
    await ok(asilbek.command('service.save',{data:{title:'Ekran almashtirish',worker:'jasur',profit:120000,note:'Sof foyda'}}));
    await ok(boss.command('stock.dispose',{id:p.id,qty:1,note:'Singan'}));
    await ok(boybek.command('sale.return',{id:cash.result.id,note:'Mijoz qaytardi'}));
    await ok(boss.command('rent.set',{month:today.slice(0,7),amount:900000,note:'Kelishilgan ijara'}));
    await ok(boss.command('closing.close',{data:{actual:300000,float:100000,handover:true,note:'Kun yopildi'}}));
    await ok(boss.command('sale.correct',{id:credit.result.id,data:{received:40000,items:[{productId:p.id,qty:3,price:30000}],note:'Tuzatish',customer:'Karim',phone:'+998 90 123 45 67',due:today}}));
    assert.deepEqual(ctx.warnings,[],'no command ever produced a state the backup checks reject');
    const full=ctx.store.read().state;
    assert.ok(full.movements.length>=6);
  }finally{await ctx.close();}
});
