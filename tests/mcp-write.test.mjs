import test from 'node:test';
import assert from 'node:assert/strict';
import {boot,PRODUCT} from './server-helpers.mjs';
import {connectAs,tool,rpc} from './mcp-helpers.mjs';
import {accountBalances} from '../src/business.js';
import {stock} from '../src/model.js';
import {readBackup} from '../src/backup.js';

const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tashkent'}).format(new Date());
const CASE={type:'case',brand:'samsung',phone_model:'S23 Ultra',audience:'men',material:'Karbon',quality:'standard',owner:'sardor'};
const CABLE={type:'other',brand:'other',name:'Type-C kabel',variant:'1 metr',category:'Kabellar',owner:'aziz'};
const withServer=async fn=>{const ctx=await boot();try{await fn(ctx);}finally{await ctx.close();}};
const state=ctx=>ctx.store.read().state;
const cash=ctx=>accountBalances(structuredClone(state(ctx)))['cash'];
const proposals=ctx=>ctx.db.prepare('SELECT COUNT(*) n FROM mcp_proposals').get().n;
async function boss(ctx){return (await connectAs(ctx,'aziz',{write:true})).token;}
async function change(ctx,token,name,args){
  const prepared=await tool(ctx,token,name,args);
  assert.equal(prepared.isError,false,prepared.text);
  const done=await tool(ctx,token,'commit_change',{proposal_id:prepared.data.proposal_id,user_confirmed:true});
  assert.equal(done.isError,false,done.text);
  return {prepared:prepared.data,done:done.data};
}
const delivery=[
  {new_product:CASE,qty:20,unit_cost:25000,price_min:35000,price_max:45000},
  {new_product:CABLE,qty:10,unit_cost:20000,price_min:25000,price_max:30000},
];

test('a read-only connection neither sees nor can call the write tools; a write connection sees them all',async()=>withServer(async ctx=>{
  const read=(await connectAs(ctx,'aziz')).token,write=await boss(ctx);
  assert.equal((await connectAs(ctx,'aziz',{write:true})).scope,'mcp:read mcp:write');
  const names=async token=>(await (await rpc(ctx,token,{jsonrpc:'2.0',id:1,method:'tools/list'})).json()).result.tools.map(t=>t.name);
  assert.equal((await names(read)).some(n=>n.startsWith('prepare_')||n==='commit_change'),false);
  const all=await names(write);
  for(const n of ['prepare_stock_receipt','prepare_sale','prepare_debt_payment','prepare_cash_entry','prepare_day_close','commit_change'])assert.ok(all.includes(n),n);
  const refused=await tool(ctx,read,'prepare_stock_receipt',{items:delivery});
  assert.equal(refused.isError,true);assert.match(refused.text,/yozish ruxsati berilmagan/);
  assert.equal(proposals(ctx),0);
  const listing=(await (await rpc(ctx,write,{jsonrpc:'2.0',id:2,method:'tools/list'})).json()).result.tools;
  assert.ok(listing.filter(t=>t.name.startsWith('prepare_')).every(t=>t.annotations.readOnlyHint===false&&t.annotations.destructiveHint===false));
  assert.equal(listing.find(t=>t.name==='commit_change').annotations.destructiveHint,true);
  const schema=listing.find(t=>t.name==='prepare_stock_receipt').inputSchema.properties.items.items.properties.new_product.properties;
  assert.ok(schema.brand.enum.includes('samsung')&&schema.quality.enum.includes('standard')&&schema.owner.enum.includes('jasur'),'exact ids come from the shop catalog');
}));

