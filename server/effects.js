// What a change would do, worked out by running the real command on a copy of the records
// and comparing before and after. Nothing here is estimated by Claude: stock, cash, debt and
// profit all come from the same domain code that records the change for real.
import {createHash} from 'node:crypto';
import {stock,saleProfit,saleTotal,CASH_ACCOUNT} from '../src/model.js';
import {accountBalances,AUDIENCES} from '../src/business.js';

export const group=n=>String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g,' ');
export const som=n=>`${group(n)} so‘m`;
export const productLabel=p=>[p.model||p.name,AUDIENCES.find(([v])=>v===p.audience)?.[1],p.material,p.qualityLabel,p.grouped?null:p.variant].filter(Boolean).join(' · ');

const same=(a,b)=>JSON.stringify(a??null)===JSON.stringify(b??null);

// Changes to records that already existed (not new records): which field of which record, from what to what.
function computeEdits(before,after){
  const edits=[];
  const track=(record,oldObj,newObj,fields)=>{for(const field of fields)if(!same(oldObj[field],newObj[field]))edits.push({record,field,from:oldObj[field]??null,to:newObj[field]??null});};
  const flag=(record,field,was,now)=>{if(!!was!==!!now)edits.push({record,field,from:!!was,to:!!now});};
  const pair=(list,key='id')=>{const old=new Map(before[list].map(x=>[x[key],x]));return after[list].filter(x=>old.has(x[key])).map(x=>[old.get(x[key]),x]);};
  for(const [o,p] of pair('products')){
    const record=`mahsulot ${p.sku}`;
    track(record,o,p,['name','variant','brand','category','quality','owner','min','model','audience','material']);
    flag(record,'katalogdan olib tashlangan',o.archivedAt,p.archivedAt);
  }
  for(const [o,d] of pair('debts')){
    const record=`qarz ${d.customer}`;
    track(record,o,d,['customer','phone','due','note','original']);flag(record,'bekor qilingan',o.cancelledAt,d.cancelledAt);
  }
  for(const [o,x] of pair('purchases')){
    const record=`tovar kirimi ${x.date}`;
    track(record,o,x,['qty','cost','note']);flag(record,'bekor qilingan',o.deletedAt,x.deletedAt);
  }
  for(const [o,x] of pair('defects'))flag(`yaroqsiz tovar yozuvi (${x.qty} dona)`,'bekor qilingan',o.cancelledAt,x.cancelledAt);
  for(const [o,x] of pair('services'))flag(`xizmat ${x.title}`,'bekor qilingan',o.cancelledAt,x.cancelledAt);
  for(const [o,x] of pair('rents'))flag(`ijara ${x.month}`,'bekor qilingan',o.cancelledAt,x.cancelledAt);
  for(const [o,x] of pair('closings'))flag(`kassa sanog‘i ${x.date}`,'bekor qilingan',o.cancelledAt,x.cancelledAt);
  for(const [o,i] of pair('intakes')){const record=`kirim topshirig‘i ${i.code}`;track(record,o,i,['status','worker']);}
  const a=before.settings,b=after.settings;
  track('do‘kon sozlamasi',a,b,['shop','caseCategory']);
  if(!same(a.openingAccounts,b.openingAccounts))edits.push({record:'boshlang‘ich qoldiq',field:'kassa',from:a.openingAccounts?.cash??0,to:b.openingAccounts?.cash??0});
  for(const id of ['jasur','sardor'])if((a.openingPayables?.[id]??0)!==(b.openingPayables?.[id]??0))edits.push({record:'boshlang‘ich qoldiq',field:`xodimga qarz ${id}`,from:a.openingPayables?.[id]??0,to:b.openingPayables?.[id]??0});
  for(const person of b.people||[]){
    const was=(a.people||[]).find(p=>p.id===person.id);
    if(was&&was.name!==person.name)edits.push({record:`xodim ${person.id}`,field:'ism',from:was.name,to:person.name});
    for(const [permission,value] of Object.entries(b.permissions?.[person.id]||{}))
      if((a.permissions?.[person.id]?.[permission])!==value)edits.push({record:`xodim ${person.id}`,field:`ruxsat ${permission}`,from:a.permissions?.[person.id]?.[permission]??null,to:value});
  }
  for(const kind of ['categories','materials','qualities','brands']){
    const names=list=>(list||[]).filter(x=>!x.archived).map(x=>typeof x==='string'?x:`${x.id}=${x.name}`).sort();
    if(!same(names(a.catalog?.[kind]),names(b.catalog?.[kind])))edits.push({record:`tasnif ${kind}`,field:'ro‘yxat',from:names(a.catalog?.[kind]),to:names(b.catalog?.[kind])});
  }
  return edits;
}

