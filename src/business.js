import {requirePermission,can} from './access.js';
import {prepareAdmin,DEFAULT_MATERIALS} from './admin.js';
import {USERS, uid, checkout, refund, saleTotal, log, stock} from './model.js';

export const ACCOUNTS = [['till1','1-kassa'],['till2','2-kassa'],['bank','Bank / karta']];
export const AUDIENCES = [['men','Erkaklar uchun'],['women','Ayollar uchun']];
export const MATERIALS = DEFAULT_MATERIALS;
const ZONE = 'Asia/Tashkent';
const LIMIT = 1e12;
export function localDate(at = new Date()) {return new Intl.DateTimeFormat('en-CA',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(at);}
export function timestamp(at = new Date()) {return new Date(at).toISOString();}
const actorOK = actor => {if(!USERS.some(u=>u.id===actor))throw Error('Sotuvchini tanlang.');};
const bossOnly = actor => {actorOK(actor);if(actor!=='aziz')throw Error('Bu amal faqat boshliq uchun.');};
const amountOK = (amount, zero=false) => {if(!Number.isSafeInteger(amount)||amount<(zero?0:1)||amount>LIMIT)throw Error('Summani butun so‘mda kiriting.');};
const noteOK = note => {if(!String(note||'').trim()||String(note).length>500)throw Error('Sabab / izohni kiriting (500 belgigacha).');};
const accountOK = account => {if(!ACCOUNTS.some(([id])=>id===account))throw Error('Kassa yoki bankni tanlang.');};
const validPhone = value => /^\+?[\d\s()-]{7,22}$/.test(value||'')&&/^\d{7,15}$/.test(String(value).replace(/\D/g,''));
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value||'')&&Number.isFinite(Date.parse(value+'T12:00:00+05:00'))&&localDate(new Date(value+'T12:00:00+05:00'))===value;
export function eventTime(event) {return new Date(event.at || `${event.date}T${event.time || '12:00'}:00+05:00`).getTime();}

// Migration is additive. Existing stock lots, receipts and cash entries stay intact.
export function prepareState(state) {
  prepareAdmin(state);
  for(const key of ['movements','debts','rents','notices','operations','defects'])state[key] ||= [];
  state.settings.openingAccounts ||= {till1:state.settings.openingCash||0,till2:0,bank:0};
  for(const expense of state.expenses.filter(e=>e.category==='Ijara'&&!e.rentId)) {
    const month=expense.date.slice(0,7),id='legacy-rent-'+expense.id;
    // Historical payments may be installments for one month.
    let rent=state.rents.find(r=>r.month===month);
    if(!rent){rent={id,month,amount:0,paid:0,note:expense.note||'Avvalgi ijara yozuvi'};state.rents.push(rent);}
    rent.amount+=expense.amount;rent.paid+=expense.amount;expense.rentId=rent.id;
  }
  return state;
}
function operation(state, actor, kind, note, at) {
  const id=uid();
  state.operations.push({id,actor,kind,at:timestamp(at),status:'local'});
  log(state,actor,note);
  return id;
}
function notify(state, actor, text, at) {
  if(actor!=='aziz')state.notices.unshift({id:uid(),actor,text,at:timestamp(at),read:false});
}
function movement(state, data, actor, at, operationId) {
  const entry={id:uid(),date:localDate(at),at:timestamp(at),actor,...data,operationId};
  state.movements.push(entry);return entry;
}
function atomic(state, callback) {
  const draft=prepareState(structuredClone(state));
  const result=callback(draft);
  Object.assign(state,draft);return result;
}
export function priceRange(product) {return [product.minPrice ?? product.price,product.price];}
export function outsideRange(product, price) {const [min,max]=priceRange(product);return price<min||price>max;}