test('a delivery list: the preview is exact, nothing is saved until confirmed, then every number is recorded precisely',async()=>withServer(async ctx=>{
  const token=await boss(ctx);
  const prepared=await tool(ctx,token,'prepare_stock_receipt',{note:'Dushanba yuki',items:delivery});
  assert.equal(prepared.isError,false,prepared.text);
  const p=prepared.data;
  assert.equal(p.status,'preview_only_nothing_saved');
  assert.equal(p.effects.cash_delta,-(20*25000+10*20000),'cash effect computed by the server');
  assert.deepEqual(p.effects.stock.map(s=>[s.is_new,s.before,s.after]),[[true,0,20],[true,0,10]]);
  assert.ok(p.summary.some(l=>/YANGI mahsulot: S23 Ultra.*Boybek.*20 dona.*35 000–45 000/.test(l)),p.summary.join('\n'));
  assert.ok(p.summary.includes('Kassadan chiqadi: 700 000 so‘m'));
  assert.equal(state(ctx).products.length,0,'preview saved nothing');assert.equal(ctx.store.version(),0);
  const early=await tool(ctx,token,'commit_change',{proposal_id:p.proposal_id,user_confirmed:false});
  assert.equal(early.isError,true);assert.match(early.text,/aniq rozilik/);assert.equal(state(ctx).products.length,0);
  const done=await tool(ctx,token,'commit_change',{proposal_id:p.proposal_id,user_confirmed:true});
  assert.equal(done.isError,false,done.text);
  assert.equal(done.data.cash_in_register_after,-700000);
  const s=state(ctx);
  assert.equal(s.products.length,2);
  const group=s.products.find(x=>x.model==='S23 Ultra'),cable=s.products.find(x=>x.name==='Type-C kabel');
  assert.deepEqual([stock(group),group.owner,group.minPrice,group.price,group.lots[0].cost,group.audience,group.material,group.quality],[20,'sardor',35000,45000,25000,'men','Karbon','standard']);
  assert.deepEqual([stock(cable),cable.owner,cable.minPrice,cable.price,cable.lots[0].cost],[10,'aziz',25000,30000,20000]);
  assert.equal(cash(ctx),-700000,'books agree with the preview');
  assert.ok(s.audit.slice(0,2).every(a=>a.via==='claude'&&a.actor==='aziz'),'history says it came through Claude');
  assert.equal(s.purchases.filter(x=>x.actor==='aziz').length,2);
  readBackup(JSON.stringify(s));
  const again=await tool(ctx,token,'commit_change',{proposal_id:p.proposal_id,user_confirmed:true});
  assert.equal(again.isError,false);assert.match(again.data.note,/qayta yozilmadi/);
  assert.equal(state(ctx).products.reduce((n,x)=>n+stock(x),0),30,'a repeated commit never doubles the stock');
}));

test('goods that already exist get a new batch instead of a duplicate; different cost stays a separate batch (FIFO)',async()=>withServer(async ctx=>{
  const token=await boss(ctx);
  await change(ctx,token,'prepare_stock_receipt',{items:delivery});
  const skuCable=state(ctx).products.find(x=>x.name==='Type-C kabel').sku;
  const second=await change(ctx,token,'prepare_stock_receipt',{items:[
    {new_product:CASE,qty:5,unit_cost:26000,price_min:35000,price_max:45000},
    {new_product:CABLE,qty:4,unit_cost:21000},
    {sku:skuCable.toLowerCase(),qty:1,unit_cost:22000},
  ]});
  assert.ok(second.prepared.effects.stock.every(x=>!x.is_new),'nothing new was created');
  const s=state(ctx);
  assert.equal(s.products.length,2);
  const group=s.products.find(x=>x.model==='S23 Ultra'),cable=s.products.find(x=>x.name==='Type-C kabel');
  assert.deepEqual(group.lots.map(l=>[l.qty,l.cost]),[[20,25000],[5,26000]]);
  assert.deepEqual(cable.lots.map(l=>[l.qty,l.cost]),[[10,20000],[4,21000],[1,22000]]);
  assert.equal(cash(ctx),-(20*25000+10*20000)-(5*26000+4*21000+1*22000));
  // selling across batches uses the oldest cost first
  const sale=await change(ctx,token,'prepare_sale',{items:[{sku:cable.sku,qty:12,unit_price:28000}]});
  assert.equal(sale.prepared.effects.sales[0].cost_of_goods,10*20000+2*21000);
  assert.equal(sale.prepared.effects.sales[0].gross_profit,12*28000-(10*20000+2*21000));
}));

