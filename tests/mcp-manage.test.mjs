import test from 'node:test';
import assert from 'node:assert/strict';
import {boot} from './server-helpers.mjs';
import {connectAs,tool,rpc} from './mcp-helpers.mjs';
import {accountBalances} from '../src/business.js';
import {stock} from '../src/model.js';
import {readBackup} from '../src/backup.js';

const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tashkent'}).format(new Date());
const CASE={type:'case',brand:'samsung',phone_model:'S23 Ultra',audience:'men',material:'Karbon',quality:'standard',owner:'sardor'};
const CABLE={type:'other',brand:'other',name:'Type-C kabel',variant:'1 metr',category:'Kabellar',owner:'aziz'};
const delivery=[{new_product:CASE,qty:20,unit_cost:25000,price_min:35000,price_max:45000},{new_product:CABLE,qty:10,unit_cost:20000,price_min:25000,price_max:30000}];
const withServer=async fn=>{const ctx=await boot();try{await fn(ctx);}finally{await ctx.close();}};
const state=ctx=>ctx.store.read().state;
const cash=ctx=>accountBalances(structuredClone(state(ctx))).cash;
const boss=async ctx=>(await connectAs(ctx,'aziz',{write:true})).token;
async function change(ctx,token,name,args){
  const prepared=await tool(ctx,token,name,args);
  assert.equal(prepared.isError,false,name+': '+prepared.text);
  const done=await tool(ctx,token,'commit_change',{proposal_id:prepared.data.proposal_id,user_confirmed:true});
  assert.equal(done.isError,false,name+' commit: '+done.text);
  readBackup(JSON.stringify(state(ctx)));
  return {prepared:prepared.data,done:done.data};
}
async function refused(ctx,token,name,args,pattern){
  const res=await tool(ctx,token,name,args);
  assert.equal(res.isError,true,name+' should be refused');assert.match(res.text,pattern,name);
  return res;
}
async function shop(ctx){
  const token=await boss(ctx),api=await ctx.signIn('aziz');
  assert.equal((await api.command('opening.set',{accounts:{cash:5000000},payables:{jasur:0,sardor:0},note:'Boshlang‘ich'})).status,200);
  await change(ctx,token,'prepare_stock_receipt',{items:delivery});
  const cable=state(ctx).products.find(x=>x.name==='Type-C kabel'),group=state(ctx).products.find(x=>x.model==='S23 Ultra');
  return {token,api,cable,group};
}

test('correcting a receipt: the old one is returned, a correct one written, cash and stock follow exactly',async()=>withServer(async ctx=>{
  const {token,cable}=await shop(ctx);
  const sold=await change(ctx,token,'prepare_sale',{items:[{sku:cable.sku,qty:3,unit_price:28000}],paid_now:50000,customer:'Ali',phone:'+998901234567',due:today,note:'nasiya'});
  const receipt=sold.prepared.effects.sales[0].receipt;
  const cashBefore=cash(ctx);
  const fixed=await change(ctx,token,'prepare_sale_correction',{receipt,items:[{sku:cable.sku,qty:2,unit_price:27000}],reason:'Son va narx xato yozilgan'});
  const e=fixed.prepared.effects;
  assert.equal(e.returned_sales[0].receipt,receipt);
  assert.deepEqual([e.sales[0].total,e.sales[0].received,e.sales[0].on_credit],[54000,50000,4000],'money already collected carries over');
  assert.equal(e.stock[0].delta,1,'one unit goes back to stock');
  const s=state(ctx);
  assert.equal(s.sales.find(x=>x.id===receipt).returned,true);
  assert.equal(s.sales.at(-1).corrects,receipt);
  assert.equal(stock(s.products.find(x=>x.id===cable.id)),8);
  assert.equal(s.debts.find(d=>d.saleId===s.sales.at(-1).id).balance,4000);
  assert.equal(cash(ctx),cashBefore,'collected money is unchanged by the correction');
  await refused(ctx,token,'prepare_sale_correction',{receipt,items:[{sku:cable.sku,qty:1,unit_price:28000}],reason:'x'},/Faol chek topilmadi/);
  await refused(ctx,token,'prepare_sale_correction',{receipt:s.sales.at(-1).id,items:[{sku:cable.sku,qty:0,unit_price:28000}],reason:'x'},/prepare_sale_return/);
}));

