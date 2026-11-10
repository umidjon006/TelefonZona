import {OWNERS,USERS} from './model.js';
import {ACCOUNTS,prepareState,accountBalances,staffPayable} from './business.js';
import {catalog} from './admin.js';
import {DEFAULT_PEOPLE,PERMISSIONS} from './access.js';

export const MAX_BACKUP_BYTES=8*1024*1024;
const rootArrays=['products','sales','expenses','purchases','payouts','closings','audit'];
const optionalArrays=['movements','debts','rents','notices','operations','defects'];
const movementKinds=['expense','income','contribution','withdrawal','transfer','reimbursement','debt-payment','rent-payment','sale-payment','refund','reversal'];
const ownerIDs=new Set(OWNERS.map(o=>o.id)),userIDs=new Set(USERS.map(u=>u.id));
const accountIDs=new Set(ACCOUNTS.map(([id])=>id));
const fail=label=>{throw Error('Zaxira faylida '+label+' noto‘g‘ri yoki yetishmaydi. Asosiy ma’lumotlar o‘zgarmadi.');};
function object(value,label){if(!value||typeof value!=='object'||Array.isArray(value))fail(label);}
function text(value,label,max=500){if(typeof value!=='string'||!value.trim()||value.length>max)fail(label);}
function integer(value,label,zero=true){if(!Number.isSafeInteger(value)||value<(zero?0:1)||value>Number.MAX_SAFE_INTEGER)fail(label);}
function date(value,label){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T12:00:00Z'))||new Date(value+'T12:00:00Z').toISOString().slice(0,10)!==value)fail(label);}
function at(value,label){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(value)||!Number.isFinite(Date.parse(value)))fail(label);}
function event(entry,label){if(entry.at!==undefined)at(entry.at,label+' sanasi');if(entry.date!==undefined)date(entry.date,label+' sanasi');else if(entry.at===undefined)fail(label+' sanasi');if(entry.time!==undefined&&(typeof entry.time!=='string'||!/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(entry.time)))fail(label+' vaqti');}
function actor(value,label){if(!userIDs.has(value))fail(label+' xodimi');}
function owner(value,label){if(!ownerIDs.has(value))fail(label+' egasi');}
function account(value,label,personal=false){if(!accountIDs.has(value)&&!(personal&&value==='personal'))fail(label+' pul hisobi');}
function payment(value,label){if(!['Naqd','Karta','O‘tkazma','Shaxsiy pul'].includes(value))fail(label+' to‘lov turi');}
function array(value,label){if(!Array.isArray(value)||value.length>100000)fail(label+' ro‘yxati');}
function uniqueIDs(entries,label){array(entries,label);const ids=new Set();for(const e of entries){object(e,label);text(e.id,label+' raqami',150);if(!/^[a-zA-Z0-9_-]+$/.test(e.id)||ids.has(e.id))fail(label+' takrorlangan / noto‘g‘ri raqami');ids.add(e.id);}return ids;}

