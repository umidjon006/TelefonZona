import {DEFAULT_PEOPLE,requirePermission} from './access.js';
export function currentDate(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tashkent',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
export const TODAY=currentDate();
export const USERS=DEFAULT_PEOPLE;
export const OWNERS=USERS.map((person,index)=>({...person,short:person.initials[0],color:['#236b4b','#9b7040','#45658f'][index]}));
export const CATEGORIES=['G‘iloflar','Quvvatlagichlar','Kabellar','Quloqchinlar','Himoya oynalari','Aqlli soatlar','Soat aksessuarlari','Avto aksessuarlar'];
export const uid=()=>globalThis.crypto?.randomUUID?.()||Math.random().toString(36).slice(2);
export function stock(p){return p.lots.reduce((a,l)=>a+l.qty,0)}
export function cost(p){const s=stock(p);return s?Math.round(p.lots.reduce((a,l)=>a+l.qty*l.cost,0)/s):(p.lots.at(-1)?.cost||0)}
export const CASH_ACCOUNT = 'cash';

export function createEmptyState() {
  return {
    version:1,
    products:[], sales:[], expenses:[], purchases:[], payouts:[], closings:[], audit:[],
    settings:{shop:'TelefonZona',openingAccounts:{[CASH_ACCOUNT]:0}},
  };
}

export function saleTotal(s){return s.items.reduce((a,i)=>a+i.qty*i.price,0)}
export function saleProfit(s){return s.items.reduce((a,i)=>a+i.qty*i.price-i.cost,0)}
// Older demo receipts have no listed-price snapshot; never infer it from today's price.
export function saleDiscount(s){return s.items.reduce((sum,item)=>sum+Math.max(0,(item.listPrice??item.price)-item.price)*item.qty,0)}
export function inventoryValue(products){return products.reduce((totals,product)=>({cost:totals.cost+product.lots.reduce((sum,lot)=>sum+lot.qty*lot.cost,0),retail:totals.retail+stock(product)*product.price}),{cost:0,retail:0})}
export function metrics(s,{from='2000-01-01',to='9999-12-31',owner='all',seller='all'}={}){
const sales=s.sales.filter(x=>!x.returned&&x.date>=from&&x.date<=to&&(seller==='all'||x.seller===seller));
const lines=sales.flatMap(x=>x.items.filter(i=>owner==='all'||i.owner===owner));
// Pay is agreed outside the app. Legacy demo commissions are not deducted.
const revenue=lines.reduce((a,i)=>a+i.qty*i.price,0),cogs=lines.reduce((a,i)=>a+i.cost,0),commission=0;
const expenses=s.expenses.filter(x=>x.date>=from&&x.date<=to&&(owner==='all'||x.owner===owner)).reduce((a,e)=>a+e.amount,0);
return {revenue,cogs,gross:revenue-cogs,commission,expenses,net:revenue-cogs-commission-expenses,units:lines.reduce((a,i)=>a+i.qty,0),count:sales.filter(x=>x.items.some(i=>owner==='all'||i.owner===owner)).length};
}
export function log(s,actor,text){s.audit.unshift({id:uid(),at:new Date().toISOString(),date:currentDate(),time:new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Tashkent'}),actor,text})}
export function checkout(s,cart,seller,payment){
requirePermission(s,seller,'sell');
if(!USERS.some(u=>u.id===seller)||!['Naqd','Karta','O‘tkazma'].includes(payment)||!cart.length)throw Error('Sotuv ma’lumotlari to‘liq emas.');
if(new Set(cart.map(i=>i.productId)).size!==cart.length)throw Error('Takrorlangan mahsulot.');
for(const row of cart){const p=s.products.find(p=>p.id===row.productId);if(!p||!Number.isInteger(row.qty)||row.qty<1||row.qty>stock(p)||!Number.isSafeInteger(row.price)||row.price<0)throw Error('Mahsulot soni yoki narxini tekshiring.');}
const items=cart.map(row=>{const p=s.products.find(p=>p.id===row.productId);let left=row.qty,alloc=[];for(const l of p.lots){const q=Math.min(l.qty,left);if(q){alloc.push({lotId:l.id,qty:q,cost:l.cost});l.qty-=q;left-=q;}if(!left)break;}const c=alloc.reduce((a,l)=>a+l.qty*l.cost,0);return {...row,name:p.name,variant:p.variant,brand:p.brand,model:p.model,sku:p.sku,quality:p.quality,audience:p.audience,material:p.material,grouped:p.grouped,minPrice:p.minPrice??p.price,listPrice:p.price,owner:p.owner,cost:c,alloc,commission:0}});
const sale={operationId:uid(),at:new Date().toISOString(),id:'S-'+(1001+s.sales.length),date:currentDate(),time:new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Tashkent'}),seller,payment,items,returned:false};s.sales.push(sale);log(s,seller,`${sale.id} · ${saleTotal(sale).toLocaleString('en-US')} so‘mlik sotuv`);return sale;
}
export function refund(s,id,actor){requirePermission(s,actor,'returns');if(!USERS.some(u=>u.id===actor))throw Error('Sotuvchini tanlang.');const sale=s.sales.find(x=>x.id===id);if(!sale||sale.returned)throw Error('Bu sotuv qaytarilgan yoki topilmadi.');for(const item of sale.items){const p=s.products.find(p=>p.id===item.productId);for(const a of item.alloc){const lot=p.lots.find(l=>l.id===a.lotId);if(lot)lot.qty+=a.qty;else p.lots.push({id:a.lotId,qty:a.qty,cost:a.cost,date:sale.date});}}sale.returned=true;sale.returnDate=currentDate();log(s,actor,`${id} · to‘liq qaytarildi`);}
export function purchase(s,id,qty,unitCost,payment,actor){
if(!['Naqd','Karta','O‘tkazma'].includes(payment))throw Error('To‘lov turini tanlang.');
requirePermission(s,actor,'stock');const p=s.products.find(p=>p.id===id);if(!p)throw Error('Mahsulot topilmadi.');if(!Number.isInteger(qty)||qty<1||!Number.isSafeInteger(unitCost)||unitCost<1)throw Error('Son va tannarx musbat bo‘lishi kerak.');p.lots.push({id:uid(),qty,cost:unitCost,date:currentDate()});s.purchases.push({id:uid(),at:new Date().toISOString(),actor,account:CASH_ACCOUNT,note:`${p.sku} · ${qty} dona tovar kirimi`,productId:id,owner:p.owner,qty,cost:unitCost,date:currentDate(),payment});log(s,actor,`${p.name} · ${qty} dona kirim`);}
export function expectedCash(s){return s.settings.openingCash+s.sales.filter(x=>!x.returned&&x.payment==='Naqd').reduce((a,x)=>a+saleTotal(x),0)-s.expenses.filter(x=>x.payment==='Naqd').reduce((a,x)=>a+x.amount,0)-s.purchases.filter(x=>x.payment==='Naqd').reduce((a,x)=>a+x.qty*x.cost,0)-s.payouts.filter(x=>x.payment==='Naqd').reduce((a,x)=>a+x.amount,0);}