export function recordSale(state, cart, actor, data, at = new Date()) {
  actorOK(actor);requirePermission(state,actor,'sell');accountOK(data.account);
  if(!cart.length)throw Error('Savat bo‘sh.');
  const total=cart.reduce((sum,row)=>sum+row.qty*row.price,0);
  amountOK(total,true);amountOK(data.received,true);
  if(data.received>total)throw Error('Olingan pul savdo summasidan oshmasin. Qaytimni ayirib yozing.');
  const exception=cart.some(row=>{const p=state.products.find(p=>p.id===row.productId);return p&&outsideRange(p,row.price);});
  if(exception){requirePermission(state,actor,'priceException');noteOK(data.note);}
  const debt=total-data.received;
  if(debt) {
    requirePermission(state,actor,'credit');noteOK(data.note);
    if(!String(data.customer||'').trim()||!validPhone(data.phone)||!validDate(data.due)
      ||data.due<localDate(at))throw Error('Nasiya uchun ism, telefon va bugungi / kelajakdagi to‘lov sanasini kiriting.');
  }
  return atomic(state,draft=>{
    const payment=data.account==='bank'?'Karta':'Naqd';
    const sale=checkout(draft,cart,actor,payment);
    const op=operation(draft,actor,'sale',`${sale.id} · kelishilgan narxda sotuv`,at);
    Object.assign(sale,{at:timestamp(at),date:localDate(at),time:new Date(at).toLocaleTimeString('en-GB',{timeZone:ZONE,hour:'2-digit',minute:'2-digit'}),operationId:op,ledger:true,account:data.account,received:data.received,note:String(data.note||'').trim(),exception});
    movement(draft,{kind:'sale-payment',account:data.account,amount:data.received,reference:sale.id,note:sale.note||'Mahsulot sotuvi'},actor,at,op);
    if(debt)draft.debts.push({id:uid(),saleId:sale.id,customer:data.customer.trim(),phone:data.phone.trim(),due:data.due,note:data.note.trim(),original:debt,balance:debt,actor,at:timestamp(at),payments:[]});
    if(exception)notify(draft,actor,`${sale.id}: narx oralig‘idan tashqari sotuv. ${sale.note}`,at);
    if(debt)notify(draft,actor,`${sale.id}: ${data.customer} · ${debt} so‘m nasiya`,at);
    return sale;
  });
}
export function repayDebt(state, id, amount, account, actor, note, at=new Date()) {
  requirePermission(state,actor,'debts');
  actorOK(actor);amountOK(amount);accountOK(account);noteOK(note);
  const debt=state.debts.find(d=>d.id===id);
  if(!debt||amount>debt.balance)throw Error('To‘lov qolgan qarzdan oshmasin.');
  return atomic(state,draft=>{
    const d=draft.debts.find(d=>d.id===id),op=operation(draft,actor,'debt-payment',`${d.customer} · ${amount} so‘m qarz qaytardi`,at);
    const entry=movement(draft,{kind:'debt-payment',amount,account,reference:id,note},actor,at,op);
    d.balance-=amount;d.payments.push({...entry});
    notify(draft,actor,`${d.customer}: ${amount} so‘m qarz to‘lovi olindi`,at);
    return entry;
  });
}
export function returnSale(state, id, actor, account, note, at=new Date()) {
  requirePermission(state,actor,'returns');
  actorOK(actor);accountOK(account);noteOK(note);
  const original=state.sales.find(s=>s.id===id);
  if(!original||original.returned)throw Error('Chek topilmadi yoki avval qaytarilgan.');
  return atomic(state,draft=>{
    const sale=draft.sales.find(s=>s.id===id),debt=draft.debts.find(d=>d.saleId===id);
    const collected=(sale.received??saleTotal(sale))+(debt?.payments.filter(p=>!p.voidedBy).reduce((sum,p)=>sum+p.amount,0)||0);
    // Old receipts are converted to ledger entries before marking them returned.
    if(!sale.ledger) {
      movement(draft,{kind:'sale-payment',account:sale.payment==='Naqd'?'till1':'bank',amount:saleTotal(sale),reference:id,note:'Avvalgi chek to‘lovi'},sale.seller,new Date(eventTime(sale)),uid());
      sale.ledger=true;
    }
    refund(draft,id,actor);
    sale.returnAt=timestamp(at);sale.returnDate=localDate(at);sale.returnActor=actor;sale.returnNote=note;
    const op=operation(draft,actor,'return',`${id} · qaytarish: ${note}`,at);
    movement(draft,{kind:'refund',account,amount:collected,reference:id,note},actor,at,op);
    if(debt){debt.cancelled=debt.balance;debt.balance=0;debt.cancelledAt=timestamp(at);}
    notify(draft,actor,`${id}: sotuv qaytarildi. ${note}`,at);
    return collected;
  });
}