test('cash entries can be corrected or cancelled; the books move by exactly the difference',async()=>withServer(async ctx=>{
  const {token}=await shop(ctx);
  await change(ctx,token,'prepare_cash_entry',{kind:'expense',amount:15000,category:'Transport',note:'Yo‘l kira'});
  const list=await tool(ctx,token,'list_cash_movements',{period:'today'});
  const entry=list.data.movements.find(m=>m.kind==='expense');
  assert.equal(entry.can_reverse,true);
  const before=cash(ctx);
  const fixed=await change(ctx,token,'prepare_cash_correction',{movement_id:entry.movement_id,amount:18000,note:'To‘g‘ri summa 18 000'});
  assert.equal(fixed.prepared.effects.cash_delta,-3000);assert.equal(cash(ctx),before-3000);
  assert.ok(fixed.prepared.summary.some(l=>/Bekor qilinadi: expense 15 000 so‘m/.test(l)));
  const second=(await tool(ctx,token,'list_cash_movements',{period:'today',kind:'expense'})).data.movements.find(m=>!m.cancelled&&m.amount===18000);
  const reversed=await change(ctx,token,'prepare_cash_reversal',{movement_id:second.movement_id,reason:'Umuman bo‘lmagan'});
  assert.equal(reversed.prepared.effects.cash_delta,18000);assert.equal(cash(ctx),before+15000);
  await refused(ctx,token,'prepare_cash_reversal',{movement_id:second.movement_id,reason:'yana'},/topilmadi/);
  await refused(ctx,token,'prepare_cash_correction',{movement_id:second.movement_id,amount:1,category:'Boshqa',note:'x'},/topilmadi/);
}));

test('debtor details and old debts: boss-only parts stay boss-only, amounts cannot go below what was repaid',async()=>withServer(async ctx=>{
  const {token,cable}=await shop(ctx);
  await change(ctx,token,'prepare_opening_debt',{customer:'Karim',phone:'+998901112233',amount:100000,due:today,note:'Avvalgi qarz'});
  const debtId=(await tool(ctx,token,'list_debts')).data.debts[0].debt_id;
  await change(ctx,token,'prepare_debt_payment',{debt_id:debtId,amount:30000,note:'Qisman'});
  await refused(ctx,token,'prepare_debt_edit',{debt_id:debtId,amount:20000},/butun son|dan oshmasin|Son yoki summa/);
  const edit=await change(ctx,token,'prepare_debt_edit',{debt_id:debtId,customer:'Karim Aliyev',amount:120000});
  assert.ok(edit.prepared.summary.some(l=>/Tahrir: qarz Karim Aliyev · customer: Karim → Karim Aliyev/.test(l)),edit.prepared.summary.join('\n'));
  assert.equal(state(ctx).debts[0].balance,90000);
  const sold=await change(ctx,token,'prepare_sale',{items:[{sku:cable.sku,qty:1,unit_price:28000}],paid_now:0,customer:'Vali',phone:'+998901234567',due:today,note:'nasiya'});
  const saleDebt=state(ctx).debts.find(d=>d.saleId===sold.prepared.effects.sales[0].receipt);
  await refused(ctx,token,'prepare_debt_edit',{debt_id:saleDebt.id,amount:1000},/avvaldan qolgan/);
  await change(ctx,token,'prepare_debt_edit',{debt_id:saleDebt.id,phone:'+998 90 000 00 00',due:'2030-01-31'});
  const seller=(await connectAs(ctx,'sardor',{write:true})).token;
  await refused(ctx,seller,'prepare_opening_debt',{customer:'X',phone:'+998901112233',amount:5,due:today,note:'x'},/faqat Otabek/);
  const removed=await refused(ctx,token,'prepare_opening_debt_removal',{debt_id:debtId,reason:'xato'},/topilmadi|faol to‘lov/);
  void removed;
  await change(ctx,token,'prepare_opening_debt',{customer:'Toza',phone:'+998901112299',amount:5000,due:today,note:'sinov'});
  const clean=(await tool(ctx,token,'list_debts')).data.debts.find(d=>d.customer==='Toza');
  const gone=await change(ctx,token,'prepare_opening_debt_removal',{debt_id:clean.debt_id,reason:'Xato kiritilgan'});
  assert.equal(gone.prepared.effects.debts[0].delta,-5000);
}));