export function computeEffects(before,after,{admin}){
  const cash=accountBalances(structuredClone(after))[CASH_ACCOUNT]-accountBalances(structuredClone(before))[CASH_ACCOUNT];
  const known=new Map(before.products.map(p=>[p.id,p]));
  const stockChanges=[],priceChanges=[];
  for(const p of after.products){
    const old=known.get(p.id),was=old?stock(old):0,now=stock(p);
    if(!old||was!==now)stockChanges.push({sku:p.sku,name:productLabel(p),owner:p.owner,before:was,after:now,delta:now-was,is_new:!old,price_min:p.minPrice??p.price,price_max:p.price});
    if(old&&(old.price!==p.price||(old.minPrice??old.price)!==(p.minPrice??p.price)))
      priceChanges.push({sku:p.sku,name:productLabel(p),min:[old.minPrice??old.price,p.minPrice??p.price],max:[old.price,p.price]});
  }
  const fresh=list=>{const seen=new Set(before[list].map(x=>x.id));return after[list].filter(x=>!seen.has(x.id));};
  const sales=fresh('sales').map(s=>({
    receipt:s.id,total:saleTotal(s),received:s.received??saleTotal(s),on_credit:saleTotal(s)-(s.received??saleTotal(s)),payment:s.payment,seller:s.seller,
    items:s.items.map(i=>({sku:i.sku,name:productLabel(i),qty:i.qty,unit_price:i.price})),
    cost_of_goods:s.items.reduce((sum,i)=>sum+i.cost,0),gross_profit:saleProfit(s),
  }));
  const wasReturned=new Map(before.sales.map(s=>[s.id,!!s.returned]));
  const returned=after.sales.filter(s=>s.returned&&wasReturned.get(s.id)===false).map(s=>({receipt:s.id,total:saleTotal(s),gross_profit:saleProfit(s)}));
  const movements=fresh('movements').map(m=>({kind:m.kind,amount:m.amount,account:m.account,note:m.note}));
  const oldDebts=new Map(before.debts.map(d=>[d.id,d]));
  const debts=[];
  for(const d of after.debts){
    const old=oldDebts.get(d.id);
    if(!old)debts.push({customer:d.customer,phone:d.phone,due:d.due,before:0,after:d.balance,delta:d.balance,is_new:true});
    else if(old.balance!==d.balance)debts.push({customer:d.customer,before:old.balance,after:d.balance,delta:d.balance-old.balance,is_new:false});
  }
  const services=fresh('services').map(s=>({title:s.title,worker:s.worker,profit:s.profit}));
  const closings=fresh('closings').map(c=>({counted:c.actual,expected:c.expected,difference:c.difference,left_for_tomorrow:c.float,handed_over:c.handover}));
  const defects=fresh('defects').map(d=>({sku:after.products.find(p=>p.id===d.productId)?.sku,qty:d.qty,loss:d.cost}));
  const oldRents=new Map(before.rents.map(r=>[r.id,r]));
  const rents=after.rents.filter(r=>{const o=oldRents.get(r.id);return !o||o.amount!==r.amount||o.paid!==r.paid;})
    .map(r=>({month:r.month,agreed:[oldRents.get(r.id)?.amount??0,r.amount],paid:[oldRents.get(r.id)?.paid??0,r.paid]}));
  const intakes=fresh('intakes').map(i=>({code:i.code,worker:i.worker,lines:i.lines.map(l=>({what:l.label,qty:l.qty}))}));
  const wasVoided=new Set(before.movements.filter(m=>m.voidedBy).map(m=>m.id));
  const voided=after.movements.filter(m=>m.voidedBy&&!wasVoided.has(m.id)).map(m=>({kind:m.kind,amount:m.amount,note:m.note}));
  return {
    stock:stockChanges,price_changes:priceChanges,cash_delta:cash,sales,returned_sales:returned,movements,voided_movements:voided,debts,services,closings,defects,rents,intakes,
    edits:computeEdits(before,after),
    gross_profit_delta:sales.reduce((s,x)=>s+x.gross_profit,0)-returned.reduce((s,x)=>s+x.gross_profit,0),
  };
}

// Cost and profit are worked out for everyone (they are part of the fingerprint) but only the boss sees them.
export function publicEffects(e,admin){
  if(admin)return e;
  const {gross_profit_delta,...rest}=e;
  return {...rest,sales:e.sales.map(({cost_of_goods,gross_profit,...sale})=>sale),returned_sales:e.returned_sales.map(({gross_profit,...sale})=>sale)};
}