export const FLOW_KINDS = [['expense','Xarajat'],['income','Qo‘shimcha daromad'],['contribution','Shaxsiy pul qo‘shish'],['withdrawal','Boshliqqa pul topshirish'],['transfer','Kassalar / bank orasida o‘tkazish'],['reimbursement','Xodimga qarzni qaytarish']];
export function staffPayable(state, actor) {
  if(actor==='aziz')return 0;
  const effect=m=>(m.actor===actor&&m.account==='personal'&&['expense','rent-payment'].includes(m.kind)||m.actor===actor&&m.kind==='contribution')?m.amount:m.person===actor&&m.kind==='reimbursement'?-m.amount:0;
  return (state.settings.openingPayables?.[actor]||0)+state.movements.reduce((total,m)=>{
    if(m.kind!=='reversal')return total+effect(m);
    const original=state.movements.find(x=>x.id===m.reversalOf);
    return total-(original?effect(original):0);
  },0);
}
export function recordFlow(state, data, actor, at=new Date()) {
  requirePermission(state,actor,'cash');
  actorOK(actor);amountOK(data.amount);noteOK(data.note);
  if(!FLOW_KINDS.some(([id])=>id===data.kind))throw Error('Pul harakati turini tanlang.');
  if(data.kind==='expense'&&data.account==='personal'){}else accountOK(data.account);
  if(data.kind==='transfer'){accountOK(data.to);if(data.account===data.to)throw Error('Pul manbasi va qabul qiluvchi bir xil bo‘lmasin.');}
  if(data.kind==='reimbursement') {
    if(!USERS.some(u=>u.id===data.person&&u.id!=='aziz')||data.amount>staffPayable(state,data.person))throw Error('To‘lov xodim oldidagi qarzdan oshmasin.');
  }
  if(data.kind==='expense'&&data.category==='Ijara')throw Error('Ijarani «Oylik ijara» orqali yozing.');
  return atomic(state,draft=>{
    const op=operation(draft,actor,data.kind,data.note,at);
    const payload={kind:data.kind,amount:data.amount,account:data.account,note:data.note.trim()};
    if(data.kind==='transfer')payload.to=data.to;
    if(data.kind==='reimbursement')payload.person=data.person;
    if(data.kind==='expense')payload.category=data.category||'Boshqa';
    const entry=movement(draft,payload,actor,at,op);
    if(data.kind==='expense')draft.expenses.push({...entry,owner:'aziz',payment:data.account==='bank'?'Karta':data.account==='personal'?'Shaxsiy pul':'Naqd',ledger:true,category:data.category||'Boshqa'});
    notify(draft,actor,`${FLOW_KINDS.find(([id])=>id===data.kind)[1]}: ${data.amount} so‘m. ${data.note}`,at);
    return entry;
  });
}