test('editing, removing and restoring a product shows exactly which fields change',async()=>withServer(async ctx=>{
  const {token,cable,group}=await shop(ctx);
  const detail=await tool(ctx,token,'get_product',{sku:cable.sku});
  assert.equal(detail.data.price_max,30000);assert.equal(detail.data.batches[0].unit_cost,20000);
  const edit=await change(ctx,token,'prepare_product_edit',{sku:cable.sku,name:'USB-C kabel',price_min:26000,price_max:32000,low_stock_limit:3});
  const lines=edit.prepared.summary.join('\n');
  assert.match(lines,/mahsulot TZ-\d+ · name: Type-C kabel → USB-C kabel/);assert.match(lines,/min: 5 → 3/);assert.match(lines,/Narx oralig‘i .*25 000–30 000 → 26 000–32 000/);
  const p=state(ctx).products.find(x=>x.id===cable.id);
  assert.deepEqual([p.name,p.minPrice,p.price,p.min],['USB-C kabel',26000,32000,3]);
  assert.equal(stock(p),10,'stock is untouched by an edit');
  await refused(ctx,token,'prepare_product_edit',{sku:cable.sku,phone_model:'S24'},/faqat g‘ilof/);
  await refused(ctx,token,'prepare_product_edit',{sku:cable.sku,price_min:40000,price_max:30000},/oshmasin/);
  await refused(ctx,token,'prepare_product_edit',{sku:cable.sku,brand:'nokia'},/brand/);
  const grouped=await change(ctx,token,'prepare_product_edit',{sku:group.sku,audience:'women'});
  assert.equal(state(ctx).products.find(x=>x.id===group.id).audience,'women');
  const archived=await change(ctx,token,'prepare_product_archive',{sku:cable.sku,archived:true,reason:'Endi sotilmaydi'});
  assert.ok(archived.prepared.summary.some(l=>/katalogdan olib tashlangan: yo‘q → ha/.test(l)));
  assert.equal((await tool(ctx,token,'search_products',{query:'USB-C'})).data.total_found,0);
  assert.equal((await tool(ctx,token,'search_products',{query:'USB-C',include_archived:true})).data.products[0].archived,true);
  await refused(ctx,token,'prepare_product_archive',{sku:cable.sku,archived:true,reason:'yana'},/allaqachon/);
  await change(ctx,token,'prepare_product_archive',{sku:cable.sku,archived:false});
  assert.equal(state(ctx).products.find(x=>x.id===cable.id).archivedAt,undefined);
  void grouped;
}));

