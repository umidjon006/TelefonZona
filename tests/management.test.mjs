import test from 'node:test';
import assert from 'node:assert/strict';
import {createEmptyState,stock,purchase} from '../src/model.js';
import {prepareState,businessReport,accountBalances,recordSale,repayDebt,recordFlow,addOpeningDebt,setRent,payRent,closeDay,disposeStock,reverseMovement} from '../src/business.js';
import {saveService,deleteService,updateProduct,archiveProduct,updateDebt,deleteOpeningDebt,correctMovement,correctSale,updatePurchase,deleteRent,updateClosing,updateDefect} from '../src/management.js';
import {registerProduct,registerCaseGroups} from '../src/inventory-entry.js';
import {addCatalogOption,changeCatalogOption,catalog,saveStaffPermissions} from '../src/admin.js';
import {can,canVisit,PERMISSIONS} from '../src/access.js';
import {readBackup} from '../src/backup.js';
const fresh=()=>prepareState(createEmptyState());
const at=new Date('2026-11-20T12:00:00+05:00'),later=new Date('2026-11-21T12:00:00+05:00');
const product=(s)=>registerProduct(s,{name:'Sinov kabel',variant:'USB-C',brand:'other',category:'Kabellar',owner:'aziz',qty:10,cost:20000,price:40000,minPrice:30000,min:3,account:'cash',note:'Sinov kirimi'},'aziz');
const all=s=>businessReport(s,{period:'all',at:new Date('2099-01-01T12:00:00Z')});
const restore=s=>readBackup(JSON.stringify(s));