test('every unclear or wrong number is refused before anything is prepared or saved',async()=>withServer(async ctx=>{
  const token=await boss(ctx);
  await change(ctx,token,'prepare_stock_receipt',{items:delivery});
  const sku=state(ctx).products.find(x=>x.name==='Type-C kabel').sku;
  const before=ctx.store.version(),saved=proposals(ctx);
  const good={new_product:CABLE,qty:1,unit_cost:20000,price_min:25000,price_max:30000};
  const bad=[
    [{...good,qty:'10'},/butun son/],[{...good,qty:1.5},/butun son/],[{...good,qty:0},/gacha bo‘lsin/],[{...good,qty:-3},/gacha bo‘lsin/],
    [{...good,unit_cost:'20.000'},/butun son/],[{...good,unit_cost:20000.5},/butun son/],[{...good,unit_cost:0},/gacha bo‘lsin/],[{...good,unit_cost:null},/kerak/],
    [{...good,price_min:40000},/price_min price_max dan oshmasin/],[{...good,price_min:25000,price_max:undefined},/price_max/],
    [{qty:1,unit_cost:100,sku:'TZ-9999'},/topilmadi/],[{qty:1,unit_cost:100,sku},{...{}}].slice(0,1)[0]&&[{qty:1,unit_cost:100,sku,new_product:CABLE},/faqat bittasini/],
    [{...good,new_product:{...CABLE,brand:'nokia'}},/brand/],[{...good,new_product:{...CABLE,category:'Yo‘q'}},/category/],[{...good,new_product:{...CABLE,owner:'ali'}},/egasi topilmadi/],
    [{qty:1,unit_cost:100,new_product:{...CASE,quality:'gold'},price_min:1,price_max:2},/quality/],
    [{qty:1,unit_cost:100,new_product:{type:'other',brand:'other',name:'Yangi',variant:'x',category:'Kabellar'}},/price_min va price_max/],
    [{...good,qty:1e9},/gacha bo‘lsin/],
  ];
  for(const [item,pattern] of bad){
    const res=await tool(ctx,token,'prepare_stock_receipt',{items:[item]});
    assert.equal(res.isError,true,JSON.stringify(item));assert.match(res.text,pattern,JSON.stringify(item));
  }
  // fields the tool does not know are never silently ignored
  for(const [item,field] of [[{...good,discount:5000},'discount'],[{...good,price:30000},'price'],[{...good,new_product:{...CABLE,color:'qora'}},'color'],[{...good,new_product:{...CABLE,brand:'other'},note:'x'},'note']]){
    const res=await tool(ctx,token,'prepare_stock_receipt',{items:[item]});
    assert.equal(res.isError,true,field);assert.match(res.text,new RegExp(field+' maydoni mavjud emas'));
  }
  assert.match((await tool(ctx,token,'prepare_stock_receipt',{items:[good],extra:1})).text,/args\.extra maydoni mavjud emas/);
  assert.match((await tool(ctx,token,'prepare_sale',{items:[{sku,qty:1,unit_price:28000,note:'x'}]})).text,/items\[0\]\.note maydoni mavjud emas/);
  assert.match((await tool(ctx,token,'commit_change',{proposal_id:'chg_x',user_confirmed:true,force:true})).text,/force maydoni mavjud emas/);
  const twice=await tool(ctx,token,'prepare_stock_receipt',{items:[{...good,new_product:{...CABLE,name:'Boshqa kabel'}},{...good,new_product:{...CABLE,name:'Boshqa kabel'}}]});
  assert.match(twice.text,/ikki marta/);
  assert.equal((await tool(ctx,token,'prepare_stock_receipt',{items:[]})).isError,true);
  assert.equal(ctx.store.version(),before);assert.equal(proposals(ctx),saved,'refused requests leave no proposals');
}));