const compare=(a,b)=>JSON.stringify(a)<JSON.stringify(b)?-1:1;
// A fingerprint of the effects that matter, free of anything another person's work could change
// in between (receipt numbers, new SKUs, absolute stock). Preview and commit must agree on it.
export function digestOf(e){
  const projection={
    stock:e.stock.map(s=>[s.is_new?'new:'+s.name:s.sku,s.delta]).sort(compare),
    cash:e.cash_delta,
    sales:e.sales.map(s=>[s.total,s.received,s.payment,s.cost_of_goods,s.items.map(i=>[i.sku,i.qty,i.unit_price])]),
    returned:e.returned_sales.map(s=>[s.receipt,s.total,s.gross_profit]).sort(compare),
    movements:e.movements.map(m=>[m.kind,m.amount,m.account]).sort(compare),
    voided:e.voided_movements.map(m=>[m.kind,m.amount]).sort(compare),
    edits:e.edits.map(x=>[x.record,x.field,x.from,x.to]).sort(compare),
    debts:e.debts.map(d=>[d.customer,d.delta]).sort(compare),
    services:e.services.map(s=>[s.title,s.worker,s.profit]),
    closings:e.closings.map(c=>[c.counted,c.left_for_tomorrow,c.handed_over]),
    defects:e.defects.map(d=>[d.sku,d.qty]),
    rents:e.rents.map(r=>[r.month,r.agreed[1]-r.agreed[0],r.paid[1]-r.paid[0]]).sort(compare),
    intakes:e.intakes.map(i=>[i.worker,i.lines.map(l=>[l.what,l.qty])]),
    prices:e.price_changes.map(p=>[p.sku,p.min[1],p.max[1]]).sort(compare),
  };
  return createHash('sha256').update(JSON.stringify(projection)).digest('hex');
}

// Plain Uzbek lines for the person to read and confirm.
export function describe(e,nameOf,admin=false){
  const lines=[];
  for(const s of e.stock){
    lines.push(s.is_new
      ?`YANGI mahsulot: ${s.name} (${nameOf(s.owner)}) · ${s.after} dona · narx ${group(s.price_min)}–${group(s.price_max)} so‘m`
      :`${s.sku} ${s.name} (${nameOf(s.owner)}): ${s.before} → ${s.after} dona (${s.delta>0?'+':''}${s.delta})`);
  }
  for(const p of e.price_changes)lines.push(`Narx oralig‘i ${p.sku}: ${group(p.min[0])}–${group(p.max[0])} → ${group(p.min[1])}–${group(p.max[1])} so‘m`);
  for(const s of e.sales)lines.push(`Chek: jami ${som(s.total)}, hozir olinadi ${som(s.received)}${s.on_credit?`, nasiya ${som(s.on_credit)}`:''} (${s.payment})`);
  for(const s of e.returned_sales)lines.push(`Chek ${s.receipt} to‘liq qaytariladi: ${som(s.total)}`);
  const show=value=>value===true?'ha':value===false?'yo‘q':Array.isArray(value)?value.join(', '):value===null||value===undefined||value===''?'—':typeof value==='number'?group(value):String(value);
  for(const x of e.edits)lines.push(`Tahrir: ${x.record} · ${x.field}: ${show(x.from)} → ${show(x.to)}`);
  for(const m of e.voided_movements)lines.push(`Bekor qilinadi: ${m.kind} ${som(m.amount)} · ${m.note}`);
  for(const d of e.debts)lines.push(d.is_new?`Yangi qarz: ${d.customer} ${som(d.after)}`:`Qarz ${d.customer}: ${som(d.before)} → ${som(d.after)}`);
  for(const m of e.movements.filter(x=>!['sale-payment','debt-payment','refund','reversal'].includes(x.kind)))lines.push(`Pul harakati: ${m.kind} ${som(m.amount)} · ${m.note}`);
  for(const s of e.services)lines.push(`Xizmat foydasi: ${s.title} · ${nameOf(s.worker)} · ${som(s.profit)}`);
  for(const d of e.defects)lines.push(`Yaroqsiz tovar: ${d.sku} · ${d.qty} dona · zarar ${som(d.loss)}`);
  for(const r of e.rents)lines.push(`Ijara ${r.month}: kelishilgan ${som(r.agreed[1])}, to‘langan ${som(r.paid[1])}`);
  for(const c of e.closings)lines.push(`Kassa sanog‘i: sanalgan ${som(c.counted)}, hisobda ${som(c.expected)}, farq ${som(c.difference)}, ertangi qaytim ${som(c.left_for_tomorrow)}${c.handed_over?' · boshliqqa topshiriladi':''}`);
  for(const i of e.intakes)lines.push(`Kirim topshirig‘i ${i.code}: ${nameOf(i.worker)}ga, ${i.lines.reduce((s,l)=>s+l.qty,0)} dona`);
  if(e.cash_delta)lines.push(e.cash_delta<0?`Kassadan chiqadi: ${som(-e.cash_delta)}`:`Kassaga tushadi: ${som(e.cash_delta)}`);
  else lines.push('Kassaga ta’siri yo‘q.');
  if(admin&&e.gross_profit_delta)lines.push(`Yalpi foyda o‘zgarishi: ${e.gross_profit_delta>0?'+':''}${som(e.gross_profit_delta)}`);
  return lines;
}
