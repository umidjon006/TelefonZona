// Writing through a connector is always two steps:
//   1. prepare_*  : checks the request, tries it on a COPY of the records with the shop's own
//                   accounting code and returns the exact effects (stock, cash, debts, profit).
//   2. commit_change : only after the person has seen that preview and agreed, applies the very same
//                   steps for real, all together or not at all, and only if the effects are still identical.
// Claude never calculates money: it gives intent (which product, how many, what price) and the server does the maths.
import {randomBytes} from 'node:crypto';
import {catalog} from '../src/admin.js';
import {AUDIENCES,accountBalances} from '../src/business.js';
import {stock,CASH_ACCOUNT} from '../src/model.js';
import {people} from '../src/access.js';
import {findPlainTwin,caseGroupMatches} from '../src/inventory-entry.js';
import {normalizeSearch} from '../src/catalog.js';
import {runCommand,CommandError} from '../src/commands.js';
import {computeEffects,digestOf,describe,publicEffects,som,group} from './effects.js';
import {ToolError,exactInt,exactText,exactEnum,adminOnly,context,rejectUnknown} from './mcp-shared.js';
import {buildManageTools} from './mcp-manage.js';

const TTL_MS=15*60*1000,HOURLY_LIMIT=60,PAYMENTS=['Naqd','Karta','O‘tkazma'];
const EXPENSE_CATEGORIES=['Boshqa','Transport','Elektr','Internet','Soliq','Maosh','Ta’mirlash'];
// Applied-change counts per person, kept separately for each running server.
const commitLog=new WeakMap();

class Stale extends Error{}
const userFacing=error=>error&&(error.constructor===Error||error instanceof CommandError||error instanceof ToolError);

function findSku(ctx,sku,at){
  const code=exactText(sku,`${at}sku`,{max:30}).toLowerCase();
  const product=ctx.state.products.find(p=>p.sku.toLowerCase()===code);
  if(!product)throw new ToolError(`${at}sku "${sku}" topilmadi. Avval search_products bilan aniq SKU ni toping.`);
  if(product.archivedAt)throw new ToolError(`${at}${product.sku} katalogdan olib tashlangan.`);
  return product;
}
const avgCost=p=>{const units=stock(p);return units&&p.lots.every(l=>Number.isFinite(l.cost))?Math.round(p.lots.reduce((s,l)=>s+l.qty*l.cost,0)/units):null;};
const priceRange=(raw,at,{required=false}={})=>{
  if(raw.price_min===undefined&&raw.price_max===undefined){
    if(required)throw new ToolError(`${at}: price_min va price_max kerak (eng kam va eng yuqori sotish narxi).`);
    return null;
  }
  const min=exactInt(raw.price_min,`${at}.price_min`,{min:0,max:1e9}),max=exactInt(raw.price_max,`${at}.price_max`,{min:1,max:1e9});
  if(min>max)throw new ToolError(`${at}: price_min price_max dan oshmasin.`);
  return {min,max};
};
const object=(value,label)=>{if(!value||typeof value!=='object'||Array.isArray(value))throw new ToolError(`${label} obyekt bo‘lishi kerak.`);return value;};