test('all workers record their own service net profit exactly once without inventing cash or turnover',()=>{
  const s=fresh();for(const worker of ['aziz','sardor','jasur'])saveService(s,{title:'Ta’mir',note:'Qolgan sof foyda',profit:30000,worker},worker,undefined,at);
  assert.equal(all(s).net,90000);assert.equal(all(s).revenue,0);assert.equal(accountBalances(s).cash,0);
  for(const worker of ['aziz','sardor','jasur']){assert.equal(businessReport(s,{period:'all',seller:worker,at:later}).serviceProfit,30000);assert.equal(businessReport(s,{period:'all',owner:worker,at:later}).net,30000);}
  assert.deepEqual(restore(s).services,s.services);
});
test('service edit and deletion preserve history and take effect in their own reporting windows',()=>{
  const s=fresh(),old=saveService(s,{title:'Ta’mir',note:'Avvalgi',profit:50000},'sardor',undefined,at);
  const revised=saveService(s,{title:'Ekran',note:'To‘g‘rilandi',profit:35000,worker:'jasur'},'aziz',old.id,later);
  const window={start:new Date('2026-11-20T07:00:00+05:00'),end:new Date('2026-11-20T23:00:00+05:00')};
  assert.equal(businessReport(s,{window}).serviceProfit,50000);assert.equal(all(s).net,35000);
  assert.equal(businessReport(s,{period:'all',seller:'sardor',at:later}).serviceProfit,0);
  deleteService(s,revised.id,'jasur','Xato yozuv',new Date('2026-11-22T12:00:00+05:00'));assert.equal(all(s).net,0);assert.equal(s.services.length,2);
  const before=JSON.stringify(s);assert.throws(()=>deleteService(s,revised.id,'jasur','Yana'));assert.equal(JSON.stringify(s),before);restore(s);
});
test('service authorization rejects attribution spoofing, editing a colleague, invalid amounts and disabled access atomically',()=>{
  const s=fresh(),entry=saveService(s,{title:'Ta’mir',note:'Sinov',profit:10000},'sardor',undefined,at),before=JSON.stringify(s);
  for(const action of [()=>saveService(s,{title:'X',note:'X',profit:1,worker:'aziz'},'jasur'),()=>deleteService(s,entry.id,'jasur','X'),()=>saveService(s,{title:'X',note:'X',profit:-1},'aziz')])assert.throws(action);
  assert.equal(JSON.stringify(s),before);s.settings.permissions.jasur.services=false;assert.equal(canVisit(s,'jasur','services'),false);assert.throws(()=>saveService(s,{title:'X',note:'X',profit:1},'jasur'));
});
test('product metadata and archival preserve historical sale cost and allow recovery without ghost sales',()=>{
  const s=fresh(),p=product(s),sale=recordSale(s,[{productId:p.id,qty:1,price:40000}],'aziz',{account:'cash',received:40000}),snapshot=JSON.stringify(sale.items);
  updateProduct(s,p.id,{...p,name:'Yangi nom',variant:'60W',owner:'jasur',price:45000,minPrice:35000,min:2},'aziz');
  assert.equal(JSON.stringify(s.sales[0].items),snapshot);assert.equal(s.products[0].owner,'jasur');
  const before=JSON.stringify(s);assert.throws(()=>updateProduct(s,p.id,{...s.products[0],price:100},'sardor'));assert.equal(JSON.stringify(s),before);
  archiveProduct(s,p.id,'aziz',true,'Katalog xatosi');assert.equal(stock(s.products[0]),9);assert.throws(()=>recordSale(s,[{productId:p.id,qty:1,price:45000}],'aziz',{account:'cash',received:45000}));
  restore(s);archiveProduct(s,p.id,'aziz',false);assert.equal(s.products[0].archivedAt,undefined);
});
test('staff may add incoming products and owner can revoke these rights while reports remain private',()=>{
  const s=fresh();assert.equal(can(s,'sardor','products'),true);assert.equal(can(s,'jasur','stock'),true);assert.equal(canVisit(s,'sardor','admin'),false);assert.equal(canVisit(s,'jasur','reports'),false);
  saveStaffPermissions(s,'sardor','Boybek',Object.fromEntries(PERMISSIONS.map(p=>[p.id,p.id==='stock'||p.id==='products'?false:p.default])),'aziz');
  assert.equal(can(s,'sardor','products'),false);prepareState(s);assert.equal(can(s,'sardor','stock'),false);
});
test('catalog rename and replacement move stock without rewriting historical receipt snapshots',()=>{
  const s=fresh(),p=product(s),sale=recordSale(s,[{productId:p.id,qty:1,price:40000}],'aziz',{account:'cash',received:40000}),before=JSON.stringify(sale);
  changeCatalogOption(s,'categories','Kabellar','Simlar','aziz');assert.equal(s.products[0].category,'Simlar');
  changeCatalogOption(s,'categories','Simlar','','aziz',true,'Quvvatlagichlar');assert.equal(s.products[0].category,'Quvvatlagichlar');assert.equal(JSON.stringify(s.sales[0]),before);
  const q=addCatalogOption(s,'qualities','Original','aziz');changeCatalogOption(s,'qualities',q.id,'','aziz',true,'standard');assert.equal(catalog(s).qualities.some(x=>x.id===q.id),false);restore(s);
  changeCatalogOption(s,'categories','G‘iloflar','Chexollar','aziz');registerCaseGroups(s,{brand:'apple',model:'15P',owner:'aziz',audience:'men',material:'Karbon',payment:'Naqd',rows:[{quality:'standard',qty:2,cost:10000,price:20000}]},'aziz');assert.equal(s.products.at(-1).category,'Chexollar');restore(s);
});
test('debt metadata and opening balance correction preserve collected payments and cannot erase a paid claim',()=>{
  const s=fresh(),d=addOpeningDebt(s,{customer:'Ali',phone:'+998901234567',due:'2026-12-01',amount:100000,note:'Eski qarz'},'aziz');
  repayDebt(s,d.id,20000,'cash','sardor','To‘lov');updateDebt(s,d.id,{customer:'Ali aka',phone:'+998901234567',due:'2026-12-03',note:'Tuzatildi',amount:90000},'aziz');assert.equal(s.debts[0].balance,70000);restore(s);
  const before=JSON.stringify(s);assert.throws(()=>deleteOpeningDebt(s,d.id,'aziz','Xato'));assert.throws(()=>updateDebt(s,d.id,{customer:'Ali',phone:'123',due:'2026-12-03',note:'Xato'},'jasur'));assert.equal(JSON.stringify(s),before);
  const other=addOpeningDebt(s,{customer:'Vali',phone:'+998901234568',due:'2026-12-01',amount:10000,note:'Xato qarz'},'aziz');deleteOpeningDebt(s,other.id,'aziz','Takror');assert.equal(s.debts.at(-1).balance,0);restore(s);
});
test('movement corrections reconcile cash, debt and original employee attribution without a partial reversal',()=>{
  const s=fresh(),expense=recordFlow(s,{kind:'expense',amount:10000,account:'cash',note:'Transport'},'sardor');
  correctMovement(s,expense.id,{amount:6000,account:'cash',note:'Haqiqiy yo‘l haqi'},'aziz');assert.equal(accountBalances(s).cash,-6000);assert.equal(all(s).expenses,6000);assert.equal(s.movements.at(-1).actor,'sardor');
  const d=addOpeningDebt(s,{customer:'Ali',phone:'+998901234567',due:'2026-12-01',amount:50000,note:'Eski'},'aziz'),payment=repayDebt(s,d.id,20000,'cash','jasur','Qarz qaytdi');
  correctMovement(s,payment.id,{amount:10000,account:'cash',note:'Xato summa'},'aziz');assert.equal(s.debts[0].balance,40000);assert.equal(accountBalances(s).cash,4000);restore(s);
  const before=JSON.stringify(s);assert.throws(()=>correctMovement(s,s.movements.at(-1).id,{amount:60000,account:'cash',note:'Oshib ketdi'},'aziz'));assert.equal(JSON.stringify(s),before);
});
test('sale correction restores lots and actual collected debt payments before booking a replacement',()=>{
  const s=fresh(),p=product(s),sale=recordSale(s,[{productId:p.id,qty:2,price:40000}],'sardor',{account:'cash',received:30000,customer:'Ali',phone:'+998901234567',due:'2026-12-01',note:'Nasiya'});
  repayDebt(s,s.debts[0].id,10000,'cash','jasur','Qisman');const corrected=correctSale(s,sale.id,{items:[{productId:p.id,qty:1,price:35000}],received:35000,payment:'Naqd',note:'Bir dona qaytdi'},'sardor');
  assert.equal(stock(s.products[0]),9);assert.equal(accountBalances(s).cash,-200000+35000);assert.equal(all(s).revenue,35000);assert.equal(all(s).cogs,20000);assert.equal(s.debts[0].balance,0);assert.equal(corrected.corrects,sale.id);restore(s);
  const before=JSON.stringify(s);assert.throws(()=>correctSale(s,corrected.id,{items:[{productId:p.id,qty:500,price:35000}],received:35000,note:'Xato'},'sardor'));assert.equal(JSON.stringify(s),before);
});
test('purchase correction cannot alter sold lot costs or remove consumed stock, but unused receipts can be removed',()=>{
  const s=fresh(),p=product(s),receipt=s.purchases[0];updatePurchase(s,receipt.id,{qty:12,cost:15000,note:'To‘g‘ri kirim'},'aziz');assert.equal(stock(s.products[0]),12);assert.equal(accountBalances(s).cash,-180000);
  recordSale(s,[{productId:p.id,qty:1,price:40000}],'aziz',{account:'cash',received:40000});const before=JSON.stringify(s);
  assert.throws(()=>updatePurchase(s,receipt.id,{qty:12,cost:16000,note:'Xato'},'aziz'));assert.throws(()=>updatePurchase(s,receipt.id,{note:'Xato'},'aziz',true));assert.equal(JSON.stringify(s),before);
  purchase(s,p.id,3,17000,'Naqd','aziz');updatePurchase(s,s.purchases.at(-1).id,{note:'Takror kirim'},'aziz',true);assert.equal(stock(s.products[0]),11);assert.equal(accountBalances(s).cash,-140000);restore(s);
});
test('closing and defect corrections reverse their own effects and retain readable backup history',()=>{
  const s=fresh(),p=product(s);disposeStock(s,p.id,2,'Nuqson','aziz');assert.equal(all(s).loss,40000);assert.equal(stock(s.products[0]),8);
  updateDefect(s,s.defects[0].id,{qty:1,note:'Bittasi sog‘lom'},'aziz');assert.equal(stock(s.products[0]),9);assert.equal(all(s).loss,20000);
  updateDefect(s,s.defects.at(-1).id,{note:'Xato nuqson'},'aziz',true);assert.equal(stock(s.products[0]),10);assert.equal(all(s).loss,0);
  const c=closeDay(s,{actual:100000,float:10000,handover:true,note:'Sanash'},'aziz');const cash=accountBalances(s).cash;
  updateClosing(s,c.id,{actual:100000,float:20000,handover:true,note:'Qaytim tuzatildi'},'aziz');assert.equal(accountBalances(s).cash,cash+10000);
  updateClosing(s,c.id,{note:'Takror sanash'},'aziz',true);assert.equal(accountBalances(s).cash,-200000);restore(s);
});
test('rent may be removed only after its actual payments are reversed',()=>{
  const s=fresh(),r=setRent(s,'2026-11',100000,'Kelishuv','aziz');payRent(s,r.id,20000,'cash','aziz','Qisman');const before=JSON.stringify(s);assert.throws(()=>deleteRent(s,r.id,'aziz','Xato'));assert.equal(JSON.stringify(s),before);reverseMovement(s,s.movements[0].id,'aziz','Xato to‘lov');deleteRent(s,r.id,'aziz','Takror ijara');assert.equal(all(s).rent,0);restore(s);setRent(s,'2026-11',80000,'Yangi kelishuv','aziz');assert.equal(s.rents[0].cancelledAt,undefined);assert.equal(all(s).rent,80000);restore(s);
});