export function accountBalances(state) {
  prepareState(state);
  const sums={...state.settings.openingAccounts};
  for(const sale of state.sales.filter(s=>!s.ledger&&!s.returned))sums[sale.payment==='Naqd'?'till1':'bank']+=saleTotal(sale);
  for(const entry of [...state.expenses,...state.purchases,...state.payouts].filter(e=>!e.ledger))sums[entry.account||(entry.payment==='Naqd'?'till1':'bank')]-=entry.amount??entry.qty*entry.cost;
  function apply(m,sign=1) {
    if(['sale-payment','debt-payment','income','contribution'].includes(m.kind))sums[m.account]+=sign*m.amount;
    if(['expense','withdrawal','reimbursement','refund','rent-payment','transfer'].includes(m.kind)&&m.account!=='personal')sums[m.account]-=sign*m.amount;
    if(m.kind==='transfer')sums[m.to]+=sign*m.amount;
  }
  for(const m of state.movements) {
    if(m.kind!=='reversal')apply(m);
    else {const original=state.movements.find(x=>x.id===m.reversalOf);if(original)apply(original,-1);}
  }
  return sums;
}
export function setRent(state, month, amount, note, actor, at=new Date()) {
  bossOnly(actor);amountOK(amount,true);noteOK(note);
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error('Ijara oyini tanlang.');
  prepareState(state);
  let rent=state.rents.find(r=>r.month===month);
  if(rent&&amount<rent.paid)throw Error('Ijara summasi to‘langan puldan kam bo‘lmasin.');
  if(!rent){rent={id:uid(),month,paid:0};state.rents.push(rent);}
  Object.assign(rent,{amount,note,actor,at:timestamp(at)});
  operation(state,actor,'rent',`${month}: ${amount} so‘m oylik ijara belgilandi`,at);
  return rent;
}
export function payRent(state, id, amount, account, actor, note, at=new Date()) {
  requirePermission(state,actor,'cash');
  actorOK(actor);amountOK(amount);if(account!=='personal')accountOK(account);noteOK(note);prepareState(state);
  const rent=state.rents.find(r=>r.id===id);
  if(!rent||amount>rent.amount-rent.paid)throw Error('To‘lov ijara qoldig‘idan oshmasin.');
  const op=operation(state,actor,'rent-payment',`${rent.month} ijara to‘lovi: ${amount} so‘m`,at);
  movement(state,{kind:'rent-payment',amount,account,reference:id,note},actor,at,op);rent.paid+=amount;
  notify(state,actor,`${rent.month} ijarasi uchun ${amount} so‘m to‘landi`,at);
}
export function setOpeningBalances(state, accounts, payables, actor, note, at=new Date()) {
  bossOnly(actor);noteOK(note);
  for(const [id] of ACCOUNTS)amountOK(accounts[id],true);
  for(const id of ['jasur','sardor'])amountOK(payables[id],true);
  prepareState(state);
  state.settings.openingAccounts={...accounts};state.settings.openingPayables={...payables};
  operation(state,actor,'opening-balances',`Boshlang‘ich pul va xodim qarzlari: ${note}`,at);
}
export function addOpeningDebt(state, data, actor, at=new Date()) {
  bossOnly(actor);amountOK(data.amount);noteOK(data.note);
  if(!String(data.customer||'').trim()||!validPhone(data.phone)||!validDate(data.due))throw Error('Ism, telefon va muddatni tekshiring.');
  prepareState(state);
  const entry={id:uid(),opening:true,customer:data.customer.trim(),phone:data.phone.trim(),due:data.due,note:data.note.trim(),original:data.amount,balance:data.amount,actor,at:timestamp(at),payments:[]};
  state.debts.push(entry);operation(state,actor,'opening-debt',`${entry.customer}: avvaldan qolgan ${data.amount} so‘m qarz kiritildi`,at);return entry;
}
export function closeDay(state, data, actor, at=new Date()) {
  bossOnly(actor);amountOK(data.till1,true);amountOK(data.till2,true);noteOK(data.note);
  const allocated=data.float1!==undefined||data.float2!==undefined;
  let float=data.float;
  if(allocated){amountOK(data.float1,true);amountOK(data.float2,true);float=data.float1+data.float2;
    if(data.float1>data.till1||data.float2>data.till2)throw Error('Har kassada qoladigan qaytim o‘sha kassada sanalgan puldan oshmasin.');}
  amountOK(float,true);
  const actual=data.till1+data.till2;
  if(float>actual)throw Error('Qaytim puli sanalgan kassadan oshmasin.');
  if(data.handover&&!allocated)throw Error('Pul topshirishda ikkala kassaga qoladigan qaytimni alohida yozing.');
  return atomic(state,draft=>{
    const balances=accountBalances(draft),expected=balances.till1+balances.till2;
    const entry={id:uid(),at:timestamp(at),date:localDate(at),actor,...data,float,expected,actual,difference:actual-expected,
      expectedAccounts:{till1:balances.till1,till2:balances.till2},withdrawalIds:[]};
    // A count discrepancy stays visible. It never becomes invented income/expense.
    const op=operation(draft,actor,'closing',`Kassa sanaldi. Farq: ${entry.difference} so‘m. ${data.note}`,at);
    entry.operationId=op;draft.closings.push(entry);
    if(data.handover)for(const account of ['till1','till2']) {
      const amount=data[account]-data[account==='till1'?'float1':'float2'];
      if(amount)entry.withdrawalIds.push(movement(draft,{kind:'withdrawal',account,amount,reference:entry.id,note:'Kun yakuni: boshliqqa topshirildi. '+data.note},actor,at,op).id);
    }
    return entry;
  });
}