// ---------- the planners: intent in, exact list of commands out ----------
function newProductSpec(ctx,np,at,config){
  object(np,`${at}.new_product`);
  const type=exactEnum(np.type,`${at}.new_product.type`,['case','other']);
  const brand=exactEnum(np.brand,`${at}.new_product.brand`,config.brands.map(b=>b.id));
  const owner=np.owner===undefined?ctx.actor:ctx.personId(np.owner);
  if(!owner)throw new ToolError(`${at}.new_product.owner: egasi topilmadi (aziz/Otabek, sardor/Boybek, jasur/Asilbek).`);
  if(type==='case'){
    const model=exactText(np.phone_model,`${at}.new_product.phone_model`,{max:60});
    const audience=exactEnum(np.audience,`${at}.new_product.audience`,AUDIENCES.map(([id])=>id));
    const material=exactEnum(np.material,`${at}.new_product.material`,config.materials);
    const quality=exactEnum(np.quality,`${at}.new_product.quality`,config.qualities.map(q=>q.id));
    const found=caseGroupMatches(ctx.state,ctx.state.products,{brand,model,quality,owner,audience,material});
    if(found.length>1)throw new ToolError(`${at}: bu g‘ilof guruhida takrorlangan yozuv bor. Avval ularni platformada tekshiring.`);
    return {product:found[0]||null,create:{type,brand,model,audience,material,quality,owner}};
  }
  const name=exactText(np.name,`${at}.new_product.name`,{max:60}),variant=exactText(np.variant,`${at}.new_product.variant`,{max:90});
  const category=exactEnum(np.category,`${at}.new_product.category`,config.categories);
  const quality=np.quality===undefined?'':exactEnum(np.quality,`${at}.new_product.quality`,config.qualities.map(q=>q.id));
  return {product:findPlainTwin(ctx.state.products,{brand,category,owner,name,variant}),create:{type,brand,name,variant,category,quality,owner}};
}

function planStockReceipt(ctx,args){
  if(!Array.isArray(args.items)||!args.items.length||args.items.length>100)throw new ToolError('items: 1 tadan 100 tagacha qator bo‘lsin.');
  const note=exactText(args.note,'note',{optional:true,max:300})||'Yangi kirim (Claude orqali)';
  const config=catalog(ctx.state),commands=[],warnings=[],seenNew=new Set();
  args.items.forEach((raw,index)=>{
    const at=`items[${index}]`;
    object(raw,at);
    const qty=exactInt(raw.qty,`${at}.qty`,{min:1,max:100000}),cost=exactInt(raw.unit_cost,`${at}.unit_cost`,{min:1,max:1e9});
    const prices=priceRange(raw,at),limit=exactInt(raw.low_stock_limit,`${at}.low_stock_limit`,{min:0,max:100000,optional:true});
    if((raw.sku===undefined)===(raw.new_product===undefined))throw new ToolError(`${at}: sku (mavjud mahsulot) yoki new_product (yangi mahsulot) dan faqat bittasini bering.`);
    let product=null,create=null;
    if(raw.sku!==undefined)product=findSku(ctx,raw.sku,`${at}.`);
    else{
      ({product,create}=newProductSpec(ctx,raw.new_product,at,config));
      if(!product){
        const key=normalizeSearch(JSON.stringify(create));
        if(seenNew.has(key))throw new ToolError(`${at}: bir xil yangi mahsulot ro‘yxatda ikki marta. Sonlarini qo‘shib bitta qator qiling.`);
        seenNew.add(key);
      }
    }
    if(product){
      commands.push({command:'stock.purchase',args:{id:product.id,qty,cost,note}});
      if(prices&&(prices.min!==(product.minPrice??product.price)||prices.max!==product.price))commands.push({command:'product.price',args:{id:product.id,price:prices.max,minPrice:prices.min}});
      if(limit!==undefined)commands.push({command:'product.limit',args:{id:product.id,min:limit}});
      const average=avgCost(product);
      if(average&&(cost>average*1.5||cost<average*0.5))warnings.push(`${at}: tannarx ${som(cost)} avvalgi o‘rtacha tannarx ${som(average)} dan juda farq qiladi. Raqamni tekshiring.`);
    }else{
      if(!prices)throw new ToolError(`${at}: yangi mahsulot uchun price_min va price_max kerak.`);
      if(create.type==='case')commands.push({command:'product.groups',args:{data:{brand:create.brand,model:create.model,audience:create.audience,material:create.material,owner:create.owner,min:limit??5,rows:[{quality:create.quality,qty,cost,price:prices.max,minPrice:prices.min}]}}});
      else commands.push({command:'product.register',args:{data:{name:create.name,variant:create.variant,brand:create.brand,category:create.category,quality:create.quality,owner:create.owner,qty,cost,price:prices.max,minPrice:prices.min,min:limit??5,note}}});
    }
    if(prices&&prices.max<cost)warnings.push(`${at}: yuqori sotish narxi tannarxdan past: zarar bilan sotiladi.`);
    else if(prices&&prices.min<cost)warnings.push(`${at}: eng kam sotish narxi tannarxdan past.`);
    if(qty>5000)warnings.push(`${at}: ${group(qty)} dona juda ko‘p. Sonini tekshiring.`);
  });
  return {commands,warnings};
}