test('suspicious but allowed numbers come with warnings the user must see',async()=>withServer(async ctx=>{
  const token=await boss(ctx);
  await change(ctx,token,'prepare_stock_receipt',{items:delivery});
  const sku=state(ctx).products.find(x=>x.name==='Type-C kabel').sku;
  const res=await tool(ctx,token,'prepare_stock_receipt',{items:[{sku,qty:6000,unit_cost:95000,price_min:50000,price_max:60000}]});
  assert.equal(res.isError,false,res.text);
  const w=res.data.warnings.join('\n');
  assert.match(w,/avvalgi o‘rtacha tannarx/);assert.match(w,/tannarxdan past/);assert.match(w,/juda ko‘p/);
}));

test('if the records changed so the effects differ, nothing is saved and the proposal is dead',async()=>withServer(async ctx=>{
  const token=await boss(ctx),api=await ctx.signIn('aziz');
  const prepared=(await tool(ctx,token,'prepare_stock_receipt',{items:[delivery[0]]})).data;
  // someone enters the very same group first: the previewed "new product" would now merge into it
  await api.command('product.groups',{data:{brand:'samsung',model:'S23 Ultra',audience:'men',material:'Karbon',owner:'sardor',min:5,rows:[{quality:'standard',qty:3,cost:25000,price:45000,minPrice:35000}]}});
  const version=ctx.store.version(),cashBefore=cash(ctx);
  const res=await tool(ctx,token,'commit_change',{proposal_id:prepared.proposal_id,user_confirmed:true});
  assert.equal(res.isError,true);assert.match(res.text,/o‘zgargan.*Hech narsa saqlanmadi/);
  assert.equal(ctx.store.version(),version);assert.equal(cash(ctx),cashBefore);
  assert.equal(stock(state(ctx).products[0]),3);
  const retry=await tool(ctx,token,'commit_change',{proposal_id:prepared.proposal_id,user_confirmed:true});
  assert.match(retry.text,/o‘zgargan edi|Qaytadan/);
}));

test('a sale is also refused if another sale changed which batch it would take from (cost would differ)',async()=>withServer(async ctx=>{
  const token=await boss(ctx),api=await ctx.signIn('aziz');
  await change(ctx,token,'prepare_stock_receipt',{items:[delivery[1]]});
  const cable=state(ctx).products[0];
  await change(ctx,token,'prepare_stock_receipt',{items:[{sku:cable.sku,qty:5,unit_cost:21000}]});
  const prepared=(await tool(ctx,token,'prepare_sale',{items:[{sku:cable.sku,qty:3,unit_price:28000}]})).data;
  assert.equal(prepared.effects.sales[0].cost_of_goods,60000);
  await api.command('sale.record',{cart:[{productId:cable.id,qty:9,price:28000}],received:252000,data:{payment:'Naqd'}});
  const before=JSON.stringify(state(ctx));
  const res=await tool(ctx,token,'commit_change',{proposal_id:prepared.proposal_id,user_confirmed:true});
  assert.equal(res.isError,true);assert.match(res.text,/o‘zgargan/);
  assert.equal(JSON.stringify(state(ctx)),before);
}));