const REVERSIBLE=['expense','income','contribution','withdrawal','transfer','reimbursement','debt-payment','rent-payment'];
export function canReverseMovement(entry,actor,state) {
  if(!can(state,actor,'reverse'))return false;
  return !!entry&&REVERSIBLE.includes(entry.kind)&&!entry.voidedBy&&(actor==='aziz'||entry.actor===actor);
}
export function reverseMovement(state,id,actor,note,at=new Date()) {
  actorOK(actor);noteOK(note);
  const source=state.movements.find(m=>m.id===id);
  if(!canReverseMovement(source,actor,state))throw Error('Bu yozuvni bekor qilib bo‘lmaydi. Sotuvni chek orqali qaytaring; xodim faqat o‘z pul yozuvini tuzatadi.');
  return atomic(state,draft=>{
    const original=draft.movements.find(m=>m.id===id);
    if(original.kind==='debt-payment') {
      const debt=draft.debts.find(d=>d.id===original.reference);
      if(!debt||debt.cancelledAt)throw Error('Chek qaytarilgan. Unga bog‘langan qarz to‘lovini alohida bekor qilib bo‘lmaydi.');
      debt.balance+=original.amount;
    }
    if(original.kind==='rent-payment') {
      const rent=draft.rents.find(r=>r.id===original.reference);
      if(!rent||rent.paid<original.amount)throw Error('Ijara to‘lovlari mos kelmadi.');
      rent.paid-=original.amount;
    }
    const op=operation(draft,actor,'reversal',`Pul yozuvi bekor qilindi: ${note}`,at);
    const reversal=movement(draft,{kind:'reversal',amount:original.amount,account:original.account,reversalOf:id,note},actor,at,op);
    Object.assign(original,{voidedBy:reversal.id,voidedAt:timestamp(at),voidedActor:actor,voidedReason:note});
    if(original.kind==='debt-payment') {
      const payment=draft.debts.find(d=>d.id===original.reference).payments.find(p=>p.id===id);
      if(payment)Object.assign(payment,{voidedBy:reversal.id,voidedAt:timestamp(at)});
    }
    if(['jasur','sardor'].some(person=>staffPayable(draft,person)<0))throw Error('Bu pul xodimga qaytarib bo‘lingan. Avval unga berilgan to‘lovni tekshirib tuzating.');
    notify(draft,actor,`${original.amount} so‘mlik pul yozuvi bekor qilindi. ${note}`,at);
    return reversal;
  });
}