test('receipts, write-offs, services, rent and day-end counts can all be corrected or cancelled with exact effects',async()=>withServer(async ctx=>{
  const {token,cable}=await shop(ctx);
  const receipts=(await tool(ctx,token,'list_stock_receipts',{period:'all'})).data.receipts;
  const mine=receipts.find(r=>r.sku===cable.sku);
  assert.equal(mine.unit_cost,20000);
  const fixed=await change(ctx,token,'prepare_purchase_correction',{purchase_id:mine.purchase_id,qty:12,unit_cost:20000,note:'12 dona kelgan edi'});
  assert.equal(fixed.prepared.effects.stock[0].delta,2);assert.equal(fixed.prepared.effects.cash_delta,-40000);
  await change(ctx,token,'prepare_sale',{items:[{sku:cable.sku,qty:2,unit_price:28000}]});
  await refused(ctx,token,'prepare_purchase_removal',{purchase_id:mine.purchase_id,reason:'xato'},/ishlatilgan/);
  await change(ctx,token,'prepare_stock_receipt',{items:[{new_product:{...CABLE,name:'Vaqtincha',variant:'x'},qty:3,unit_cost:10000,price_min:12000,price_max:15000}]});
  const temp=(await tool(ctx,token,'list_stock_receipts',{period:'all'})).data.receipts.find(r=>r.product&&/Vaqtincha/.test(r.product));
  const removed=await change(ctx,token,'prepare_purchase_removal',{purchase_id:temp.purchase_id,reason:'Kelmadi'});
  assert.equal(removed.prepared.effects.cash_delta,30000);
  // write-offs
  await change(ctx,token,'prepare_dispose_stock',{sku:cable.sku,qty:2,reason:'Singan'});
  const defect=(await tool(ctx,token,'list_defects')).data.defects[0];
  const fixedDefect=await change(ctx,token,'prepare_defect_correction',{defect_id:defect.defect_id,qty:1,reason:'Bittasi butun ekan'});
  assert.equal(fixedDefect.prepared.effects.stock[0].delta,1);
  const undone=await change(ctx,token,'prepare_defect_removal',{defect_id:(await tool(ctx,token,'list_defects')).data.defects.find(d=>!d.cancelled).defect_id,reason:'Yaroqli'});
  assert.equal(undone.prepared.effects.stock[0].delta,1);
  // services
  await change(ctx,token,'prepare_service_profit',{title:'Ekran',profit:100000,note:'x'});
  const service=(await tool(ctx,token,'list_services')).data.services[0];
  await change(ctx,token,'prepare_service_correction',{service_id:service.service_id,title:'Ekran almashtirish',profit:120000,note:'To‘g‘ri foyda'});
  const live=(await tool(ctx,token,'list_services')).data.services.find(s=>!s.cancelled);
  assert.equal(live.profit,120000);
  await change(ctx,token,'prepare_service_removal',{service_id:live.service_id,reason:'Bekor bo‘ldi'});
  assert.equal((await tool(ctx,token,'list_services')).data.services.every(s=>s.cancelled),true);
  // rent
  const month=today.slice(0,7);
  await change(ctx,token,'prepare_rent',{month,amount:900000,note:'Kelishilgan'});
  assert.equal((await tool(ctx,token,'list_rents')).data.rents[0].agreed,900000);
  await change(ctx,token,'prepare_rent_removal',{month,reason:'Xato oy'});
  assert.equal((await tool(ctx,token,'list_rents')).data.rents[0].cancelled,true);
  await refused(ctx,token,'prepare_rent_removal',{month,reason:'yana'},/faol ijara yo‘q/);
  // day-end
  const expected=cash(ctx);
  await change(ctx,token,'prepare_day_close',{counted_cash:expected,left_for_tomorrow:100000,handover:true,note:'Kun yopildi'});
  const closing=(await tool(ctx,token,'list_day_closings')).data.closings[0];
  const cashAfterClose=cash(ctx);
  assert.equal(cashAfterClose,100000,'handover left exactly the float in the box');
  const recounted=await change(ctx,token,'prepare_closing_correction',{closing_id:closing.closing_id,counted_cash:expected,left_for_tomorrow:200000,handover:true,note:'Qaytim 200 000 edi'});
  assert.equal(cash(ctx),200000);assert.ok(recounted.prepared.effects.cash_delta===100000);
  await change(ctx,token,'prepare_closing_removal',{closing_id:(await tool(ctx,token,'list_day_closings')).data.closings.find(c=>!c.cancelled).closing_id,reason:'Xato sanash'});
  assert.equal(cash(ctx),expected,'cancelling the count returns the handed-over money to the books');
}));

