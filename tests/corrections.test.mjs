import test from 'node:test';
import assert from 'node:assert/strict';
import {makeSeed,stock} from '../src/model.js';
import {prepareState,recordFlow,accountBalances,businessReport,staffPayable,reverseMovement,closeDay,recordSale,repayDebt,returnSale,setRent,payRent} from '../src/business.js';
import {readBackup,backupSummary} from '../src/backup.js';

const at=new Date('2026-10-29T12:00:00+05:00'),later=new Date('2026-10-30T12:00:00+05:00');
const fresh=()=>{const s=makeSeed();for(const key of ['sales','expenses','purchases','payouts','closings','audit'])s[key]=[];return prepareState(s);};
const daily=(s,date)=>businessReport(s,{period:'today',at:date});
const monthly=s=>businessReport(s,{period:'month',at:later});

test('expense reversal preserves the original day and posts the correction on its own date',()=>{
  const s=fresh(),before=accountBalances(s);
  const expense=recordFlow(s,{kind:'expense',amount:10000,account:'till1',category:'Transport',note:'Yo‘l haqi'},'jasur',at);
  reverseMovement(s,expense.id,'jasur','Bir nol ortiq yozilgan',later);
  assert.equal(s.expenses.length,1);assert.equal(s.expenses[0].amount,10000);
  assert.equal(daily(s,at).expenses,10000);assert.equal(daily(s,later).expenses,-10000);assert.equal(monthly(s).net,0);
  assert.deepEqual(accountBalances(s),before);assert.equal(s.movements.length,2);assert.equal(s.notices.length,2);
  assert.equal(s.movements[0].voidedBy,s.movements[1].id);
  const snapshot=JSON.stringify(s);assert.throws(()=>reverseMovement(s,expense.id,'aziz','Takror',later));assert.equal(JSON.stringify(s),snapshot);
});
test('income and transfers reverse cash once, while only income affects profit',()=>{
  const s=fresh(),before=accountBalances(s);
  const income=recordFlow(s,{kind:'income',amount:50000,account:'bank',note:'Qo‘shimcha xizmat'},'sardor',at);
  const transfer=recordFlow(s,{kind:'transfer',amount:20000,account:'bank',to:'till2',note:'Qaytimga'},'sardor',at);
  assert.equal(monthly(s).net,50000);reverseMovement(s,transfer.id,'aziz','Boshqa kassaga yozilgan',later);
  assert.equal(accountBalances(s).bank,50000);assert.equal(accountBalances(s).till2,0);assert.equal(monthly(s).net,50000);
  reverseMovement(s,income.id,'sardor','Xizmat bo‘lmagan',later);
  assert.deepEqual(accountBalances(s),before);assert.equal(daily(s,at).income,50000);assert.equal(daily(s,later).income,-50000);
});
test('only the author or boss can reverse a money entry; sale receipts cannot be reversed as manual flows',()=>{
  const s=fresh(),entry=recordFlow(s,{kind:'expense',amount:1000,account:'till1',note:'Yo‘l haqi'},'jasur',at),snapshot=JSON.stringify(s);
  assert.throws(()=>reverseMovement(s,entry.id,'sardor','Boshqa sotuvchi',later));assert.equal(JSON.stringify(s),snapshot);
  assert.throws(()=>reverseMovement(s,entry.id,'jasur','',later));assert.equal(JSON.stringify(s),snapshot);
  recordSale(s,[{productId:'p0',qty:1,price:85000}],'jasur',{account:'till1',received:85000},at);
  assert.throws(()=>reverseMovement(s,s.movements.at(-1).id,'aziz','Chek o‘rniga',later));
});
test('reimbursed personal expense cannot be undone until its reimbursement is corrected',()=>{
  const s=fresh(),expense=recordFlow(s,{kind:'expense',amount:5000,account:'personal',note:'Yo‘l haqi'},'jasur',at);
  const paid=recordFlow(s,{kind:'reimbursement',amount:5000,account:'till1',person:'jasur',note:'Qaytarildi'},'aziz',at);
  const before=JSON.stringify(s);assert.throws(()=>reverseMovement(s,expense.id,'jasur','Noto‘g‘ri summa',later));assert.equal(JSON.stringify(s),before);
  reverseMovement(s,paid.id,'aziz','Pul berilmagan',later);assert.equal(staffPayable(s,'jasur'),5000);
  reverseMovement(s,expense.id,'jasur','Xarajat bo‘lmagan',later);assert.equal(staffPayable(s,'jasur'),0);assert.equal(monthly(s).net,0);
});
test('reversing a debt payment reopens that amount and a later return refunds only actual receipts',()=>{
  const s=fresh(),q=stock(s.products[0]),before=accountBalances(s);
  const sale=recordSale(s,[{productId:'p0',qty:1,price:85000}],'jasur',{account:'till1',received:50000,customer:'Ali',phone:'+998901234567',due:'2026-11-01',note:'Nasiya'},at);
  const payment=repayDebt(s,s.debts[0].id,10000,'bank','sardor','Qaytdi',at);
  reverseMovement(s,payment.id,'sardor','Hali pul olmagan edim',later);
  assert.equal(s.debts[0].balance,35000);assert.equal(accountBalances(s).bank,0);assert.equal(monthly(s).revenue,85000);
  assert.equal(returnSale(s,sale.id,'jasur','till1','Mos kelmadi',later),50000);
  assert.equal(stock(s.products[0]),q);assert.deepEqual(accountBalances(s),before);assert.equal(s.debts[0].cancelled,35000);
  assert.equal(monthly(s).net,0);assert.doesNotThrow(()=>readBackup(JSON.stringify(s)));
});
test('payment attached to an already returned sale cannot be undone separately',()=>{
  const s=fresh(),sale=recordSale(s,[{productId:'p0',qty:1,price:85000}],'jasur',{account:'till1',received:50000,customer:'Ali',phone:'+998901234567',due:'2026-11-01',note:'Nasiya'},at);
  const payment=repayDebt(s,s.debts[0].id,10000,'bank','sardor','Qaytdi',at);
  returnSale(s,sale.id,'aziz','till1','Qaytarildi',later);const snapshot=JSON.stringify(s);
  assert.throws(()=>reverseMovement(s,payment.id,'aziz','Keyin tuzatish',later));assert.equal(JSON.stringify(s),snapshot);
});
test('rent payment reversal restores cash and payment balance without changing monthly rent expense',()=>{
  const s=fresh(),rent=setRent(s,'2026-10',3000000,'Kelishuv','aziz',at);
  payRent(s,rent.id,100000,'personal','jasur','O‘z pulimdan',at);
  assert.equal(staffPayable(s,'jasur'),100000);
  reverseMovement(s,s.movements.at(-1).id,'jasur','To‘lov amalga oshmagan',later);
  assert.equal(s.rents[0].paid,0);assert.equal(staffPayable(s,'jasur'),0);assert.equal(monthly(s).rent,3000000);
  assert.equal(monthly(s).net,-3000000);
});
test('day close can post both till withdrawals while retaining the planned float and keeping profit unchanged',()=>{
  const s=fresh();s.settings.openingAccounts={till1:600000,till2:400000,bank:123000};
  const closing=closeDay(s,{till1:600000,till2:400000,float1:100000,float2:50000,handover:true,note:'Pul boshliqqa berildi'},'aziz',at);
  assert.equal(closing.actual,1000000);assert.equal(closing.float,150000);assert.equal(closing.withdrawalIds.length,2);
  assert.deepEqual(accountBalances(s),{till1:100000,till2:50000,bank:123000});assert.equal(monthly(s).net,0);
  const snapshot=JSON.stringify(s);assert.throws(()=>closeDay(s,{till1:100000,till2:50000,float1:100001,float2:0,handover:true,note:'Xato'},'aziz',later));assert.equal(JSON.stringify(s),snapshot);
});
test('count-only close never moves money and discrepancy remains visible after a handover',()=>{
  const s=fresh();s.settings.openingAccounts={till1:600000,till2:400000,bank:0};
  closeDay(s,{till1:590000,till2:400000,float1:100000,float2:50000,handover:false,note:'Kamomad tekshiriladi'},'aziz',at);
  assert.equal(s.movements.length,0);assert.equal(s.closings[0].difference,-10000);
  const c=closeDay(s,{till1:590000,till2:400000,float1:100000,float2:50000,handover:true,note:'Sanashdagi farq izohlandi'},'aziz',later);
  assert.equal(c.difference,-10000);assert.deepEqual(accountBalances(s),{till1:110000,till2:50000,bank:0});
  assert.equal(monthly(s).net,0);assert.equal(c.actual-c.float,840000);
});
test('current backup round trip retains costs, credit, reversals and cash; old backups are migrated',()=>{
  const s=fresh();const e=recordFlow(s,{kind:'expense',amount:7000,account:'till2',note:'Transport'},'jasur',at);reverseMovement(s,e.id,'aziz','Noto‘g‘ri kassa',later);
  const restored=readBackup(JSON.stringify(s));assert.deepEqual(restored,s);assert.deepEqual(backupSummary(restored),backupSummary(s));
  const old=makeSeed(),imported=readBackup(JSON.stringify(old));assert.equal(imported.products.length,38);assert.equal(imported.rents[0].amount,1800000);assert.equal(imported.rents[0].paid,1800000);
});
test('invalid backups are rejected without changing the current state',()=>{
  const s=fresh(),snapshot=JSON.stringify(s);
  const bad=[];
  let candidate=structuredClone(s);candidate.products[0].lots[0].qty=-1;bad.push(candidate);
  candidate=structuredClone(s);candidate.products.push(candidate.products[0]);bad.push(candidate);
  candidate=structuredClone(s);candidate.settings.openingAccounts.bank='1000';bad.push(candidate);
  candidate=structuredClone(s);candidate.version=5;bad.push(candidate);
  candidate=structuredClone(s);candidate.products[0].minPrice=candidate.products[0].price+1;bad.push(candidate);
  candidate=structuredClone(s);candidate.products[0].lots=null;bad.push(candidate);
  candidate=structuredClone(s);candidate.audit.push({id:'unsafe-id',actor:'<img src=x>',date:'2026-10-29',time:'12:00',text:'Sinov'});bad.push(candidate);
  candidate=structuredClone(s);candidate.products[0].id='x\" onclick=\"bad';bad.push(candidate);
  for(const input of bad)assert.throws(()=>readBackup(JSON.stringify(input)));
  for(const raw of ['{broken}','null','{"__proto__":{"bad":1}}','x'.repeat(8*1024*1024+1)])assert.throws(()=>readBackup(raw));
  assert.equal(JSON.stringify(s),snapshot);
});
test('backup validation rejects dangling references and broken debt totals',()=>{
  const s=fresh();recordSale(s,[{productId:'p0',qty:1,price:85000}],'jasur',{account:'till1',received:50000,customer:'Ali',phone:'+998901234567',due:'2026-11-01',note:'Nasiya'},at);
  let bad=structuredClone(s);bad.sales[0].items[0].productId='missing';assert.throws(()=>readBackup(JSON.stringify(bad)));
  bad=structuredClone(s);bad.debts[0].balance--;assert.throws(()=>readBackup(JSON.stringify(bad)));
  bad=structuredClone(s);bad.sales[0].items[0].alloc[0].cost++;assert.throws(()=>readBackup(JSON.stringify(bad)));
});
