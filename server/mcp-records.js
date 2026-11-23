// Read tools that show records WITH their ids, so a correction can name exactly the record it means.
import {isAdmin,people,PERMISSIONS} from '../src/access.js';
import {reportWindow,inWindow,canReverseMovement,AUDIENCES} from '../src/business.js';
import {stock,stockLimit,saleTotal} from '../src/model.js';
import {ToolError,asNumber,asEnum,asText,asBool,label,adminOnly} from './mcp-shared.js';

const PERIODS=['today','week','month','year','all'];
const period={type:'string',enum:PERIODS,description:'today (since 07:00), week, month, year or all (Asia/Tashkent shop boundaries)'};
const limit={type:'integer',minimum:1,maximum:50,description:'Default 20'};
const schema=properties=>({type:'object',properties,additionalProperties:false});
const sku=p=>p.sku;

export const RECORD_TOOLS=[
  {
    name:'list_cash_movements',title:'Cash movements',
    description:'Cash entries, newest first, with movement_id for corrections. can_reverse tells whether this person may cancel or correct it.',
    inputSchema:schema({period,limit,kind:{type:'string',description:'Optional kind filter, e.g. expense, income, debt-payment, sale-payment'}}),
    run(ctx,args){
      const window=reportWindow(asEnum(args.period,'period',PERIODS,'today')),max=asNumber(args.limit,'limit',{min:1,max:50,def:20}),kind=asText(args.kind,'kind',30);
      const rows=ctx.data.movements.filter(m=>inWindow(m,window)&&(!kind||m.kind===kind)).slice().reverse();
      return {total_found:rows.length,movements:rows.slice(0,max).map(m=>({movement_id:m.id,date:m.date,by:ctx.nameOf(m.actor),kind:m.kind,amount:m.amount,account:m.account,category:m.category||undefined,note:m.note,cancelled:!!m.voidedBy,reversal_of:m.reversalOf||undefined,can_reverse:canReverseMovement(m,ctx.actor,ctx.state)}))};
    },
  },
  {
    name:'list_stock_receipts',title:'Stock receipts',
    description:'Goods receipts (what was entered into stock), newest first, with purchase_id for corrections. Cost is shown only to people allowed to enter stock.',
    inputSchema:schema({period,limit}),
    run(ctx,args){
      const window=reportWindow(asEnum(args.period,'period',PERIODS,'month')),max=asNumber(args.limit,'limit',{min:1,max:50,def:20});
      const rows=ctx.data.purchases.filter(p=>inWindow(p,window)).slice().reverse();
      return {total_found:rows.length,receipts:rows.slice(0,max).map(p=>{
        const product=ctx.data.products.find(x=>x.id===p.productId);
        return {purchase_id:p.id,date:p.date,sku:product?sku(product):undefined,product:product?label(product):undefined,qty:p.qty,...(ctx.mayCost&&p.cost!==undefined?{unit_cost:p.cost}:{}),entered_by:ctx.nameOf(p.actor),note:p.note,task:p.intakeId?ctx.data.intakes.find(i=>i.id===p.intakeId)?.code||null:null,cancelled:!!p.deletedAt};
      })};
    },
  },
  {
    name:'list_services',title:'Extra services',
    description:'Extra-service profit entries (repairs etc.), newest first, with service_id for corrections.',
    inputSchema:schema({period,limit}),
    run(ctx,args){
      const window=reportWindow(asEnum(args.period,'period',PERIODS,'month')),max=asNumber(args.limit,'limit',{min:1,max:50,def:20});
      const rows=ctx.data.services.filter(s=>inWindow(s,window)||(s.cancelledAt&&inWindow({at:s.cancelledAt},window))).slice().reverse();
      return {total_found:rows.length,services:rows.slice(0,max).map(s=>({service_id:s.id,date:s.date,title:s.title,worker:ctx.nameOf(s.worker),profit:s.profit,note:s.note,cancelled:!!s.cancelledAt}))};
    },
  },
  {
    name:'list_rents',title:'Monthly rent',description:'Boss only. Rent agreed and paid for each month.',inputSchema:schema({}),
    run(ctx){adminOnly(ctx);return {rents:ctx.state.rents.slice().sort((a,b)=>b.month.localeCompare(a.month)).map(r=>({month:r.month,agreed:r.amount,paid:r.paid,left:r.amount-r.paid,cancelled:!!r.cancelledAt}))};},
  },
  {
    name:'list_day_closings',title:'Day-end counts',description:'Boss only. Day-end cash counts, newest first, with closing_id for corrections.',inputSchema:schema({limit}),
    run(ctx,args){
      adminOnly(ctx);const max=asNumber(args.limit,'limit',{min:1,max:50,def:20});
      return {closings:ctx.state.closings.slice().reverse().slice(0,max).map(c=>({closing_id:c.id,date:c.date,counted:c.actual,expected:c.expected,difference:c.difference,left_for_tomorrow:c.float??null,handed_over:!!c.handover,note:c.note,cancelled:!!c.cancelledAt}))};
    },
  },
  {
    name:'list_defects',title:'Write-offs',description:'Written-off defective goods with defect_id for corrections (a seller sees only their own).',inputSchema:schema({limit}),
    run(ctx,args){
      const max=asNumber(args.limit,'limit',{min:1,max:50,def:20});
      return {defects:ctx.data.defects.slice().reverse().slice(0,max).map(d=>{
        const product=ctx.data.products.find(p=>p.id===d.productId);
        return {defect_id:d.id,date:d.date||String(d.at).slice(0,10),sku:product?.sku,product:product?label(product):undefined,qty:d.qty,...(ctx.admin?{loss:d.cost}:{}),note:d.note,cancelled:!!d.cancelledAt};
      })};
    },
  },
  {
    name:'get_product',title:'Product details',
    description:'Everything about one product group by exact SKU: fields, price range, reminder level, owner, archived flag and (for people allowed to enter stock) its batches with unit cost. Use before editing a product.',
    inputSchema:{type:'object',required:['sku'],additionalProperties:false,properties:{sku:{type:'string',description:'Exact SKU, archived ones included'}}},
    run(ctx,args){
      const code=asText(args.sku,'sku',30).toLowerCase();
      const p=ctx.data.products.find(x=>x.sku.toLowerCase()===code);
      if(!p)throw new ToolError('Bu SKU topilmadi.');
      return {sku:p.sku,name:p.name,variant:p.variant,model:p.model||undefined,brand:p.brand,category:p.category,quality:p.quality||'',audience:p.audience||undefined,material:p.material||undefined,grouped:!!p.grouped,
        owner:p.owner,owner_name:ctx.nameOf(p.owner),in_stock:stock(p),low_stock_limit:stockLimit(p),price_min:p.minPrice??p.price,price_max:p.price,archived:!!p.archivedAt,
        ...(ctx.mayCost?{batches:p.lots.filter(l=>l.qty>0).map(l=>({qty:l.qty,unit_cost:l.cost,date:l.date}))}:{})};
    },
  },
  {
    name:'get_sale',title:'Receipt details',
    description:'Full detail of one receipt: lines with SKU, qty and unit price, payment, seller, debt, how much the customer has paid so far, and whether it was returned or corrected. Use before correcting a receipt.',
    inputSchema:{type:'object',required:['receipt'],additionalProperties:false,properties:{receipt:{type:'string',description:'e.g. S-1004'}}},
    run(ctx,args){
      const id=asText(args.receipt,'receipt',40).toUpperCase().replace(/^#/,'');
      const s=ctx.data.sales.find(x=>x.id===id);
      if(!s)throw new ToolError('Bu raqamdagi chek topilmadi (xodim faqat o‘z cheklarini ko‘radi).');
      const debt=ctx.data.debts.find(d=>d.saleId===id),repaid=debt?debt.payments.filter(p=>!p.voidedBy).reduce((sum,p)=>sum+p.amount,0):0;
      return {receipt:s.id,date:s.date,time:s.time,seller:ctx.nameOf(s.seller),seller_id:s.seller,payment:s.payment,note:s.note||'',status:s.returned?'returned':'active',corrected_by:s.correctedBy||undefined,corrects:s.corrects||undefined,
        items:s.items.map(i=>({sku:i.sku,product:label(i),owner:ctx.nameOf(i.owner),qty:i.qty,unit_price:i.price})),total:saleTotal(s),paid_at_sale:s.received??saleTotal(s),
        debt:debt?{debt_id:debt.id,customer:debt.customer,phone:debt.phone,due:debt.due,balance:debt.balance,repaid}:null,paid_total_so_far:(s.received??saleTotal(s))+repaid};
    },
  },
  {
    name:'get_staff_settings',title:'Staff settings',description:'Boss only. Shop name, people with their display names and every permission switch, and the opening balances.',inputSchema:schema({}),
    run(ctx){
      adminOnly(ctx);const s=ctx.state.settings;
      return {shop:s.shop,people:people(ctx.state).map(p=>({id:p.id,name:p.name,role:p.role,...(isAdmin(p.id)?{all_permissions:true}:{permissions:Object.fromEntries(PERMISSIONS.map(x=>[x.id,s.permissions?.[p.id]?.[x.id]??x.default]))})})),
        permission_meaning:Object.fromEntries(PERMISSIONS.map(x=>[x.id,x.label])),opening_balances:{cash:s.openingAccounts?.cash??0,owed_to_jasur:s.openingPayables?.jasur??0,owed_to_sardor:s.openingPayables?.sardor??0}};
    },
  },
];
