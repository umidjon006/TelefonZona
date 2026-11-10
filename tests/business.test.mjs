import test from 'node:test';
import assert from 'node:assert/strict';
import {makeSeed,stock,checkout} from '../src/model.js';
import {registerCaseGroups} from '../src/inventory-entry.js';
import {prepareState,recordSale,repayDebt,returnSale,recordFlow,accountBalances,staffPayable,setRent,payRent,businessReport,reportWindow,debtReminders,disposeStock,closeDay} from '../src/business.js';

const at=new Date('2026-10-29T12:00:00+05:00');
const nextDay=new Date('2026-10-30T12:00:00+05:00');
const fresh=()=>{const s=makeSeed();for(const k of ['sales','expenses','purchases','payouts','closings','audit'])s[k]=[];return prepareState(s);};
const cart=[{productId:'p0',qty:1,price:85000}];
const saleData={account:'till2',received:50000,customer:'Ali',phone:'+998 90 123 45 67',due:'2026-10-30',note:'Qolganini ertaga beradi'};
const report=s=>businessReport(s,{period:'month',at:nextDay});

test('credit recognizes full revenue once; repayments only change cash and receivable',()=>{
  const s=fresh(),before=accountBalances(s);
  const sale=recordSale(s,cart,'jasur',saleData,at),d=s.debts[0];
  assert.equal(sale.seller,'jasur');assert.equal(sale.items[0].owner,'aziz');assert.equal(sale.account,'till2');
  assert.equal(accountBalances(s).till2,before.till2+50000);assert.equal(d.balance,35000);
  assert.equal(report(s).revenue,85000);assert.equal(report(s).cogs,35000);
  repayDebt(s,d.id,15000,'bank','sardor','Karta orqali bir qismini berdi',nextDay);
  assert.equal(s.debts[0].balance,20000);assert.equal(accountBalances(s).bank,15000);
  assert.equal(report(s).revenue,85000);assert.equal(report(s).gross,50000);
  assert.equal(s.notices.length,2);
  assert.equal(debtReminders(s,at).length,0);assert.equal(debtReminders(s,nextDay).length,1);
});
test('price exceptions including gifts require a reason and notify the boss without changing cost',()=>{
  const s=fresh();s.products[0].minPrice=60000;
  const before=JSON.stringify(s);
  assert.throws(()=>recordSale(s,[{...cart[0],price:0}],'sardor',{account:'till1',received:0},at));
  assert.equal(JSON.stringify(s),before);
  recordSale(s,[{...cart[0],price:0}],'sardor',{account:'till1',received:0,note:'Do‘stiga sovg‘a'},at);
  assert.equal(s.sales[0].items[0].cost,35000);assert.equal(s.products[0].minPrice,60000);
  assert.equal(report(s).gross,-35000);assert.equal(s.notices.length,1);
});
test('invalid debtor and overpayment cannot partly consume inventory or create operations',()=>{
  for(const data of [{...saleData,phone:''},{...saleData,phone:'---------'},{...saleData,received:90000},{...saleData,due:'2026-10-28'},{...saleData,due:'2027-02-30'}]) {
    const s=fresh(),before=JSON.stringify(s);assert.throws(()=>recordSale(s,cart,'jasur',data,at));assert.equal(JSON.stringify(s),before);
  }
});
test('any seller can return a partially repaid credit sale; exact lots, paid cash and debt reconcile once',()=>{
  const s=fresh(),qty=stock(s.products[0]),balances=accountBalances(s);
  const sale=recordSale(s,cart,'jasur',saleData,at),id=s.debts[0].id;
  repayDebt(s,id,15000,'till1','aziz','Naqd berdi',nextDay);
  assert.equal(returnSale(s,sale.id,'sardor','till2','O‘lchami mos kelmadi',nextDay),65000);
  assert.equal(s.debts[0].balance,0);assert.equal(s.debts[0].cancelled,20000);assert.equal(stock(s.products[0]),qty);
  const b=accountBalances(s);assert.equal(b.till1+b.till2,balances.till1+balances.till2);
  assert.equal(report(s).revenue,0);assert.equal(report(s).cogs,0);
  const before=JSON.stringify(s);assert.throws(()=>returnSale(s,sale.id,'jasur','till2','Yana',nextDay));assert.equal(JSON.stringify(s),before);
});
test('return reversals stay in the return day instead of erasing a previous day',()=>{
  const s=fresh(),sale=recordSale(s,cart,'jasur',{account:'bank',received:85000},at);
  returnSale(s,sale.id,'jasur','bank','Xaridor qaytardi',nextDay);
  assert.equal(businessReport(s,{period:'today',at}).revenue,85000);
  assert.equal(businessReport(s,{period:'today',at:nextDay}).revenue,-85000);
  assert.equal(report(s).revenue,0);assert.equal(accountBalances(s).bank,0);
});
test('legacy receipt return preserves its original payment and records the reversal',()=>{
  const s=fresh(),sale=checkout(s,cart,'jasur','Naqd');
  const initial=accountBalances(s).till1-85000;
  returnSale(s,sale.id,'jasur','till1','Namuna cheki qaytdi',nextDay);
  assert.equal(accountBalances(s).till1,initial);
});
test('personal expenses create a payable, reimbursement and transfers never deduct profit twice',()=>{
  const s=fresh(),b=accountBalances(s);
  recordFlow(s,{kind:'expense',account:'personal',amount:10000,category:'Transport',note:'Tovar olib kelish uchun yo‘l haqi'},'jasur',at);
  assert.equal(staffPayable(s,'jasur'),10000);assert.equal(report(s).net,-10000);assert.deepEqual(accountBalances(s),b);
  recordFlow(s,{kind:'reimbursement',account:'till1',person:'jasur',amount:10000,note:'Yo‘l haqini qaytardim'},'aziz',at);
  assert.equal(staffPayable(s,'jasur'),0);assert.equal(report(s).net,-10000);assert.equal(accountBalances(s).till1,b.till1-10000);
  recordFlow(s,{kind:'contribution',account:'till2',amount:30000,note:'Qaytimga o‘z pulimdan'},'sardor',at);
  recordFlow(s,{kind:'transfer',account:'till2',to:'bank',amount:10000,note:'Bankka o‘tkazildi'},'sardor',at);
  assert.equal(staffPayable(s,'sardor'),30000);assert.equal(report(s).net,-10000);
  assert.equal(accountBalances(s).bank,10000);assert.equal(accountBalances(s).till2,20000);
});
test('monthly rent accrual and actual cash payments are separate and deducted just once',()=>{
  const s=fresh();recordFlow(s,{kind:'income',account:'bank',amount:8000000,note:'Qo‘shimcha xizmat daromadi'},'aziz',at);
  const r=setRent(s,'2026-10',3000000,'Kelishilgan oylik ijara','aziz',at);
  assert.equal(report(s).net,5000000);assert.equal(businessReport(s,{period:'today',at}).net,8000000);
  payRent(s,r.id,1000000,'bank','jasur','Oktabr ijarasi birinchi qism',at);
  assert.equal(report(s).net,5000000);assert.equal(accountBalances(s).bank,7000000);
  assert.equal(s.rents[0].paid,1000000);assert.equal(businessReport(s,{period:'all',at}).rent,3000000);
  assert.throws(()=>payRent(s,r.id,3000000,'bank','aziz','Ortiqcha',at));
  assert.throws(()=>setRent(s,'2026-10',500000,'Xato','aziz',at));
});
test('legacy rent migration is idempotent and preserves total cash and monthly expense',()=>{
  const s=makeSeed();prepareState(s);const before=JSON.stringify(s);prepareState(s);assert.equal(JSON.stringify(s),before);
  assert.equal(s.rents[0].amount,1800000);assert.equal(s.rents[0].paid,1800000);
  assert.equal(report(s).rent,1800000);assert.equal(s.expenses[0].amount,1800000);
});
test('business boundaries use Tashkent time and leave lifetime records untouched',()=>{
  const start=(p,date)=>reportWindow(p,new Date(date)).start.toISOString();
  assert.equal(start('today','2026-10-29T06:59:59+05:00'),'2026-10-28T02:00:00.000Z');
  assert.equal(start('today','2026-10-29T07:00:00+05:00'),'2026-10-29T02:00:00.000Z');
  assert.equal(start('week','2026-11-01T22:59:59+05:00'),'2026-10-25T18:00:00.000Z');
  assert.equal(start('week','2026-11-01T23:00:00+05:00'),'2026-11-01T18:00:00.000Z');
  assert.equal(start('month','2026-11-01T06:59:59+05:00'),'2026-10-01T02:00:00.000Z');
  assert.equal(start('month','2026-11-01T07:00:00+05:00'),'2026-11-01T02:00:00.000Z');
  assert.equal(start('year','2026-12-31T22:59:59+05:00'),'2025-12-31T18:00:00.000Z');
  assert.equal(start('year','2026-12-31T23:00:00+05:00'),'2026-12-31T18:00:00.000Z');
});
test('case groups do not merge different audiences or materials and preserve price ranges',()=>{
  const s=fresh(),base={brand:'apple',model:'iPhone 15 Pro',owner:'aziz',payment:'Naqd',audience:'men',material:'Karbon',rows:[{quality:'standard',qty:20,cost:20000,minPrice:25000,price:30000}]};
  registerCaseGroups(s,base,'aziz');registerCaseGroups(s,{...base,audience:'women'},'aziz');registerCaseGroups(s,{...base,material:'Silikon'},'aziz');
  const groups=s.products.filter(p=>p.grouped);assert.equal(groups.length,3);assert.equal(groups[0].minPrice,25000);
  const before=JSON.stringify(s);assert.throws(()=>registerCaseGroups(s,{...base,rows:[{...base.rows[0],minPrice:35000}]},'aziz'));assert.equal(JSON.stringify(s),before);
});
test('defect disposal writes off FIFO cost once; day close records discrepancies without inventing income',()=>{
  const s=fresh(),q=stock(s.products[0]);disposeStock(s,'p0',2,'Qayta tuzatib bo‘lmaydi','jasur',at);
  assert.equal(stock(s.products[0]),q-2);assert.equal(report(s).loss,70000);assert.equal(report(s).net,-70000);
  const b=accountBalances(s),entry=closeDay(s,{till1:b.till1-5000,till2:0,float:100000,note:'5000 so‘m farq tekshiriladi'},'aziz',at);
  assert.equal(entry.difference,-5000);assert.deepEqual(accountBalances(s),b);assert.equal(report(s).net,-70000);
});