test('a seller never sees cost or profit in a preview or a result, but the books still record them',async()=>withServer(async ctx=>{
  const owner=await boss(ctx);
  await change(ctx,owner,'prepare_stock_receipt',{items:[delivery[1]]});
  const cable=state(ctx).products[0];
  const seller=(await connectAs(ctx,'sardor',{write:true})).token;
  const prepared=await tool(ctx,seller,'prepare_sale',{items:[{sku:cable.sku,qty:2,unit_price:28000}]});
  assert.equal(prepared.isError,false,prepared.text);
  const text=prepared.text;
  assert.equal(/cost_of_goods|gross_profit|Yalpi foyda/.test(text),false,'no profit data in the seller preview');
  const done=await tool(ctx,seller,'commit_change',{proposal_id:prepared.data.proposal_id,user_confirmed:true});
  assert.equal(/cost_of_goods|gross_profit|Yalpi foyda/.test(done.text),false);
  assert.equal(state(ctx).sales[0].items[0].cost,40000);
  const stored=JSON.parse(ctx.db.prepare('SELECT preview FROM mcp_proposals WHERE id=?').get(prepared.data.proposal_id).preview);
  assert.equal(JSON.stringify(stored).includes('gross_profit'),false);
}));

test('unrelated work in between does not block a still-identical change',async()=>withServer(async ctx=>{
  const token=await boss(ctx),api=await ctx.signIn('aziz');
  await change(ctx,token,'prepare_stock_receipt',{items:delivery});
  const [group,cable]=[state(ctx).products.find(x=>x.model==='S23 Ultra'),state(ctx).products.find(x=>x.name==='Type-C kabel')];
  const prepared=(await tool(ctx,token,'prepare_sale',{items:[{sku:cable.sku,qty:2,unit_price:28000}]})).data;
  await api.command('sale.record',{cart:[{productId:group.id,qty:3,price:40000}],received:120000,data:{payment:'Naqd'}});
  const res=await tool(ctx,token,'commit_change',{proposal_id:prepared.proposal_id,user_confirmed:true});
  assert.equal(res.isError,false,res.text);
  assert.equal(stock(state(ctx).products.find(x=>x.id===cable.id)),8);
}));

test('a delivery is all-or-nothing: if one line fails at commit time, no line is saved',async()=>withServer(async ctx=>{
  const owner=await boss(ctx),api=await ctx.signIn('aziz');
  await change(ctx,owner,'prepare_stock_receipt',{items:delivery});
  const cable=state(ctx).products.find(x=>x.name==='Type-C kabel');
  const seller=await connectAs(ctx,'sardor',{write:true});
  const prepared=(await tool(ctx,seller.token,'prepare_stock_receipt',{items:[
    {new_product:{...CABLE,name:'Yangi quvvatlagich',variant:'20W'},qty:5,unit_cost:50000,price_min:70000,price_max:80000},
    {sku:cable.sku,qty:3,unit_cost:20000},
  ]})).data;
  // Otabek hands the cable delivery to Asilbek: Boybek may no longer enter it
  await api.command('intake.create',{data:{worker:'jasur',lines:[{label:'Kabel',qty:5,productId:cable.id}]}});
  const before=JSON.stringify(state(ctx)),version=ctx.store.version();
  const res=await tool(ctx,seller.token,'commit_change',{proposal_id:prepared.proposal_id,user_confirmed:true});
  assert.equal(res.isError,true);assert.match(res.text,/Asilbek/);
  assert.equal(JSON.stringify(state(ctx)),before,'not even the first, valid line was saved');assert.equal(ctx.store.version(),version);
}));