test('opening balances, catalog options, staff settings and shop name change exactly what the preview says',async()=>withServer(async ctx=>{
  const {token}=await shop(ctx);
  const before=cash(ctx);
  const opening=await change(ctx,token,'prepare_opening_balances',{cash:6000000,owed_to_asilbek:50000,owed_to_boybek:0,note:'Daftardan'});
  assert.equal(opening.prepared.effects.cash_delta,1000000);assert.equal(cash(ctx),before+1000000);
  assert.ok(opening.prepared.warnings.join(' ').match(/keyingi kassa/));
  assert.equal((await tool(ctx,token,'get_staff_settings')).data.opening_balances.owed_to_jasur,50000);
  // catalog
  await change(ctx,token,'prepare_catalog_change',{kind:'categories',action:'add',name:'Planshet aksessuarlari'});
  await change(ctx,token,'prepare_catalog_change',{kind:'categories',action:'rename',value:'Planshet aksessuarlari',new_name:'Planshetlar'});
  assert.ok((await tool(ctx,token,'get_catalog_options')).data.categories.includes('Planshetlar'));
  await refused(ctx,token,'prepare_catalog_change',{kind:'categories',action:'add',name:'Planshetlar'},/allaqachon/);
  await refused(ctx,token,'prepare_catalog_change',{kind:'categories',action:'remove',value:'Kabellar',replacement:'Kabellar'},/almashtir|boshqa tanlov/i);
  const removal=await change(ctx,token,'prepare_catalog_change',{kind:'categories',action:'remove',value:'Kabellar',replacement:'Planshetlar'});
  assert.equal(state(ctx).products.find(x=>x.name==='Type-C kabel').category,'Planshetlar');
  assert.ok(removal.prepared.warnings.length);
  // staff
  const staff=(await tool(ctx,token,'get_staff_settings')).data;
  assert.equal(staff.people.find(p=>p.id==='sardor').permissions.sell,true);
  const seller=(await connectAs(ctx,'sardor',{write:true})).token;
  await refused(ctx,seller,'prepare_staff_settings',{person:'sardor',permissions:{reverse:false}},/faqat Otabek/);
  const switched=await change(ctx,token,'prepare_staff_settings',{person:'Boybek',permissions:{sell:false},display_name:'Boybek A.'});
  assert.ok(switched.prepared.summary.some(l=>/xodim sardor · ruxsat sell: ha → yo‘q/.test(l)));
  assert.ok(switched.prepared.summary.some(l=>/xodim sardor · ism: Boybek → Boybek A\./.test(l)));
  const group=state(ctx).products.find(x=>x.model==='S23 Ultra');
  await refused(ctx,seller,'prepare_sale',{items:[{sku:group.sku,qty:1,unit_price:40000}]},/ruxsat/i);
  await refused(ctx,token,'prepare_staff_settings',{person:'aziz',permissions:{sell:false}},/Boshliq/);
  await refused(ctx,token,'prepare_staff_settings',{person:'jasur',permissions:{reports:true}},/mavjud emas/);
  await refused(ctx,token,'prepare_staff_settings',{person:'jasur',permissions:{sell:'ha'}},/true yoki false/);
  // shop
  await change(ctx,token,'prepare_shop_settings',{shop_name:'TelefonZona Chilonzor'});
  assert.equal(state(ctx).settings.shop,'TelefonZona Chilonzor');
  await refused(ctx,token,'prepare_shop_settings',{},/kamida bittasini/);
}));

