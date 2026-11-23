// Corrections and administration for the connector. Same rules as every other write tool:
// strict input, a preview computed by the shop's own code, and nothing saved until confirmed.
// Passwords, sessions and connector access are deliberately NOT here: secrets must not pass through a chat.
import {catalog} from '../src/admin.js';
import {PERMISSIONS,people,isAdmin} from '../src/access.js';
import {AUDIENCES,localDate} from '../src/business.js';
import {saleTotal,stockLimit,CASH_ACCOUNT} from '../src/model.js';
import {ToolError,exactInt,exactText,exactEnum,adminOnly} from './mcp-shared.js';
import {som} from './effects.js';

export function buildManageTools(h){
  const {findSku,object,priceRange,newProductSpec,money,obj,NOTE,SKU,INT,PAYMENTS}=h;
  const ID={type:'string',description:'Exact id from the matching list_* / get_* tool'};
  const REASON={...NOTE,description:'Why (required, kept in the history)'};
  const need=(list,id,what,test=()=>true)=>{
    const key=exactText(id,what,{max:120});
    const found=list.find(x=>(x.id===key)&&test(x));
    if(!found)throw new ToolError(`${what} topilmadi yoki endi o‘zgartirib bo‘lmaydi. Ro‘yxat vositasidagi aniq qiymatni ko‘chiring.`);
    return found;
  };
  const sku=(ctx,value,any=false)=>{
    if(!any)return findSku(ctx,value,'');
    const code=exactText(value,'sku',{max:30}).toLowerCase();
    const p=ctx.state.products.find(x=>x.sku.toLowerCase()===code);
    if(!p)throw new ToolError(`sku "${value}" topilmadi.`);
    return p;
  };
  const receipt=value=>exactText(value,'receipt',{max:40}).toUpperCase().replace(/^#/,'');
  const personOf=(ctx,value,label)=>{const id=ctx.personId(value);if(!id)throw new ToolError(`${label}: shaxs topilmadi (aziz/Otabek, sardor/Boybek, jasur/Asilbek).`);return id;};
  const plan=(command,args,warnings=[])=>({commands:[{command,args}],warnings});

  return [
    {name:'prepare_sale_correction',title:'Prepare: correct a receipt',
     description:'Correct a receipt. The old receipt is returned and a new, correct one is written (history keeps both). Give the COMPLETE corrected line list; a line with qty 0 is removed. Money already collected is carried over automatically unless paid_total is given.',
     schema:()=>obj(['receipt','items','reason'],{receipt:{type:'string'},items:{type:'array',minItems:1,maxItems:50,items:obj(['sku','qty','unit_price'],{sku:SKU,qty:{type:INT,minimum:0,maximum:100000,description:'0 removes the line'},unit_price:money('Agreed price of ONE unit.',0)})},
       payment:{type:'string',enum:PAYMENTS},seller:{type:'string',description:'Boss only: person id or name'},paid_total:money('Total the customer has paid for this receipt so far. Default = what was collected already.',0),customer:{type:'string',maxLength:80},phone:{type:'string',maxLength:80},due:{type:'string',description:'YYYY-MM-DD, only if a debt remains'},reason:REASON}),
     plan(ctx,args){
       const id=receipt(args.receipt),sale=ctx.state.sales.find(s=>s.id===id);
       if(!sale||sale.returned)throw new ToolError('Faol chek topilmadi.');
       if(!Array.isArray(args.items)||!args.items.length||args.items.length>50)throw new ToolError('items: 1 tadan 50 tagacha qator bo‘lsin.');
       const seen=new Set(),items=[];
       args.items.forEach((raw,index)=>{
         const at=`items[${index}]`;object(raw,at);
         const product=sku(ctx,raw.sku,true);
         if(seen.has(product.id))throw new ToolError(`${at}: ${product.sku} ikki marta.`);
         seen.add(product.id);
         const qty=exactInt(raw.qty,`${at}.qty`,{min:0,max:100000}),price=exactInt(raw.unit_price,`${at}.unit_price`,{min:0,max:1e9});
         if(qty>0)items.push({productId:product.id,qty,price});
       });
       if(!items.length)throw new ToolError('Hamma qator olib tashlansa, chek qaytariladi: prepare_sale_return dan foydalaning.');
       const debt=ctx.state.debts.find(d=>d.saleId===id);
       const collected=(sale.received??saleTotal(sale))+(debt?debt.payments.filter(p=>!p.voidedBy).reduce((s,p)=>s+p.amount,0):0);
       const data={items,received:exactInt(args.paid_total,'paid_total',{min:0,max:1e12,optional:true})??collected,payment:args.payment===undefined?sale.payment:exactEnum(args.payment,'payment',PAYMENTS),note:exactText(args.reason,'reason',{max:300})};
       if(args.seller!==undefined){adminOnly(ctx);data.seller=personOf(ctx,args.seller,'seller');}
       const today=localDate(),customer=args.customer??debt?.customer,phone=args.phone??debt?.phone,due=args.due??(debt?.due&&debt.due>today?debt.due:today);
       if(customer!==undefined)data.customer=exactText(customer,'customer',{max:80});
       if(phone!==undefined)data.phone=exactText(phone,'phone',{max:80});
       data.due=exactText(due,'due',{max:10});
       return plan('sale.correct',{id,data},[`Chek ${id} qaytariladi va yangi (to‘g‘ri) chek yoziladi; yangi raqam bilan.`]);
     }},
    {name:'prepare_cash_correction',title:'Prepare: correct a cash entry',
     description:'Correct a cash entry (amount, source, category, note). The old entry is cancelled and a correct one is written today; history keeps both. Debt and rent payments are re-applied to their debt or rent.',
     schema:()=>obj(['movement_id','amount','note'],{movement_id:ID,amount:money('Correct amount.'),paid_from:{type:'string',enum:['cash','own_pocket'],description:'Expenses and rent payments only'},category:{type:'string',description:'Expenses only'},note:{...NOTE,description:'Correct note and why it is corrected (required)'}}),
     plan(ctx,args){
       const m=need(ctx.state.movements,args.movement_id,'movement_id',x=>!x.voidedBy);
       const data={amount:exactInt(args.amount,'amount',{min:1,max:1e12}),note:exactText(args.note,'note',{max:300}),account:m.account};
       if(args.paid_from!==undefined){if(!['expense','rent-payment'].includes(m.kind))throw new ToolError('paid_from faqat xarajat va ijara to‘lovi uchun.');data.account=exactEnum(args.paid_from,'paid_from',['cash','own_pocket'])==='cash'?CASH_ACCOUNT:'personal';}
       if(args.category!==undefined){if(m.kind!=='expense')throw new ToolError('category faqat xarajat uchun.');data.category=exactText(args.category,'category',{max:60});}
       return plan('movement.correct',{id:m.id,data});
     }},
    {name:'prepare_cash_reversal',title:'Prepare: cancel a cash entry',
     description:'Cancel a wrong cash entry. It stays in the history; the effect on cash, debt or rent is reversed today.',
     schema:()=>obj(['movement_id','reason'],{movement_id:ID,reason:REASON}),
     plan(ctx,args){const m=need(ctx.state.movements,args.movement_id,'movement_id',x=>!x.voidedBy);return plan('movement.reverse',{id:m.id,note:exactText(args.reason,'reason',{max:300})});}},
    {name:'prepare_debt_edit',title:'Prepare: edit a debtor’s details',
     description:'Change a debtor’s name, phone, due date or note. The amount can be changed only for opening debts (boss) and never below what was already repaid.',
     schema:()=>obj(['debt_id'],{debt_id:{type:'string',description:'debt_id from list_debts'},customer:{type:'string',maxLength:80},phone:{type:'string',maxLength:80},due:{type:'string',description:'YYYY-MM-DD'},note:NOTE,amount:money('New original amount (opening debts only).')}),
     plan(ctx,args){
       const d=need(ctx.state.debts,args.debt_id,'debt_id',x=>!x.cancelledAt);
       const data={customer:exactText(args.customer??d.customer,'customer',{max:80}),phone:exactText(args.phone??d.phone,'phone',{max:22}),due:exactText(args.due??d.due,'due',{max:10}),note:exactText(args.note??d.note,'note',{max:300})};
       if(args.amount!==undefined){if(!d.opening)throw new ToolError('Summani faqat avvaldan qolgan qarz uchun o‘zgartirish mumkin. Sotuvdan chiqqan qarz chek orqali tuzatiladi.');data.amount=exactInt(args.amount,'amount',{min:1,max:1e12});}
       return plan('debt.update',{id:d.id,data});
     }},
    {name:'prepare_opening_debt',title:'Prepare: add an old debt (boss)',
     description:'Boss only. Add a debt that existed before the platform was used. It is not new income.',
     schema:()=>obj(['customer','phone','amount','due','note'],{customer:{type:'string',maxLength:80},phone:{type:'string',maxLength:80},amount:money('Amount still owed.'),due:{type:'string',description:'YYYY-MM-DD'},note:NOTE}),
     plan(ctx,args){adminOnly(ctx);return plan('debt.openingAdd',{data:{customer:exactText(args.customer,'customer',{max:80}),phone:exactText(args.phone,'phone',{max:22}),amount:exactInt(args.amount,'amount',{min:1,max:1e12}),due:exactText(args.due,'due',{max:10}),note:exactText(args.note,'note',{max:300})}});}},
    {name:'prepare_opening_debt_removal',title:'Prepare: remove an old debt (boss)',
     description:'Boss only. Cancel an opening debt that has no payments yet. History is kept.',
     schema:()=>obj(['debt_id','reason'],{debt_id:{type:'string'},reason:REASON}),
     plan(ctx,args){adminOnly(ctx);const d=need(ctx.state.debts,args.debt_id,'debt_id',x=>!x.cancelledAt&&x.opening);return plan('debt.openingDelete',{id:d.id,note:exactText(args.reason,'reason',{max:300})});}},
    {name:'prepare_product_edit',title:'Prepare: edit a product',
     description:'Change fields of one product group. Give only what changes; everything else stays. Old receipts keep their own snapshot. Changing price needs the prices permission, owner is boss only.',
     schema:state=>{
       const config=catalog(state);
       return obj(['sku'],{sku:{type:'string',description:'Exact SKU (see get_product first)'},name:{type:'string',maxLength:60},variant:{type:'string',maxLength:90},brand:{type:'string',enum:config.brands.map(b=>b.id)},category:{type:'string',enum:config.categories},
         quality:{type:'string',enum:['',...config.qualities.map(q=>q.id)],description:'"" clears the quality'},owner:{type:'string',enum:people(state).map(p=>p.id)},low_stock_limit:{type:INT,minimum:0,maximum:100000},
         price_min:money('Lowest selling price.',0),price_max:money('Highest selling price.'),phone_model:{type:'string',maxLength:60,description:'Case groups only'},audience:{type:'string',enum:AUDIENCES.map(([id])=>id),description:'Case groups only'},material:{type:'string',enum:config.materials,description:'Case groups only'}});
     },
     plan(ctx,args){
       const p=sku(ctx,args.sku,true),config=catalog(ctx.state),prices=priceRange(args,'narx');
       const grouped=['phone_model','audience','material'].filter(k=>args[k]!==undefined);
       if(!p.grouped&&grouped.length)throw new ToolError(`${grouped.join(', ')} faqat g‘ilof guruhlari uchun.`);
       const data={name:args.name===undefined?p.name:exactText(args.name,'name',{max:60}),variant:args.variant===undefined?p.variant:exactText(args.variant,'variant',{max:90}),
         brand:args.brand===undefined?p.brand:exactEnum(args.brand,'brand',config.brands.map(b=>b.id)),category:args.category===undefined?p.category:exactEnum(args.category,'category',config.categories),
         quality:args.quality===undefined?(p.quality||''):exactEnum(args.quality,'quality',['',...config.qualities.map(q=>q.id)]),owner:args.owner===undefined?p.owner:personOf(ctx,args.owner,'owner'),
         min:args.low_stock_limit===undefined?stockLimit(p):exactInt(args.low_stock_limit,'low_stock_limit',{min:0,max:100000}),price:prices?prices.max:p.price,minPrice:prices?prices.min:(p.minPrice??p.price)};
       if(p.grouped){data.model=args.phone_model===undefined?p.model:exactText(args.phone_model,'phone_model',{max:60});data.audience=args.audience===undefined?(p.audience||''):exactEnum(args.audience,'audience',AUDIENCES.map(([id])=>id));data.material=args.material===undefined?(p.material||''):exactEnum(args.material,'material',config.materials);}
       return plan('product.update',{id:p.id,data});
     }},
    {name:'prepare_product_archive',title:'Prepare: remove or restore a product (boss)',
     description:'Boss only. Remove a product from the active catalog (stock and receipts stay, it can be restored) or restore it.',
     schema:()=>obj(['sku','archived'],{sku:SKU,archived:{type:'boolean',description:'true = remove from catalog, false = restore'},reason:{...NOTE,description:'Required when removing'}}),
     plan(ctx,args){
       adminOnly(ctx);const p=sku(ctx,args.sku,true);
       if(typeof args.archived!=='boolean')throw new ToolError('archived true yoki false bo‘lsin.');
       if(args.archived&&p.archivedAt)throw new ToolError('Bu mahsulot allaqachon olib tashlangan.');
       if(!args.archived&&!p.archivedAt)throw new ToolError('Bu mahsulot allaqachon faol.');
       return plan('product.archive',{id:p.id,archive:args.archived,note:args.archived?exactText(args.reason,'reason',{max:300}):''});
     }},
    {name:'prepare_purchase_correction',title:'Prepare: correct a stock receipt (boss)',
     description:'Boss only. Correct the quantity, cost or note of a receipt (purchase_id from list_stock_receipts). Refused if goods from that batch were already sold or written off in a way that conflicts.',
     schema:()=>obj(['purchase_id','qty','unit_cost','note'],{purchase_id:ID,qty:{type:INT,minimum:1,maximum:100000},unit_cost:money('Correct cost of ONE unit.'),note:{...NOTE,description:'Receipt note and why it is corrected'}}),
     plan(ctx,args){adminOnly(ctx);const p=need(ctx.state.purchases,args.purchase_id,'purchase_id',x=>!x.deletedAt);return plan('stock.updatePurchase',{id:p.id,data:{qty:exactInt(args.qty,'qty',{min:1,max:100000}),cost:exactInt(args.unit_cost,'unit_cost',{min:1,max:1e9}),note:exactText(args.note,'note',{max:300})}});}},
    {name:'prepare_purchase_removal',title:'Prepare: cancel a stock receipt (boss)',
     description:'Boss only. Cancel a receipt that nothing was sold from. Its stock is removed and its cash goes back.',
     schema:()=>obj(['purchase_id','reason'],{purchase_id:ID,reason:REASON}),
     plan(ctx,args){adminOnly(ctx);const p=need(ctx.state.purchases,args.purchase_id,'purchase_id',x=>!x.deletedAt);return plan('stock.updatePurchase',{id:p.id,data:{note:exactText(args.reason,'reason',{max:300})},remove:true});}},
    {name:'prepare_defect_correction',title:'Prepare: correct a write-off (boss)',
     description:'Boss only. Correct the quantity of a written-off record (defect_id from list_defects).',
     schema:()=>obj(['defect_id','qty','reason'],{defect_id:ID,qty:{type:INT,minimum:1,maximum:100000},reason:REASON}),
     plan(ctx,args){adminOnly(ctx);const d=need(ctx.state.defects,args.defect_id,'defect_id',x=>!x.cancelledAt);return plan('defect.update',{id:d.id,data:{qty:exactInt(args.qty,'qty',{min:1,max:100000}),note:exactText(args.reason,'reason',{max:300})}});}},
    {name:'prepare_defect_removal',title:'Prepare: cancel a write-off (boss)',
     description:'Boss only. Cancel a write-off: the goods return to stock and the loss is reversed.',
     schema:()=>obj(['defect_id','reason'],{defect_id:ID,reason:REASON}),
     plan(ctx,args){adminOnly(ctx);const d=need(ctx.state.defects,args.defect_id,'defect_id',x=>!x.cancelledAt);return plan('defect.update',{id:d.id,data:{note:exactText(args.reason,'reason',{max:300})},remove:true});}},
    {name:'prepare_service_correction',title:'Prepare: correct an extra-service entry',
     description:'Correct title, profit, worker or note of an extra-service entry (service_id from list_services). The old entry is cancelled and a correct one written.',
     schema:()=>obj(['service_id','title','profit','note'],{service_id:ID,title:{type:'string',maxLength:100},profit:money('Correct NET profit.',0),worker:{type:'string',description:'Person id or name'},note:NOTE}),
     plan(ctx,args){
       const s=need(ctx.state.services,args.service_id,'service_id',x=>!x.cancelledAt);
       return plan('service.save',{id:s.id,data:{title:exactText(args.title,'title',{max:100}),profit:exactInt(args.profit,'profit',{min:0,max:1e10}),worker:args.worker===undefined?s.worker:personOf(ctx,args.worker,'worker'),note:exactText(args.note,'note',{max:300})}});
     }},
    {name:'prepare_service_removal',title:'Prepare: cancel an extra-service entry',
     description:'Cancel an extra-service entry. Its profit is taken out of the results on the day of cancelling; history is kept.',
     schema:()=>obj(['service_id','reason'],{service_id:ID,reason:REASON}),
     plan(ctx,args){const s=need(ctx.state.services,args.service_id,'service_id',x=>!x.cancelledAt);return plan('service.delete',{id:s.id,note:exactText(args.reason,'reason',{max:300})});}},
    {name:'prepare_rent_removal',title:'Prepare: cancel a month’s rent (boss)',
     description:'Boss only. Cancel the agreed rent of a month that has no payments.',
     schema:()=>obj(['month','reason'],{month:{type:'string',description:'YYYY-MM'},reason:REASON}),
     plan(ctx,args){
       adminOnly(ctx);const month=exactText(args.month,'month',{max:7}),r=ctx.state.rents.find(x=>x.month===month&&!x.cancelledAt);
       if(!r)throw new ToolError(`${month} oyi uchun faol ijara yo‘q.`);
       return plan('rent.delete',{id:r.id,note:exactText(args.reason,'reason',{max:300})});
     }},
    {name:'prepare_closing_correction',title:'Prepare: correct a day-end count (boss)',
     description:'Boss only. Correct a day-end count (closing_id from list_day_closings). A cash handover recorded with it is cancelled and re-recorded today.',
     schema:()=>obj(['closing_id','counted_cash','left_for_tomorrow','handover','note'],{closing_id:ID,counted_cash:money('Cash actually counted.',0),left_for_tomorrow:money('Left in the box for tomorrow.',0),handover:{type:'boolean'},note:REASON}),
     plan(ctx,args){
       adminOnly(ctx);const c=need(ctx.state.closings,args.closing_id,'closing_id',x=>!x.cancelledAt);
       const counted=exactInt(args.counted_cash,'counted_cash',{min:0,max:1e12}),left=exactInt(args.left_for_tomorrow,'left_for_tomorrow',{min:0,max:1e12});
       if(left>counted)throw new ToolError('Ertangi qaytim sanalgan puldan oshmasin.');
       if(typeof args.handover!=='boolean')throw new ToolError('handover true yoki false bo‘lsin.');
       return plan('closing.update',{id:c.id,data:{actual:counted,float:left,handover:args.handover,note:exactText(args.note,'note',{max:300})}});
     }},
    {name:'prepare_closing_removal',title:'Prepare: cancel a day-end count (boss)',
     description:'Boss only. Cancel a day-end count and any cash handover recorded with it.',
     schema:()=>obj(['closing_id','reason'],{closing_id:ID,reason:REASON}),
     plan(ctx,args){adminOnly(ctx);const c=need(ctx.state.closings,args.closing_id,'closing_id',x=>!x.cancelledAt);return plan('closing.update',{id:c.id,data:{note:exactText(args.reason,'reason',{max:300})},remove:true});}},
    {name:'prepare_opening_balances',title:'Prepare: opening balances (boss)',
     description:'Boss only. Set the cash that existed before the platform was used and what the shop owed Asilbek and Boybek then. This changes every later cash balance, so check the preview carefully.',
     schema:()=>obj(['cash','owed_to_asilbek','owed_to_boybek','note'],{cash:money('Opening cash.',0),owed_to_asilbek:money('Owed to Asilbek (jasur) at the start.',0),owed_to_boybek:money('Owed to Boybek (sardor) at the start.',0),note:REASON}),
     plan(ctx,args){
       adminOnly(ctx);
       return plan('opening.set',{accounts:{[CASH_ACCOUNT]:exactInt(args.cash,'cash',{min:0,max:1e12})},payables:{jasur:exactInt(args.owed_to_asilbek,'owed_to_asilbek',{min:0,max:1e12}),sardor:exactInt(args.owed_to_boybek,'owed_to_boybek',{min:0,max:1e12})},note:exactText(args.note,'note',{max:300})},
         ['Bu boshlang‘ich qoldiq barcha keyingi kassa qoldiqlariga ta’sir qiladi.']);
     }},
    {name:'prepare_catalog_change',title:'Prepare: product types, brands, materials, qualities (boss)',
     description:'Boss only. Add, rename or remove an option of categories, materials, qualities or brands. Removing needs a replacement: products using it move to the replacement; old receipts stay.',
     schema:()=>obj(['kind','action'],{kind:{type:'string',enum:['categories','materials','qualities','brands']},action:{type:'string',enum:['add','rename','remove']},
       name:{type:'string',maxLength:60,description:'add: the new name'},value:{type:'string',description:'rename/remove: current value (the name for categories/materials, the id for qualities/brands, see get_catalog_options)'},new_name:{type:'string',maxLength:60,description:'rename: the new name'},replacement:{type:'string',description:'remove: value that products move to'}}),
     plan(ctx,args){
       adminOnly(ctx);
       const kind=exactEnum(args.kind,'kind',['categories','materials','qualities','brands']),action=exactEnum(args.action,'action',['add','rename','remove']);
       if(action==='add')return plan('catalog.add',{kind,name:exactText(args.name,'name',{max:60})});
       const value=exactText(args.value,'value',{max:100});
       if(action==='rename')return plan('catalog.change',{kind,value,name:exactText(args.new_name,'new_name',{max:60})});
       return plan('catalog.remove',{kind,value,replacement:exactText(args.replacement,'replacement',{max:100})},['Shu tasnifdagi barcha mahsulotlar almashtiruvchi tasnifga o‘tkaziladi.']);
     }},
    {name:'prepare_staff_settings',title:'Prepare: staff name and permissions (boss)',
     description:'Boss only. Change a seller’s display name and/or switch individual permissions. Give only the permissions to change; the rest stay. See get_staff_settings for names and meanings. Reports and administration can never be delegated.',
     schema:()=>obj(['person'],{person:{type:'string',description:'jasur/Asilbek or sardor/Boybek'},display_name:{type:'string',maxLength:60},permissions:{type:'object',additionalProperties:false,description:'Only the switches to change, true or false',properties:Object.fromEntries(PERMISSIONS.map(x=>[x.id,{type:'boolean',description:x.label}]))}}),
     plan(ctx,args){
       adminOnly(ctx);const id=personOf(ctx,args.person,'person');
       if(isAdmin(id))throw new ToolError('Boshliq ruxsatlari o‘zgarmaydi.');
       const current=ctx.state.settings.permissions?.[id]||{},given=args.permissions===undefined?{}:object(args.permissions,'permissions');
       for(const [key,value] of Object.entries(given)){
         if(!PERMISSIONS.some(x=>x.id===key))throw new ToolError(`permissions.${key} mavjud emas. Mumkin: ${PERMISSIONS.map(x=>x.id).join(', ')}.`);
         if(typeof value!=='boolean')throw new ToolError(`permissions.${key} true yoki false bo‘lsin.`);
       }
       const permissions=Object.fromEntries(PERMISSIONS.map(x=>[x.id,given[x.id]??current[x.id]??x.default]));
       const name=args.display_name===undefined?people(ctx.state).find(p=>p.id===id).name:exactText(args.display_name,'display_name',{max:60});
       return plan('staff.permissions',{person:id,name,permissions},['Xodimning huquqlari darhol o‘zgaradi.']);
     }},
    {name:'prepare_shop_settings',title:'Prepare: shop name and boss name (boss)',
     description:'Boss only. Change the shop name and/or the boss’s display name.',
     schema:()=>obj([],{shop_name:{type:'string',maxLength:100},boss_name:{type:'string',maxLength:60}}),
     plan(ctx,args){
       adminOnly(ctx);
       if(args.shop_name===undefined&&args.boss_name===undefined)throw new ToolError('shop_name yoki boss_name dan kamida bittasini bering.');
       return plan('settings.update',{shop:args.shop_name===undefined?ctx.state.settings.shop:exactText(args.shop_name,'shop_name',{max:100}),adminName:args.boss_name===undefined?people(ctx.state).find(p=>isAdmin(p.id)).name:exactText(args.boss_name,'boss_name',{max:60})});
     }},
    {name:'prepare_receipt_task_change',title:'Prepare: reassign or cancel a receipt task (boss)',
     description:'Boss only. Hand an open receipt task to another person or cancel it (goods already received stay in stock).',
     schema:()=>obj(['task','action'],{task:{type:'string',description:'Task code, e.g. K-1001'},action:{type:'string',enum:['reassign','cancel']},worker:{type:'string',description:'reassign: person id or name'},reason:{...NOTE,description:'cancel: why'}}),
     plan(ctx,args){
       adminOnly(ctx);const code=exactText(args.task,'task',{max:20}).toUpperCase(),task=ctx.state.intakes.find(i=>i.code===code&&i.status==='open');
       if(!task)throw new ToolError(`${code} nomli ochiq topshiriq topilmadi.`);
       const action=exactEnum(args.action,'action',['reassign','cancel']);
       if(action==='reassign')return plan('intake.reassign',{id:task.id,worker:personOf(ctx,args.worker,'worker')});
       return plan('intake.cancel',{id:task.id,note:exactText(args.reason,'reason',{max:300})});
     }},
    {name:'prepare_receipt_task_receive',title:'Prepare: receive goods against a task line',
     description:'Record goods received for one line of an open receipt task (only the assigned person or the boss). If the line names an existing product give qty and unit_cost. If it is for a product not in the list yet, also give new_product and its prices. Progress and completion are updated by the server.',
     schema:state=>{
       const config=catalog(state);
       return obj(['task','line','qty','unit_cost'],{task:{type:'string',description:'Task code, e.g. K-1001'},line:{type:INT,minimum:1,maximum:50,description:'Line number as shown by list_receipt_tasks (1 = first)'},qty:{type:INT,minimum:1,maximum:100000},unit_cost:money('Cost of ONE unit.'),
         note:NOTE,price_min:money('New product only.',0),price_max:money('New product only.'),low_stock_limit:{type:INT,minimum:0,maximum:100000},
         new_product:obj(['type','brand'],{type:{type:'string',enum:['case','other']},brand:{type:'string',enum:config.brands.map(b=>b.id)},owner:{type:'string',enum:people(state).map(p=>p.id)},phone_model:{type:'string',maxLength:60},audience:{type:'string',enum:AUDIENCES.map(([id])=>id)},material:{type:'string',enum:config.materials},quality:{type:'string',enum:config.qualities.map(q=>q.id)},name:{type:'string',maxLength:60},variant:{type:'string',maxLength:90},category:{type:'string',enum:config.categories}})});
     },
     plan(ctx,args){
       const code=exactText(args.task,'task',{max:20}).toUpperCase(),task=ctx.state.intakes.find(i=>i.code===code&&i.status==='open');
       if(!task)throw new ToolError(`${code} nomli ochiq topshiriq topilmadi.`);
       const number=exactInt(args.line,'line',{min:1,max:50}),line=task.lines[number-1];
       if(!line)throw new ToolError(`${code} da ${number}-qator yo‘q.`);
       const qty=exactInt(args.qty,'qty',{min:1,max:100000}),cost=exactInt(args.unit_cost,'unit_cost',{min:1,max:1e9}),note=exactText(args.note,'note',{optional:true,max:300});
       const base={intakeId:task.id,lineId:line.id};
       if(line.productId){
         if(args.new_product!==undefined)throw new ToolError('Bu qator allaqachon mahsulotga bog‘langan: new_product bermang.');
         return plan('intake.receive',{...base,mode:'purchase',data:{qty,cost,note:note||`${code} · qabul qilindi`}});
       }
       if(args.new_product===undefined)throw new ToolError('Bu qator hali mahsulotga bog‘lanmagan: new_product va narxlarni bering.');
       const prices=priceRange(args,'narx',{required:true}),limit=exactInt(args.low_stock_limit,'low_stock_limit',{min:0,max:100000,optional:true});
       const {product,create}=newProductSpec(ctx,args.new_product,'new_product',catalog(ctx.state));
       if(product)throw new ToolError(`Bu mahsulot ro‘yxatda bor (${product.sku}); topshiriq qatoriga mavjud mahsulotni biriktirib bo‘lmaydi. prepare_stock_receipt bilan kirim qiling, so‘ng topshiriqni boshliq bekor qiladi.`);
       if(create.type==='case')return plan('intake.receive',{...base,mode:'groups',data:{brand:create.brand,model:create.model,audience:create.audience,material:create.material,owner:create.owner,min:limit??5,rows:[{quality:create.quality,qty,cost,price:prices.max,minPrice:prices.min}]}});
       return plan('intake.receive',{...base,mode:'product',data:{name:create.name,variant:create.variant,brand:create.brand,category:create.category,quality:create.quality,owner:create.owner,qty,cost,price:prices.max,minPrice:prices.min,min:limit??5,note:note||`${code} · qabul qilindi`}});
     }},
  ];
}