test('a sale: totals, FIFO cost, credit and cash all come from the server and agree with a direct entry',async()=>withServer(async ctx=>{
  const token=await boss(ctx);
  await change(ctx,token,'prepare_stock_receipt',{items:[delivery[1]]});
  const cable=state(ctx).products[0];
  const prepared=await tool(ctx,token,'prepare_sale',{items:[{sku:cable.sku,qty:3,unit_price:28000}],payment:'Karta',paid_now:50000,customer:'Ali Valiyev',phone:'+998901234567',due:today,note:'ertaga beradi'});
  assert.equal(prepared.isError,false,prepared.text);
  const sale=prepared.data.effects.sales[0];
  assert.deepEqual([sale.total,sale.received,sale.on_credit,sale.cost_of_goods,sale.gross_profit],[84000,50000,34000,60000,24000]);
  assert.equal(prepared.data.effects.cash_delta,50000);
  assert.equal(prepared.data.effects.debts[0].after,34000);
  const done=await tool(ctx,token,'commit_change',{proposal_id:prepared.data.proposal_id,user_confirmed:true});
  assert.equal(done.isError,false,done.text);
  const s=state(ctx);
  assert.equal(stock(s.products[0]),7);assert.equal(s.debts[0].balance,34000);assert.equal(s.sales[0].payment,'Karta');
  assert.equal(cash(ctx),-200000+50000);
  // out of range price needs a reason; too many units is refused with the real stock shown
  const cheap=await tool(ctx,token,'prepare_sale',{items:[{sku:cable.sku,qty:1,unit_price:10000}]});
  assert.equal(cheap.isError,true);assert.match(cheap.text,/izoh|sabab/i);
  const reasoned=await tool(ctx,token,'prepare_sale',{items:[{sku:cable.sku,qty:1,unit_price:10000}],note:'Do‘st uchun'});
  assert.equal(reasoned.isError,false,reasoned.text);assert.match(reasoned.data.warnings.join(' '),/so‘mdan tashqarida/);
  const tooMany=await tool(ctx,token,'prepare_sale',{items:[{sku:cable.sku,qty:8,unit_price:28000}]});
  assert.match(tooMany.text,/omborda 7 dona bor/);
  const noCustomer=await tool(ctx,token,'prepare_sale',{items:[{sku:cable.sku,qty:1,unit_price:28000}],paid_now:10000});
  assert.equal(noCustomer.isError,true);
}));

test('a seller’s Claude can do only what the seller may, and is recorded under the seller’s name',async()=>withServer(async ctx=>{
  const owner=await boss(ctx),api=await ctx.signIn('aziz');
  await change(ctx,owner,'prepare_stock_receipt',{items:delivery});
  const cable=state(ctx).products.find(x=>x.name==='Type-C kabel');
  const seller=(await connectAs(ctx,'sardor',{write:true})).token;
  for(const [name,args] of [['prepare_rent',{month:'2026-12',amount:900000,note:'x'}],['prepare_day_close',{counted_cash:1,left_for_tomorrow:0,handover:false,note:'x'}],['prepare_receipt_task',{worker:'jasur',lines:[{what:'x',qty:1}]}]]){
    const res=await tool(ctx,seller,name,args);assert.equal(res.isError,true,name);assert.match(res.text,/faqat Otabek/);
  }
  const sold=await change(ctx,seller,'prepare_sale',{items:[{sku:cable.sku,qty:2,unit_price:28000}]});
  assert.equal(sold.prepared.effects.sales[0].gross_profit,undefined,'no profit figures for a seller');
  assert.equal(sold.prepared.effects.sales[0].cost_of_goods,undefined);
  assert.equal(sold.done.cash_in_register_after,undefined);
  const s=state(ctx);
  assert.equal(s.sales[0].seller,'sardor');assert.equal(s.audit[0].actor,'sardor');assert.equal(s.audit[0].via,'claude');
  // another person cannot commit this person's proposal
  const mine=(await tool(ctx,seller,'prepare_cash_entry',{kind:'expense',amount:5000,note:'Yo‘l kira'})).data;
  const other=(await connectAs(ctx,'jasur',{write:true})).token;
  const stolen=await tool(ctx,other,'commit_change',{proposal_id:mine.proposal_id,user_confirmed:true});
  assert.equal(stolen.isError,true);assert.match(stolen.text,/topilmadi/);
  // switching a permission off switches the connector's power off too
  const me=(await (await ctx.signIn('sardor')).get('/api/me')).json.user.permissions;
  assert.equal((await api.command('staff.permissions',{person:'sardor',name:'Boybek',permissions:{...me,stock:false,products:false}})).status,200);
  const blocked=await tool(ctx,seller,'prepare_stock_receipt',{items:[{sku:cable.sku,qty:1,unit_cost:20000}]});
  assert.equal(blocked.isError,true);assert.match(blocked.text,/ruxsat/i);
}));