function planSale(ctx,args){
  if(!Array.isArray(args.items)||!args.items.length||args.items.length>50)throw new ToolError('items: 1 tadan 50 tagacha qator bo‘lsin.');
  const payment=args.payment===undefined?'Naqd':exactEnum(args.payment,'payment',PAYMENTS);
  const seen=new Set(),warnings=[],cart=args.items.map((raw,index)=>{
    const at=`items[${index}]`;object(raw,at);
    const product=findSku(ctx,raw.sku,`${at}.`);
    if(seen.has(product.id))throw new ToolError(`${at}: ${product.sku} ikki marta. Sonlarini qo‘shib bitta qator qiling.`);
    seen.add(product.id);
    const qty=exactInt(raw.qty,`${at}.qty`,{min:1,max:100000}),price=exactInt(raw.unit_price,`${at}.unit_price`,{min:0,max:1e9});
    if(qty>stock(product))throw new ToolError(`${at}: ${product.sku} omborda ${stock(product)} dona bor, ${qty} dona sotib bo‘lmaydi.`);
    if(price<(product.minPrice??product.price)||price>product.price)warnings.push(`${at}: narx ${som(price)} katalog oralig‘i ${group(product.minPrice??product.price)}–${group(product.price)} so‘mdan tashqarida (sabab izohda bo‘lishi kerak).`);
    return {productId:product.id,qty,price};
  });
  const total=cart.reduce((sum,row)=>sum+row.qty*row.price,0);
  const received=exactInt(args.paid_now,'paid_now',{min:0,max:1e12,optional:true})??total;
  const data={payment};
  for(const key of ['customer','phone','due','note'])if(args[key]!==undefined&&args[key]!=='')data[key]=exactText(args[key],key,{max:key==='note'?500:80});
  return {commands:[{command:'sale.record',args:{cart,received,data}}],warnings};
}