// Imported JSON is data, never executable content. Validate it before migration
// or any localStorage writes; keep source records and historical lot costs.
export function readBackup(raw) {
  if(typeof raw!=='string'||new TextEncoder().encode(raw).byteLength>MAX_BACKUP_BYTES)throw Error('Zaxira JSON fayli 8 MB dan oshmasin.');
  let state;
  try {state=JSON.parse(raw,(key,value)=>{if(['__proto__','prototype','constructor'].includes(key))throw Error('Kalit');return value;});}
  catch {throw Error('JSON faylini o‘qib bo‘lmadi. TelefonZona zaxira faylini tanlang.');}
  let nodes=0;
  function bounded(value,depth=0){if(++nodes>500000||depth>25)fail('fayl hajmi / tuzilishi');if(value&&typeof value==='object')for(const v of Object.values(value))bounded(v,depth+1);}
  bounded(state);object(state,'asosiy tuzilma');if(state.version!==1)fail('fayl versiyasi');
  object(state.settings,'do‘kon sozlamalari');text(state.settings.shop,'do‘kon nomi',100);
  if(state.settings.people!==undefined){uniqueIDs(state.settings.people,'xodim sozlamalari');
    if(state.settings.people.length!==DEFAULT_PEOPLE.length)fail('xodimlar soni');
    for(const p of state.settings.people){actor(p.id,'xodim sozlamalari');text(p.name,'xodim ismi',60);if(!/^[\p{L}\p{N}\s‘’ʻʼ'.-]+$/u.test(p.name))fail('xodim ismi');}
  }
  if(state.settings.permissions!==undefined){object(state.settings.permissions,'ruxsatlar');
    for(const [person,permissions] of Object.entries(state.settings.permissions)){if(!['sardor','jasur'].includes(person))fail('ruxsat egasi');object(permissions,'xodim ruxsatlari');for(const [id,value] of Object.entries(permissions))if(!PERMISSIONS.some(p=>p.id===id)||typeof value!=='boolean')fail('xodim ruxsati');}
  }
  if(state.settings.catalog!==undefined){object(state.settings.catalog,'mahsulot tasniflari');
    for(const key of ['categories','materials','qualities','brands'])if(state.settings.catalog[key]!==undefined){const entries=state.settings.catalog[key];array(entries,'mahsulot tasnifi');if(!entries.length)fail('bo‘sh mahsulot tasnifi');
      if(['categories','materials'].includes(key)){for(const value of entries)text(value,'tasnif nomi',60);if(new Set(entries.map(v=>v.toLocaleLowerCase())).size!==entries.length)fail('takror tasnif');}
      else {uniqueIDs(entries,'tasnif raqami');for(const entry of entries){text(entry.name,'tasnif nomi',60);if(key==='brands')text(entry.mark,'brend belgisi',60);}}
    }
  }
  for(const key of rootArrays)uniqueIDs(state[key],key);
  for(const key of optionalArrays){if(state[key]===undefined)state[key]=[];uniqueIDs(state[key],key);}
  if(state.settings.openingCash!==undefined)integer(state.settings.openingCash,'boshlang‘ich naqd');
  if(state.settings.openingAccounts!==undefined){object(state.settings.openingAccounts,'boshlang‘ich hisoblar');for(const [id] of ACCOUNTS)integer(state.settings.openingAccounts[id],'boshlang‘ich '+id);}
  if(state.settings.openingPayables!==undefined){object(state.settings.openingPayables,'xodimga boshlang‘ich qarz');for(const [id,value] of Object.entries(state.settings.openingPayables)){actor(id,'boshlang‘ich qarz');integer(value,'xodimga boshlang‘ich qarz');}}
  const products=new Map(state.products.map(p=>[p.id,p]));
  for(const p of state.products) {
    text(p.name,'mahsulot nomi',200);owner(p.owner,'mahsulot');integer(p.price,'yuqori narx',false);integer(p.min,'kam qoldiq');
    if(p.minPrice!==undefined){integer(p.minPrice,'eng kam narx');if(p.minPrice>p.price)fail('narx oralig‘i');}
    if(p.quality&&!catalog(state).qualities.some(q=>q.id===p.quality))fail('sifat');
    uniqueIDs(p.lots,'tovar partiyasi');
    for(const lot of p.lots){integer(lot.qty,'partiya soni');integer(lot.cost,'partiya tannarxi');}
  }
  integer(state.products.reduce((sum,p)=>sum+p.lots.reduce((total,l)=>total+l.qty*l.cost,0),0),'ombor jami tannarxi');
  integer(state.products.reduce((sum,p)=>sum+p.lots.reduce((total,l)=>total+l.qty,0)*p.price,0),'ombor jami narxi');
  const sales=new Map(state.sales.map(s=>[s.id,s]));
  for(const s of state.sales) {
    event(s,'sotuv');actor(s.seller,'sotuv');payment(s.payment,'sotuv');if(typeof s.returned!=='boolean')fail('sotuv holati');
    if(s.returnAt!==undefined)at(s.returnAt,'qaytarish sanasi');
    array(s.items,'chek mahsulotlari');if(!s.items.length)fail('bo‘sh chek');
    for(const i of s.items){if(!products.has(i.productId))fail('chekdagi mahsulot havolasi');owner(i.owner,'chek');integer(i.qty,'sotilgan dona',false);integer(i.price,'sotilgan narx');integer(i.cost,'sotilgan tovar tannarxi');array(i.alloc,'sarflangan partiyalar');
      for(const a of i.alloc){text(a.lotId,'sarflangan partiya raqami',150);integer(a.qty,'sarflangan dona',false);integer(a.cost,'sarflangan tannarx');}
      if(i.alloc.reduce((sum,a)=>sum+a.qty,0)!==i.qty||i.alloc.reduce((sum,a)=>sum+a.qty*a.cost,0)!==i.cost)fail('chek partiyalari hisobi');
    }
    const total=s.items.reduce((sum,i)=>sum+i.qty*i.price,0);integer(total,'chek jami');
    if(s.received!==undefined){integer(s.received,'olingan pul');if(s.received>total)fail('olingan pul');account(s.account,'sotuv');}
  }
  for(const e of state.expenses){event(e,'xarajat');integer(e.amount,'xarajat summasi',false);owner(e.owner,'xarajat');if(e.actor!==undefined)actor(e.actor,'xarajat');text(e.category,'xarajat turi');payment(e.payment,'xarajat');}
  for(const p of state.purchases){event(p,'kirim');if(!products.has(p.productId))fail('kirim mahsuloti');integer(p.qty,'kirim soni',false);integer(p.cost,'kirim tannarxi',false);owner(p.owner,'kirim');payment(p.payment,'kirim');if(p.account!==undefined)account(p.account,'kirim');}
  for(const p of state.payouts){event(p,'avvalgi to‘lov');integer(p.amount,'avvalgi to‘lov summasi');payment(p.payment,'avvalgi to‘lov');}
  const movements=new Map(state.movements.map(m=>[m.id,m]));
  for(const m of state.movements){event(m,'pul harakati');actor(m.actor,'pul harakati');if(!movementKinds.includes(m.kind))fail('pul harakati turi');integer(m.amount,'pul harakati summasi',m.kind==='sale-payment'||m.kind==='refund');account(m.account,'pul harakati',['expense','rent-payment','reversal'].includes(m.kind));
    if(m.to!==undefined)account(m.to,'o‘tkazma');
    if(m.person!==undefined)actor(m.person,'qaytariladigan pul');
    if(m.kind==='transfer'){account(m.to,'o‘tkazma');if(m.to===m.account)fail('o‘tkazma yo‘nalishi');}
    if(m.kind==='reimbursement')actor(m.person,'qaytariladigan pul');
    if(['sale-payment','refund'].includes(m.kind)&&!sales.has(m.reference))fail('pul harakati cheki');
    if(m.kind==='expense'&&!state.expenses.some(e=>e.id===m.id&&e.ledger&&e.amount===m.amount))fail('xarajat va pul harakati bog‘lanishi');
    if(m.kind==='reversal'){const original=movements.get(m.reversalOf);if(!original||['reversal','sale-payment','refund'].includes(original.kind)||original.voidedBy!==m.id||original.amount!==m.amount||original.account!==m.account)fail('bekor qilish bog‘lanishi');}
    if(m.voidedBy){const reversal=movements.get(m.voidedBy);if(!reversal||reversal.reversalOf!==m.id)fail('bekor qilingan yozuv havolasi');}
  }
  for(const r of state.rents){if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(r.month))fail('ijara oyi');integer(r.amount,'ijara summasi');integer(r.paid,'to‘langan ijara');if(r.paid>r.amount)fail('ijara qoldig‘i');}
  if(new Set(state.rents.map(r=>r.month)).size!==state.rents.length)fail('takrorlangan ijara oyi');
  for(const d of state.debts){text(d.customer,'qarzdor ismi',100);text(d.phone,'qarzdor telefoni',30);date(d.due,'qarz muddati');integer(d.original,'boshlang‘ich qarz',false);integer(d.balance,'qarz qoldig‘i');uniqueIDs(d.payments,'qarz to‘lovlari');if((!d.opening||d.saleId!==undefined)&&!sales.has(d.saleId))fail('qarz cheki');
    let paid=0;for(const p of d.payments){integer(p.amount,'qarz to‘lovi',false);account(p.account,'qarz to‘lovi');const m=movements.get(p.id);if(!m||m.kind!=='debt-payment'||m.reference!==d.id||m.amount!==p.amount||m.voidedBy!==p.voidedBy)fail('qarz to‘lovlari bog‘lanishi');if(!p.voidedBy)paid+=p.amount;}
    integer(d.cancelled||0,'bekor qilingan qarz');if(d.original!==d.balance+paid+(d.cancelled||0))fail('qarz to‘lovlari jami');
  }
  for(const m of state.movements){if(m.kind==='debt-payment'&&!state.debts.some(d=>d.id===m.reference&&d.payments.some(p=>p.id===m.id)))fail('qarz to‘lovi havolasi');if(m.kind==='rent-payment'&&!state.rents.some(r=>r.id===m.reference))fail('ijara to‘lovi havolasi');}
  for(const c of state.closings){event(c,'kassa sanog‘i');integer(c.actual,'sanalgan pul');if(!Number.isSafeInteger(c.expected))fail('kutilgan pul');if(c.actor!==undefined)actor(c.actor,'kassa sanog‘i');for(const key of ['float','float1','float2','till1','till2'])if(c[key]!==undefined)integer(c[key],'kassa sanog‘i');
    if(c.expectedAccounts!==undefined){object(c.expectedAccounts,'kutilgan kassalar');for(const id of ['till1','till2'])if(!Number.isSafeInteger(c.expectedAccounts[id]))fail('kutilgan kassa qoldig‘i');}
    if(c.withdrawalIds!==undefined){array(c.withdrawalIds,'kassadan topshirish');for(const id of c.withdrawalIds){const m=movements.get(id);if(!m||m.kind!=='withdrawal'||m.reference!==c.id)fail('kassadan topshirilgan pul havolasi');}}
  }
  for(const a of state.audit){event(a,'amallar tarixi');actor(a.actor,'amallar tarixi');text(a.text,'amal izohi',2000);}
  for(const n of state.notices){event(n,'eslatma');actor(n.actor,'eslatma');text(n.text,'eslatma izohi',2000);}
  for(const d of state.defects){event(d,'nuqson');if(!products.has(d.productId))fail('nuqson mahsuloti');integer(d.qty,'nuqson soni',false);integer(d.cost,'nuqson tannarxi');actor(d.actor,'nuqson');owner(d.owner,'nuqson');}
  prepareState(state);
  for(const value of Object.values(accountBalances(state)))if(!Number.isSafeInteger(value))fail('pul qoldig‘i hisobi');
  for(const person of ['jasur','sardor'])if(!Number.isSafeInteger(staffPayable(state,person))||staffPayable(state,person)<0)fail('xodimga qarz hisobi');
  return state;
}

export function backupSummary(state) {
  return {products:state.products.length,units:state.products.reduce((sum,p)=>sum+p.lots.reduce((n,l)=>n+l.qty,0),0),sales:state.sales.length,
    debt:state.debts.reduce((sum,d)=>sum+d.balance,0),movements:state.movements.length,balances:accountBalances(state)};
}