test('opening balances and historical debts do not invent revenue; personal rent creates a staff payable',async()=>{
  const {setOpeningBalances,addOpeningDebt}=await import('../src/business.js');
  const s=fresh();setOpeningBalances(s,{till1:500000,till2:200000,bank:1000000},{jasur:15000,sardor:0},'aziz','Hisob boshlanishidagi pul',at);
  const d=addOpeningDebt(s,{customer:'Vali',phone:'+998901234567',due:'2026-10-28',amount:50000,note:'Avvalgi savdo qarzi'},'aziz',at);
  assert.equal(report(s).revenue,0);assert.equal(staffPayable(s,'jasur'),15000);assert.equal(accountBalances(s).till2,200000);
  repayDebt(s,d.id,10000,'till2','sardor','Avvalgi qarzdan bir qism',at);
  assert.equal(report(s).revenue,0);assert.equal(accountBalances(s).till2,210000);
  const r=setRent(s,'2026-10',100000,'Ijara','aziz',at);
  const before=accountBalances(s);payRent(s,r.id,30000,'personal','jasur','Ijara uchun o‘z pulimdan',at);
  assert.deepEqual(accountBalances(s),before);assert.equal(staffPayable(s,'jasur'),45000);assert.equal(report(s).net,-100000);
});
test('inactive form destinations and people never leak into a saved expense',()=>{
  const s=fresh();recordFlow(s,{kind:'expense',amount:5000,account:'personal',category:'Transport',to:'till2',person:'sardor',note:'Yo‘l haqi'},'jasur',at);
  assert.equal(s.movements[0].to,undefined);assert.equal(s.movements[0].person,undefined);
});