function planDebtPayment(ctx,args){
  const id=exactText(args.debt_id,'debt_id',{max:100});
  const debt=ctx.state.debts.find(d=>d.id===id&&!d.cancelledAt);
  if(!debt)throw new ToolError('Qarz topilmadi. list_debts dagi debt_id ni aynan ko‘chiring.');
  const amount=exactInt(args.amount,'amount',{min:1,max:1e12});
  if(amount>debt.balance)throw new ToolError(`To‘lov qarz qoldig‘i ${som(debt.balance)} dan oshmasin.`);
  return {commands:[{command:'debt.repay',args:{id,amount,note:exactText(args.note,'note',{max:300})}}],warnings:[]};
}
function planCashEntry(ctx,args){
  const kind=exactEnum(args.kind,'kind',['expense','income','contribution','withdrawal']);
  const amount=exactInt(args.amount,'amount',{min:1,max:1e12}),note=exactText(args.note,'note',{max:300});
  const paidFrom=args.paid_from===undefined?'cash':exactEnum(args.paid_from,'paid_from',['cash','own_pocket']);
  if(paidFrom==='own_pocket'&&kind!=='expense')throw new ToolError('paid_from=own_pocket faqat xarajat (expense) uchun.');
  const data={kind,amount,account:paidFrom==='own_pocket'?'personal':CASH_ACCOUNT,note};
  if(kind==='expense')data.category=args.category===undefined?'Boshqa':exactEnum(args.category,'category',EXPENSE_CATEGORIES);
  else if(args.category!==undefined)throw new ToolError('category faqat xarajat uchun.');
  return {commands:[{command:'flow.record',args:{data}}],warnings:[]};
}
function planService(ctx,args){
  const worker=args.worker===undefined?ctx.actor:ctx.personId(args.worker);
  if(!worker)throw new ToolError('worker topilmadi.');
  return {commands:[{command:'service.save',args:{data:{title:exactText(args.title,'title',{max:100}),worker,profit:exactInt(args.profit,'profit',{min:0,max:1e10}),note:exactText(args.note,'note',{max:300})}}}],warnings:[]};
}
function planPrice(ctx,args){
  const product=findSku(ctx,args.sku,''),range=priceRange(args,'narx',{required:true});
  return {commands:[{command:'product.price',args:{id:product.id,price:range.max,minPrice:range.min}}],warnings:[]};
}
function planReturn(ctx,args){
  const id=exactText(args.receipt,'receipt',{max:40}).toUpperCase().replace(/^#/,'');
  if(!ctx.state.sales.some(s=>s.id===id))throw new ToolError('Bu raqamdagi chek topilmadi.');
  return {commands:[{command:'sale.return',args:{id,note:exactText(args.reason,'reason',{max:300})}}],warnings:['Chek TO‘LIQ qaytariladi: mahsulotlar omborga qaytadi, olingan pul kassadan chiqadi, qolgan qarz yopiladi.']};
}
function planDispose(ctx,args){
  const product=findSku(ctx,args.sku,'');
  return {commands:[{command:'stock.dispose',args:{id:product.id,qty:exactInt(args.qty,'qty',{min:1,max:100000}),note:exactText(args.reason,'reason',{max:300})}}],warnings:['Yaroqsiz tovar qaytarilmaydigan zarar sifatida hisobdan chiqariladi.']};
}
function planRent(ctx,args){
  adminOnly(ctx);
  const month=exactText(args.month,'month',{max:7});
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw new ToolError('month YYYY-MM ko‘rinishida bo‘lsin, masalan 2026-12.');
  return {commands:[{command:'rent.set',args:{month,amount:exactInt(args.amount,'amount',{min:1,max:1e10}),note:exactText(args.note,'note',{max:300})}}],warnings:[]};
}
function planRentPayment(ctx,args){
  const month=exactText(args.month,'month',{max:7});
  const rent=ctx.state.rents.find(r=>r.month===month&&!r.cancelledAt);
  if(!rent)throw new ToolError(`${month} oyi uchun ijara belgilanmagan.`);
  const amount=exactInt(args.amount,'amount',{min:1,max:1e10});
  if(amount>rent.amount-rent.paid)throw new ToolError(`To‘lov ijara qoldig‘i ${som(rent.amount-rent.paid)} dan oshmasin.`);
  const paidFrom=args.paid_from===undefined?'cash':exactEnum(args.paid_from,'paid_from',['cash','own_pocket']);
  return {commands:[{command:'rent.pay',args:{id:rent.id,amount,account:paidFrom==='cash'?CASH_ACCOUNT:'personal',note:exactText(args.note,'note',{max:300})}}],warnings:[]};
}
function planDayClose(ctx,args){
  adminOnly(ctx);
  const counted=exactInt(args.counted_cash,'counted_cash',{min:0,max:1e12}),left=exactInt(args.left_for_tomorrow,'left_for_tomorrow',{min:0,max:1e12});
  if(left>counted)throw new ToolError('Ertangi qaytim sanalgan puldan oshmasin.');
  if(typeof args.handover!=='boolean')throw new ToolError('handover true yoki false bo‘lsin (pul boshliqqa topshirildimi).');
  const expected=accountBalances(structuredClone(ctx.state))[CASH_ACCOUNT];
  const warnings=counted!==expected?[`Sanalgan pul hisobdagi ${som(expected)} dan ${som(Math.abs(counted-expected))} ${counted>expected?'ko‘p':'kam'}. Farq alohida saqlanadi, daromad yoki xarajat deb yashirilmaydi.`]:[];
  return {commands:[{command:'closing.close',args:{data:{actual:counted,float:left,handover:args.handover,note:exactText(args.note,'note',{max:300})}}}],warnings};
}
function planLimit(ctx,args){
  const product=findSku(ctx,args.sku,'');
  return {commands:[{command:'product.limit',args:{id:product.id,min:exactInt(args.limit,'limit',{min:0,max:100000})}}],warnings:[]};
}
function planTask(ctx,args){
  adminOnly(ctx);
  const worker=ctx.personId(args.worker);
  if(!worker)throw new ToolError('worker topilmadi.');
  if(!Array.isArray(args.lines)||!args.lines.length||args.lines.length>50)throw new ToolError('lines: 1 tadan 50 tagacha qator bo‘lsin.');
  const lines=args.lines.map((raw,index)=>{
    const at=`lines[${index}]`;object(raw,at);
    const line={label:exactText(raw.what,`${at}.what`,{max:120}),qty:exactInt(raw.qty,`${at}.qty`,{min:1,max:100000})};
    if(raw.sku!==undefined)line.productId=findSku(ctx,raw.sku,`${at}.`).id;
    return line;
  });
  return {commands:[{command:'intake.create',args:{data:{worker,note:exactText(args.note,'note',{optional:true,max:300}),lines}}}],warnings:[]};
}

// ---------- tool definitions ----------
const INT='integer',NOTE={type:'string',maxLength:300};
const money=(description,min=1)=>({type:INT,minimum:min,maximum:1e12,description:`${description} Whole number in UZS, digits only (20000, never "20 000" or "20.000").`});
const SKU={type:'string',description:'Exact SKU from search_products, e.g. TZ-1003'};
const obj=(required,properties)=>({type:'object',required,additionalProperties:false,properties});
const WRITE_TOOLS=[
  {name:'prepare_stock_receipt',title:'Prepare: enter new goods into stock',plan:planStockReceipt,
   description:'Prepare entering received goods. Each item is either an existing product (sku) or a new product (new_product). The server finds existing groups itself so nothing is duplicated, computes stock and cash, and returns a preview. Nothing is saved until commit_change.',
   schema:state=>{
     const config=catalog(state);
     return obj(['items'],{
       note:{...NOTE,description:'Optional receipt note'},
       items:{type:'array',minItems:1,maxItems:100,items:obj(['qty','unit_cost'],{
         sku:{...SKU,description:'Existing product. Give this OR new_product.'},
         new_product:{...obj(['type','brand'],{
           type:{type:'string',enum:['case','other']},brand:{type:'string',enum:config.brands.map(b=>b.id),description:'Brand id'},
           owner:{type:'string',enum:people(state).map(p=>p.id),description:'Product owner id; default = the signed-in person'},
           phone_model:{type:'string',maxLength:60},audience:{type:'string',enum:AUDIENCES.map(([id])=>id)},material:{type:'string',enum:config.materials},quality:{type:'string',enum:config.qualities.map(q=>q.id)},
           name:{type:'string',maxLength:60},variant:{type:'string',maxLength:90},category:{type:'string',enum:config.categories},
         }),description:'New product. type "case" = phone case group (needs phone_model, audience, material, quality); type "other" = any other accessory (needs name, variant, category).'},
         qty:{type:INT,minimum:1,maximum:100000,description:'Units received'},
         unit_cost:money('Cost price of ONE unit.'),
         price_min:money('Lowest selling price per unit. Required for a new product. For an EXISTING product give prices only if its catalog price must change (needs the prices permission).',0),price_max:money('Highest (list) selling price per unit.'),
         low_stock_limit:{type:INT,minimum:0,maximum:100000,description:'Low-stock reminder level (optional)'},
       })},
     });
   }},
  {name:'prepare_sale',title:'Prepare: record a sale',plan:planSale,
   description:'Prepare a sale. Stock, FIFO cost, totals, cash and any debt are computed by the server. For a partial payment give paid_now plus customer, phone and due date.',
   schema:()=>obj(['items'],{
     items:{type:'array',minItems:1,maxItems:50,items:obj(['sku','qty','unit_price'],{sku:SKU,qty:{type:INT,minimum:1,maximum:100000},unit_price:money('Agreed price of ONE unit.',0)})},
     payment:{type:'string',enum:PAYMENTS},paid_now:money('Money received now. Default = full total.',0),
     customer:{type:'string',maxLength:80},phone:{type:'string',maxLength:80},due:{type:'string',description:'Debt due date YYYY-MM-DD'},note:{type:'string',maxLength:500,description:'Required for credit or out-of-range prices'},
   })},
  {name:'prepare_debt_payment',title:'Prepare: receive a debt payment',plan:planDebtPayment,
   description:'Prepare a customer paying back part or all of a debt. Use debt_id from list_debts.',
   schema:()=>obj(['debt_id','amount','note'],{debt_id:{type:'string'},amount:money('Amount received now.'),note:NOTE})},
  {name:'prepare_cash_entry',title:'Prepare: cash in or out',plan:planCashEntry,
   description:'Prepare a cash movement with a reason: expense, extra income, adding own money to the box, or handing money to the boss.',
   schema:()=>obj(['kind','amount','note'],{
     kind:{type:'string',enum:['expense','income','contribution','withdrawal']},amount:money('Amount.'),category:{type:'string',enum:EXPENSE_CATEGORIES,description:'Expenses only'},
     paid_from:{type:'string',enum:['cash','own_pocket'],description:'Expenses only: own_pocket = paid from the person’s own money (the shop then owes them)'},note:{...NOTE,description:'Why (required)'}})},
  {name:'prepare_service_profit',title:'Prepare: record extra-service profit',plan:planService,
   description:'Prepare an extra service (phone repair etc.) with its already-calculated NET profit. No cash is recorded.',
   schema:()=>obj(['title','profit','note'],{title:{type:'string',maxLength:100},profit:money('Net profit.',0),worker:{type:'string',description:'Person id or name; default = signed-in person'},note:NOTE})},
  {name:'prepare_price_change',title:'Prepare: change a price range',plan:planPrice,
   description:'Prepare a new selling price range for one product. Old receipts do not change.',
   schema:()=>obj(['sku','price_min','price_max'],{sku:SKU,price_min:money('Lowest price.',0),price_max:money('Highest price.')})},
  {name:'prepare_sale_return',title:'Prepare: return a whole receipt',plan:planReturn,
   description:'Prepare a full return of one receipt (goods back to stock, money refunded, debt closed).',
   schema:()=>obj(['receipt','reason'],{receipt:{type:'string',description:'Receipt number, e.g. S-1004'},reason:NOTE})},
  {name:'prepare_dispose_stock',title:'Prepare: write off defective goods',plan:planDispose,
   description:'Prepare writing off unusable goods at their FIFO cost as a loss.',
   schema:()=>obj(['sku','qty','reason'],{sku:SKU,qty:{type:INT,minimum:1,maximum:100000},reason:NOTE})},
  {name:'prepare_rent',title:'Prepare: set the month’s rent (boss)',plan:planRent,
   description:'Boss only. Prepare the agreed rent for a month.',
   schema:()=>obj(['month','amount','note'],{month:{type:'string',description:'YYYY-MM'},amount:money('Agreed monthly rent.'),note:NOTE})},
  {name:'prepare_rent_payment',title:'Prepare: pay rent',plan:planRentPayment,
   description:'Prepare a rent payment for a month that already has agreed rent.',
   schema:()=>obj(['month','amount','note'],{month:{type:'string',description:'YYYY-MM'},amount:money('Amount paid now.'),paid_from:{type:'string',enum:['cash','own_pocket']},note:NOTE})},
  {name:'prepare_day_close',title:'Prepare: close the day (boss)',plan:planDayClose,
   description:'Boss only. Prepare the end-of-day cash count. The difference to the books is saved openly, never hidden.',
   schema:()=>obj(['counted_cash','left_for_tomorrow','handover','note'],{counted_cash:money('Cash actually counted.',0),left_for_tomorrow:money('Cash left in the box for tomorrow.',0),handover:{type:'boolean',description:'true if the rest was handed to the boss now'},note:NOTE})},
  {name:'prepare_low_stock_limit',title:'Prepare: low-stock reminder level',plan:planLimit,
   description:'Prepare a new low-stock reminder level for a product.',
   schema:()=>obj(['sku','limit'],{sku:SKU,limit:{type:INT,minimum:0,maximum:100000}})},
  {name:'prepare_receipt_task',title:'Prepare: hand goods to a worker (boss)',plan:planTask,
   description:'Boss only. Prepare a receipt task: incoming goods the worker must enter. Nobody else can enter goods already handed to a worker.',
   schema:()=>obj(['worker','lines'],{worker:{type:'string',description:'Person id or name'},note:NOTE,lines:{type:'array',minItems:1,maxItems:50,items:obj(['what','qty'],{what:{type:'string',maxLength:120},qty:{type:INT,minimum:1,maximum:100000},sku:SKU})}})},
];
// Corrections and administration live in their own file and get the same helpers.
const ALL_TOOLS=[...WRITE_TOOLS,...buildManageTools({findSku,object,priceRange,newProductSpec,money,obj,NOTE,SKU,INT,PAYMENTS})];
const COMMIT_TOOL={
  name:'commit_change',title:'Apply a prepared change',
  description:'Apply a change returned by a prepare_* tool. Call it ONLY after you showed the preview to the user and they clearly agreed in this conversation. Never on your own. The change is applied all together or not at all, and only if its effects are still exactly what was previewed.',
  inputSchema:obj(['proposal_id','user_confirmed'],{proposal_id:{type:'string'},user_confirmed:{type:'boolean',description:'true only if the user explicitly agreed to the previewed change'}}),
};

export const WRITE_TOOL_NAMES=[...ALL_TOOLS.map(t=>t.name),COMMIT_TOOL.name];
export const isWriteTool=name=>WRITE_TOOL_NAMES.includes(name);
export function writeListing(state){
  const annotation=(title,extra)=>({title,readOnlyHint:false,openWorldHint:false,...extra});
  return [
    ...ALL_TOOLS.map(t=>({name:t.name,title:t.title,description:t.description,inputSchema:t.schema(state),annotations:annotation(t.title,{destructiveHint:false,idempotentHint:false})})),
    {name:COMMIT_TOOL.name,title:COMMIT_TOOL.title,description:COMMIT_TOOL.description,inputSchema:COMMIT_TOOL.inputSchema,annotations:annotation(COMMIT_TOOL.title,{destructiveHint:true,idempotentHint:true})},
  ];
}

const random=bytes=>randomBytes(bytes).toString('base64url');

function prepare(store,ctx,tool,args){
  rejectUnknown(tool.schema(ctx.state),args);
  const {commands,warnings}=tool.plan(ctx,args);
  const draft=structuredClone(ctx.state);
  try{
    for(const step of commands)runCommand(draft,step.command,step.args,ctx.actor);
    store.check(draft);
  }catch(error){
    if(userFacing(error))throw new ToolError(`Bajarib bo‘lmaydi: ${error.message}`);
    throw error;
  }
  const effects=computeEffects(ctx.state,draft,{admin:ctx.admin});
  const digest=digestOf(effects),id='chg_'+random(12),now=Date.now();
  store.db.prepare('DELETE FROM mcp_proposals WHERE created_at<?').run(now-30*24*3600*1000);
  // At most fifty open previews per person: a loop of prepares cannot pile up.
  store.db.prepare("DELETE FROM mcp_proposals WHERE actor=? AND status='pending' AND id NOT IN (SELECT id FROM mcp_proposals WHERE actor=? AND status='pending' ORDER BY created_at DESC LIMIT 49)").run(ctx.actor,ctx.actor);
  store.db.prepare('INSERT INTO mcp_proposals(id,actor,action,plan,digest,preview,status,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?)')
    .run(id,ctx.actor,tool.name,JSON.stringify(commands),digest,JSON.stringify({effects:publicEffects(effects,ctx.admin),warnings}),'pending',now,now+TTL_MS);
  return {
    proposal_id:id,status:'preview_only_nothing_saved',expires_in_minutes:TTL_MS/60000,
    summary:describe(effects,ctx.nameOf,ctx.admin),warnings,effects:publicEffects(effects,ctx.admin),
    next_step:'Show this preview to the user in plain words (every product, quantity, price and the cash effect). If they clearly agree, call commit_change with this proposal_id and user_confirmed=true. If anything is wrong, do not commit: prepare a corrected change instead.',
  };
}

function commit(store,ctx,args){
  rejectUnknown(COMMIT_TOOL.inputSchema,args);
  const id=exactText(args.proposal_id,'proposal_id',{max:60});
  if(args.user_confirmed!==true)throw new ToolError('commit_change foydalanuvchi aniq rozilik bergandan keyingina chaqiriladi: user_confirmed=true bering. Avval ko‘rsatilgan natijani foydalanuvchiga ko‘rsating.');
  const row=store.db.prepare('SELECT * FROM mcp_proposals WHERE id=?').get(id);
  if(!row||row.actor!==ctx.actor)throw new ToolError('Taklif topilmadi. Avval prepare_* vositasini chaqiring.');
  const now=Date.now();
  if(row.status==='pending'&&row.expires_at<now){store.db.prepare("UPDATE mcp_proposals SET status='expired' WHERE id=?").run(id);throw new ToolError('Taklifning muddati tugagan (15 daqiqa). Qaytadan tayyorlang.');}
  if(row.status==='stale')throw new ToolError('Hisob taklifdan keyin o‘zgargan edi. Qaytadan tayyorlang.');
  if(row.status==='expired')throw new ToolError('Taklifning muddati tugagan. Qaytadan tayyorlang.');
  if(row.status==='pending'){
    const commits=commitLog.get(store)||commitLog.set(store,new Map()).get(store);
    const recent=(commits.get(ctx.actor)||[]).filter(t=>t>now-3600000);
    if(recent.length>=HOURLY_LIMIT)throw new ToolError(`Soatiga ${HOURLY_LIMIT} tadan ko‘p o‘zgartirish mumkin emas.`);
    commits.set(ctx.actor,[...recent,now]);
  }
  const plan=JSON.parse(row.plan);
  try{
    const outcome=store.transact({actor:ctx.actor,command:'mcp.commit',opId:'mcp-'+id,source:'claude'},state=>{
      const before=structuredClone(state);
      for(const step of plan)runCommand(state,step.command,step.args,ctx.actor);
      const effects=computeEffects(before,state,{admin:ctx.admin});
      // The records may have changed since the preview. Apply only if the outcome is exactly what the person saw.
      if(digestOf(effects)!==row.digest)throw new Stale();
      store.db.prepare("UPDATE mcp_proposals SET status='committed',committed_at=? WHERE id=?").run(now,id);
      return {
        committed:true,proposal_id:id,summary:describe(effects,ctx.nameOf,ctx.admin),effects:publicEffects(effects,ctx.admin),
        ...(ctx.admin?{cash_in_register_after:accountBalances(structuredClone(state))[CASH_ACCOUNT]}:{}),
      };
    });
    return {...outcome.result,...(outcome.replayed?{note:'Bu o‘zgartirish avval yozilgan edi; qayta yozilmadi.'}:{})};
  }catch(error){
    if(error instanceof Stale){
      store.db.prepare("UPDATE mcp_proposals SET status='stale' WHERE id=?").run(id);
      throw new ToolError('Yozilmadi: hisob taklifdan keyin o‘zgargan va natija ko‘rsatilganidan farq qiladi (masalan, qoldiq yoki qarz o‘zgargan). Hech narsa saqlanmadi. Qaytadan tayyorlab, yangi natijani foydalanuvchiga ko‘rsating.');
    }
    if(userFacing(error))throw new ToolError(`Yozilmadi: ${error.message} Hech narsa saqlanmadi.`);
    throw error;
  }
}

export function runWriteTool(store,actor,name,args){
  const ctx=context(store,actor);
  if(name===COMMIT_TOOL.name)return commit(store,ctx,args);
  return prepare(store,ctx,ALL_TOOLS.find(t=>t.name===name),args);
}