test('receipt tasks: reassign, cancel and receive goods line by line, including a product that does not exist yet',async()=>withServer(async ctx=>{
  const {token,cable}=await shop(ctx);
  await change(ctx,token,'prepare_receipt_task',{worker:'jasur',note:'Yuk',lines:[{what:'Kabellar',qty:5,sku:cable.sku},{what:'Yangi karbon g‘ilof',qty:4}]});
  const list=(await tool(ctx,token,'list_receipt_tasks')).data.tasks[0];
  assert.deepEqual(list.lines.map(l=>l.line),[1,2]);
  await change(ctx,token,'prepare_receipt_task_change',{task:list.code,action:'reassign',worker:'sardor'});
  assert.equal(state(ctx).intakes[0].worker,'sardor');
  const seller=(await connectAs(ctx,'sardor',{write:true})).token;
  const first=await change(ctx,seller,'prepare_receipt_task_receive',{task:list.code,line:1,qty:5,unit_cost:21000});
  assert.equal(first.prepared.effects.stock[0].delta,5);
  assert.equal(state(ctx).intakes[0].lines[0].doneQty,5);
  await refused(ctx,seller,'prepare_receipt_task_receive',{task:list.code,line:2,qty:4,unit_cost:20000},/new_product/);
  await refused(ctx,seller,'prepare_receipt_task_receive',{task:list.code,line:1,qty:1,unit_cost:20000,new_product:CASE},/allaqachon mahsulotga bog‘langan/);
  await refused(ctx,seller,'prepare_receipt_task_receive',{task:list.code,line:2,qty:4,unit_cost:20000,price_min:35000,price_max:45000,new_product:CASE},/ro‘yxatda bor/);
  const fresh={...CASE,phone_model:'S24 Ultra'};
  const second=await change(ctx,seller,'prepare_receipt_task_receive',{task:list.code,line:2,qty:4,unit_cost:30000,price_min:40000,price_max:55000,new_product:fresh});
  assert.equal(second.prepared.effects.stock[0].is_new,true);
  assert.equal(state(ctx).intakes[0].status,'done');
  assert.ok(state(ctx).purchases.filter(p=>p.intakeId).every(p=>p.actor==='sardor'));
  await refused(ctx,token,'prepare_receipt_task_change',{task:list.code,action:'cancel',reason:'x'},/ochiq topshiriq topilmadi/);
  await change(ctx,token,'prepare_receipt_task',{worker:'jasur',lines:[{what:'Yana',qty:1}]});
  const open=(await tool(ctx,token,'list_receipt_tasks')).data.tasks[0];
  await change(ctx,token,'prepare_receipt_task_change',{task:open.code,action:'cancel',reason:'Yuk kelmadi'});
  assert.equal(state(ctx).intakes.at(-1).status,'cancelled');
  await refused(ctx,seller,'prepare_receipt_task_change',{task:open.code,action:'cancel',reason:'x'},/faqat Otabek/);
}));

test('what a seller’s Claude can look up is limited to what that seller may see',async()=>withServer(async ctx=>{
  const {token,cable}=await shop(ctx);
  await change(ctx,token,'prepare_cash_entry',{kind:'expense',amount:5000,note:'Boshliq xarajati'});
  const sold=await change(ctx,token,'prepare_sale',{items:[{sku:cable.sku,qty:1,unit_price:28000}]});
  const seller=(await connectAs(ctx,'sardor',{write:true})).token;
  for(const name of ['list_rents','list_day_closings','get_staff_settings'])await refused(ctx,seller,name,{},/faqat Otabek/);
  assert.equal((await tool(ctx,seller,'list_cash_movements',{period:'all'})).data.movements.length,0,'no one else’s cash entries');
  assert.equal((await tool(ctx,seller,'list_stock_receipts',{period:'all'})).data.receipts.length,0);
  assert.equal((await tool(ctx,seller,'list_services',{period:'all'})).data.services.length,0);
  const own=await tool(ctx,seller,'get_sale',{receipt:sold.prepared.effects.sales[0].receipt});
  assert.equal(own.isError,true,'a colleague’s receipt detail is not available');
  const mine=await change(ctx,seller,'prepare_sale',{items:[{sku:cable.sku,qty:1,unit_price:28000}]});
  const detail=(await tool(ctx,seller,'get_sale',{receipt:mine.prepared.effects.sales[0].receipt})).data;
  assert.equal(detail.items[0].sku,cable.sku);assert.equal(detail.seller,'Boybek');
  const names=(await (await rpc(ctx,seller,{jsonrpc:'2.0',id:1,method:'tools/list'})).json()).result.tools.map(t=>t.name);
  assert.equal(names.some(n=>/password|session|token|connector|backup|export/i.test(n)),false,'secrets and access are never exposed');
}));