test('cash entries, debts, returns, write-offs, services, prices and limits all go through the same exact path',async()=>withServer(async ctx=>{
  const token=await boss(ctx),api=await ctx.signIn('aziz');
  assert.equal((await api.command('opening.set',{accounts:{cash:5000000},payables:{jasur:0,sardor:0},note:'Boshlang‘ich'})).status,200);
  await change(ctx,token,'prepare_stock_receipt',{items:delivery});
  const cable=state(ctx).products.find(x=>x.name==='Type-C kabel');
  let expected=5000000-700000;
  const expense=await change(ctx,token,'prepare_cash_entry',{kind:'expense',amount:15000,category:'Transport',note:'Yo‘l kira'});
  expected-=15000;assert.equal(expense.prepared.effects.cash_delta,-15000);
  const pocket=await change(ctx,token,'prepare_cash_entry',{kind:'expense',amount:8000,paid_from:'own_pocket',note:'Tushlik'});
  assert.equal(pocket.prepared.effects.cash_delta,0,'paid from own pocket never touches the cash box');
  const own=await tool(ctx,token,'prepare_cash_entry',{kind:'income',amount:5,paid_from:'own_pocket',note:'x'});assert.equal(own.isError,true);
  const sale=await change(ctx,token,'prepare_sale',{items:[{sku:cable.sku,qty:2,unit_price:28000}],paid_now:20000,customer:'Vali',phone:'+998901112233',due:today,note:'nasiya'});
  expected+=20000;
  const debtId=(await tool(ctx,token,'list_debts')).data.debts[0].debt_id;
  const pay=await change(ctx,token,'prepare_debt_payment',{debt_id:debtId,amount:30000,note:'Qisman'});
  expected+=30000;assert.equal(pay.prepared.effects.debts[0].after,6000);
  const over=await tool(ctx,token,'prepare_debt_payment',{debt_id:debtId,amount:7000,note:'ko‘p'});
  assert.equal(over.isError,true);assert.match(over.text,/6 000 so‘m/);
  const service=await change(ctx,token,'prepare_service_profit',{title:'Ekran almashtirish',profit:120000,note:'Sof foyda'});
  assert.equal(service.prepared.effects.cash_delta,0,'service profit records no cash');
  await change(ctx,token,'prepare_price_change',{sku:cable.sku,price_min:26000,price_max:32000});
  assert.deepEqual([state(ctx).products.find(x=>x.id===cable.id).minPrice,state(ctx).products.find(x=>x.id===cable.id).price],[26000,32000]);
  await change(ctx,token,'prepare_low_stock_limit',{sku:cable.sku,limit:4});
  const dispose=await change(ctx,token,'prepare_dispose_stock',{sku:cable.sku,qty:1,reason:'Singan'});
  assert.equal(dispose.prepared.effects.defects[0].loss,20000);
  const returned=await change(ctx,token,'prepare_sale_return',{receipt:sale.prepared.effects.sales[0].receipt.toLowerCase(),reason:'Mijoz qaytardi'});
  assert.equal(returned.prepared.effects.returned_sales[0].total,56000);
  expected-=50000;
  assert.equal(cash(ctx),expected,'cash equals an independent running total of every step');
  const month=today.slice(0,7);
  await change(ctx,token,'prepare_rent',{month,amount:900000,note:'Kelishilgan'});
  const rent=await change(ctx,token,'prepare_rent_payment',{month,amount:100000,note:'Birinchi qism'});
  expected-=100000;assert.equal(rent.prepared.effects.cash_delta,-100000);
  const close=await tool(ctx,token,'prepare_day_close',{counted_cash:expected+1000,left_for_tomorrow:50000,handover:false,note:'Kun yopildi'});
  assert.equal(close.isError,false,close.text);assert.match(close.data.warnings.join(' '),/1 000 so‘m ko‘p/);
  assert.equal((await tool(ctx,token,'commit_change',{proposal_id:close.data.proposal_id,user_confirmed:true})).isError,false);
  assert.equal(state(ctx).closings[0].difference,1000);
  const task=await change(ctx,token,'prepare_receipt_task',{worker:'Asilbek',note:'Ertalabki yuk',lines:[{what:'Kabellar',qty:5,sku:cable.sku}]});
  assert.equal(task.prepared.effects.intakes[0].worker,'jasur');
  readBackup(JSON.stringify(state(ctx)));
  assert.ok(state(ctx).audit.slice(0,12).every(a=>a.via==='claude'));
}));