export function reportWindow(period, at=new Date()) {
  const end=new Date(at),wall=new Date(end.getTime()+5*3600000);
  const year=wall.getUTCFullYear(),month=wall.getUTCMonth(),day=wall.getUTCDate();
  const utc=(y,m,d,h)=>new Date(Date.UTC(y,m,d,h-5));
  let start;
  if(period==='today'){start=utc(year,month,day,7);if(start>end)start=utc(year,month,day-1,7);}
  else if(period==='week') {
    start=utc(year,month,day-wall.getUTCDay(),23);
    if(start>end)start=new Date(start.getTime()-7*86400000);
  } else if(period==='year') {
    start=utc(year-1,11,31,23);if(utc(year,11,31,23)<=end)start=utc(year,11,31,23);
  } else if(period==='all')start=new Date('2000-01-01T00:00:00+05:00');
  else {start=utc(year,month,1,7);if(start>end)start=utc(year,month-1,1,7);}
  return {start,end};
}
export function inWindow(entry, window) {const t=eventTime(entry);return t>=+window.start&&t<=+window.end;}
export function businessReport(state,{period='month',owner='all',seller='all',at=new Date(),window=reportWindow(period,at)}={}) {
  prepareState(state);
  let revenue=0,cogs=0,units=0,count=0;
  for(const sale of state.sales) {
    if(seller!=='all'&&sale.seller!==seller)continue;
    // Legacy cancelled receipts did not preserve a reversal timestamp.
    if(sale.returned&&!sale.returnAt)continue;
    const lines=sale.items.filter(i=>owner==='all'||i.owner===owner);
    if(!lines.length)continue;
    let factor=inWindow(sale,window)?1:0;
    if(sale.returnAt&&inWindow({at:sale.returnAt},window))factor--;
    revenue+=factor*lines.reduce((s,i)=>s+i.price*i.qty,0);
    cogs+=factor*lines.reduce((s,i)=>s+i.cost,0);
    units+=factor*lines.reduce((s,i)=>s+i.qty,0);count+=factor;
  }
  const storeScope=owner==='all'||owner==='aziz';
  let expenses=state.expenses.filter(e=>e.category!=='Ijara'&&inWindow(e,window)&&(owner==='all'||e.owner===owner)&&(seller==='all'||e.actor===seller)).reduce((s,e)=>s+e.amount,0);
  let income=storeScope?state.movements.filter(m=>m.kind==='income'&&inWindow(m,window)&&(seller==='all'||m.actor===seller)).reduce((s,m)=>s+m.amount,0):0;
  for(const reversal of state.movements.filter(m=>m.kind==='reversal'&&inWindow(m,window))) {
    const original=state.movements.find(m=>m.id===reversal.reversalOf);
    if(!original||seller!=='all'&&original.actor!==seller)continue;
    if(original.kind==='expense') {
      const expense=state.expenses.find(e=>e.id===original.id);
      if(expense&&(owner==='all'||expense.owner===owner))expenses-=original.amount;
    }
    if(original.kind==='income'&&storeScope)income-=original.amount;
  }
  const loss=state.defects.filter(d=>d.kind==='dispose'&&inWindow(d,window)&&(owner==='all'||d.owner===owner)&&(seller==='all'||d.actor===seller)).reduce((s,d)=>s+d.cost,0);
  const rentIncluded=['month','year','all'].includes(period)&&storeScope&&seller==='all';
  const rent=rentIncluded?state.rents.filter(r=>inWindow({date:r.month+'-01',time:'07:00'},window)).reduce((s,r)=>s+r.amount,0):0;
  return {revenue,cogs,gross:revenue-cogs,units,count,expenses,income,loss,rent,rentIncluded,net:revenue-cogs+income-expenses-loss-rent,window};
}
export function debtReminders(state,at=new Date()) {const today=localDate(at);return state.debts.filter(d=>d.balance>0&&d.due<=today);}
export function disposeStock(state, productId, qty, note, actor, at=new Date()) {
  requirePermission(state,actor,'defects');
  actorOK(actor);noteOK(note);
  const p=state.products.find(p=>p.id===productId);
  if(!p||!Number.isSafeInteger(qty)||qty<1||qty>stock(p))throw Error('Hisobdan chiqariladigan sonni tekshiring.');
  return atomic(state,draft=>{
    const product=draft.products.find(p=>p.id===productId);let left=qty,total=0;
    for(const lot of product.lots){const n=Math.min(left,lot.qty);lot.qty-=n;total+=n*lot.cost;left-=n;if(!left)break;}
    const op=operation(draft,actor,'dispose',`${product.sku}: ${qty} dona yaroqsiz. ${note}`,at);
    const entry={id:uid(),kind:'dispose',productId,owner:product.owner,qty,cost:total,note,actor,at:timestamp(at),operationId:op};draft.defects.push(entry);
    notify(draft,actor,`${product.sku}: ${qty} dona yaroqsiz mahsulot chiqarildi. ${note}`,at);return entry;
  });
}