test('a proposal expires after fifteen minutes and cannot be applied late',async()=>withServer(async ctx=>{
  const token=await boss(ctx);
  const prepared=(await tool(ctx,token,'prepare_stock_receipt',{items:[delivery[1]]})).data;
  ctx.db.prepare('UPDATE mcp_proposals SET expires_at=? WHERE id=?').run(Date.now()-1,prepared.proposal_id);
  const res=await tool(ctx,token,'commit_change',{proposal_id:prepared.proposal_id,user_confirmed:true});
  assert.equal(res.isError,true);assert.match(res.text,/muddati tugagan/);assert.equal(state(ctx).products.length,0);
  assert.equal((await tool(ctx,token,'commit_change',{proposal_id:'chg_yoq',user_confirmed:true})).isError,true);
}));

test('a runaway loop is stopped: at most sixty applied changes per hour',async()=>withServer(async ctx=>{
  const token=await boss(ctx);
  await change(ctx,token,'prepare_stock_receipt',{items:[delivery[1]]});
  const sku=state(ctx).products[0].sku;
  for(let i=0;i<59;i++)await change(ctx,token,'prepare_low_stock_limit',{sku,limit:i%5});
  const prepared=(await tool(ctx,token,'prepare_low_stock_limit',{sku,limit:9})).data;
  const res=await tool(ctx,token,'commit_change',{proposal_id:prepared.proposal_id,user_confirmed:true});
  assert.equal(res.isError,true);assert.match(res.text,/Soatiga 60/);
}));

test('connections can be listed and cut off by their owner or by Otabek',async()=>withServer(async ctx=>{
  const a=await connectAs(ctx,'sardor',{write:true}),b=await connectAs(ctx,'jasur');
  const bossApi=await ctx.signIn('aziz'),boybek=await ctx.signIn('sardor');
  const all=(await bossApi.get('/api/connectors')).json.connectors;
  assert.deepEqual(all.map(c=>[c.person,c.scope.includes('mcp:write')]).sort(),[['jasur',false],['sardor',true]]);
  const mine=(await boybek.get('/api/connectors')).json.connectors;
  assert.equal(mine.length,1);assert.equal(mine[0].person,'sardor');
  const theirs=all.find(c=>c.person==='jasur');
  assert.equal((await boybek.post('/api/connectors/revoke',{id:theirs.id})).status,404,'a seller cannot cut someone else off');
  assert.equal((await bossApi.post('/api/connectors/revoke',{id:theirs.id})).status,200);
  assert.equal((await rpc(ctx,b.token,{jsonrpc:'2.0',id:1,method:'ping'})).status,401);
  assert.equal((await rpc(ctx,a.token,{jsonrpc:'2.0',id:1,method:'ping'})).status,200);
  assert.equal((await boybek.post('/api/connectors/revoke',{id:mine[0].id})).status,200);
  assert.equal((await rpc(ctx,a.token,{jsonrpc:'2.0',id:1,method:'ping'})).status,401);
}));
