import {can,requirePermission,isAdmin,DEFAULT_PEOPLE} from './access.js';
import {catalog} from './admin.js';
import {uid,log,stock,CASH_ACCOUNT} from './model.js';
import {prepareState,localDate,returnSale,recordSale,recordFlow,reverseMovement,canReverseMovement,repayDebt,payRent} from './business.js';

const person=id=>DEFAULT_PEOPLE.some(p=>p.id===id);
const text=(value,max=500)=>{const v=String(value??'').trim();if(!v||v.length>max)throw Error('Matnni to‘liq va belgilangan uzunlikda kiriting.');return v;};
const integer=(value,min=0,max=1e12)=>{if(!Number.isSafeInteger(value)||value<min||value>max)throw Error('Son yoki summani tekshiring.');return value;};
const admin=actor=>{if(!isAdmin(actor))throw Error('Bu amal faqat Otabek uchun.');};
const atomic=(state,fn)=>{const draft=prepareState(structuredClone(state));const result=fn(draft);Object.assign(state,draft);return result;};
function audit(state,actor,label,before,after){state.audit.unshift({id:uid(),actor,date:localDate(),at:new Date().toISOString(),time:new Date().toLocaleTimeString('en-GB',{timeZone:'Asia/Tashkent',hour:'2-digit',minute:'2-digit'}),text:label,before:structuredClone(before??null),after:structuredClone(after??null)});if(!isAdmin(actor))state.notices.unshift({id:uid(),actor,at:new Date().toISOString(),text:label,read:false});}
export function canEditService(state,entry,actor){return can(state,actor,'services')&&(!entry||isAdmin(actor)||entry.worker===actor)&&!entry?.cancelledAt;}
// Service profit is already net. It is not a second cash receipt or product sale.
export function saveService(state,data,actor,id,at=new Date()){
  requirePermission(state,actor,'services');
  const old=id?state.services.find(s=>s.id===id):null;
  if(id&&!old||!canEditService(state,old,actor))throw Error('Xizmatni o‘zgartirish huquqi yo‘q.');
  const title=text(data.title,100),note=text(data.note),profit=integer(data.profit),worker=data.worker||actor;
  if(!person(worker)||!isAdmin(actor)&&worker!==actor)throw Error('Xizmatni bajargan xodimni tekshiring.');
  return atomic(state,d=>{
    if(old)Object.assign(d.services.find(s=>s.id===id),{cancelledAt:at.toISOString(),cancelledActor:actor,cancelReason:'Tahrirlandi: '+note});
    const entry={id:uid(),title,note,profit,worker,actor,at:at.toISOString(),date:localDate(at),...(id?{replaces:id}:{})};
    if(old)d.services.find(s=>s.id===id).replacedBy=entry.id;
    d.services.push(entry);audit(d,actor,'Xizmat '+(id?'tahrirlandi: ':'qo‘shildi: ')+title,old,entry);return entry;
  });
}
export function deleteService(state,id,actor,note,at=new Date()){
  const entry=state.services.find(s=>s.id===id);text(note);
  if(!entry||!canEditService(state,entry,actor))throw Error('Xizmatni o‘chirish huquqi yo‘q.');
  const before=structuredClone(entry);Object.assign(entry,{cancelledAt:at.toISOString(),cancelledActor:actor,cancelReason:note});audit(state,actor,'Xizmat o‘chirildi: '+entry.title,before,entry);
}
export function updateProduct(state,id,data,actor){
  requirePermission(state,actor,'products');
  const product=state.products.find(p=>p.id===id),config=catalog(state);
  if(!product)throw Error('Mahsulot topilmadi.');
  const fields={name:text(data.name,60),variant:text(data.variant,90),brand:data.brand,category:data.category,quality:data.quality||'',owner:data.owner,min:integer(data.min,0,100000)};
  if(!config.brands.some(b=>b.id===fields.brand)||!config.categories.includes(fields.category)||fields.quality&&!config.qualities.some(q=>q.id===fields.quality)||!person(fields.owner))throw Error('Mahsulot tasnifi va egasini tekshiring.');
  if(product.grouped){fields.model=text(data.model,60);fields.audience=data.audience||'';fields.material=data.material||'';if(fields.audience&&!['men','women'].includes(fields.audience)||fields.material&&!config.materials.includes(fields.material))throw Error('Kim uchun va g‘ilof turini tekshiring.');}
  const price=integer(data.price,1,1e9),minPrice=integer(data.minPrice,0,price);
  if((price!==product.price||minPrice!==(product.minPrice??product.price))&&!can(state,actor,'prices'))throw Error('Katalog narxini o‘zgartirishga Otabek ruxsati kerak.');
  if(fields.owner!==product.owner&&!isAdmin(actor))throw Error('Mahsulot egasini faqat Otabek o‘zgartiradi.');
  fields.price=price;fields.minPrice=minPrice;fields.qualityLabel=config.qualities.find(q=>q.id===fields.quality)?.name||'';
  const before=structuredClone(product);Object.assign(product,fields);audit(state,actor,product.sku+' · mahsulot tahrirlandi',before,product);return product;
}
export function archiveProduct(state,id,actor,archive=true,note=''){
  admin(actor);const p=state.products.find(p=>p.id===id);if(!p)throw Error('Mahsulot topilmadi.');
  if(archive)text(note);const before=structuredClone(p);if(archive)p.archivedAt=new Date().toISOString();else delete p.archivedAt;
  audit(state,actor,p.sku+(archive?' · katalogdan olib tashlandi: '+note:' · katalogga tiklandi'),before,p);
}
export function updateDebt(state,id,data,actor){
  requirePermission(state,actor,'debts');const debt=state.debts.find(d=>d.id===id);if(!debt)throw Error('Qarz topilmadi.');
  const customer=text(data.customer,80),phone=text(data.phone,22),note=text(data.note);
  if(!/^\+?[\d\s()-]{7,22}$/.test(phone)||!/^\d{4}-\d{2}-\d{2}$/.test(data.due)||new Date(data.due+'T12:00:00Z').toISOString().slice(0,10)!==data.due)throw Error('Telefon va sanani tekshiring.');
  const fields={customer,phone,note,due:data.due};
  if(debt.opening&&data.amount!==undefined){admin(actor);if(debt.cancelledAt)throw Error('Bekor qilingan qarzni o‘zgartirib bo‘lmaydi.');const paid=debt.payments.filter(p=>!p.voidedBy).reduce((s,p)=>s+p.amount,0);fields.original=integer(data.amount,Math.max(1,paid));fields.balance=fields.original-paid;}
  const before=structuredClone(debt);Object.assign(debt,fields);audit(state,actor,customer+' · qarz ma’lumoti tahrirlandi',before,debt);
}
export function deleteOpeningDebt(state,id,actor,note){
  admin(actor);text(note);const d=state.debts.find(d=>d.id===id);
  if(!d?.opening||d.payments.some(p=>!p.voidedBy)||d.cancelledAt)throw Error('Sotuvga yoki faol to‘lovga bog‘langan qarzni alohida o‘chirmang. Avval chekni yoki to‘lovni tuzating.');
  const before=structuredClone(d);d.cancelled=d.balance;d.balance=0;d.cancelledAt=new Date().toISOString();d.cancelReason=note;audit(state,actor,'Avvalgi qarz o‘chirildi: '+d.customer,before,d);
}
export function correctMovement(state,id,data,actor){
  const m=state.movements.find(x=>x.id===id);if(!canReverseMovement(m,actor,state)||m.kind==='transfer')throw Error('Bu pul yozuvini tahrirlab bo‘lmaydi.');
  integer(data.amount,1);text(data.note);
  return atomic(state,d=>{
    reverseMovement(d,id,actor,'Tahrirlash: '+data.note);
    const entry={...m,...data,kind:m.kind,person:m.person};
    if(m.kind==='debt-payment'){const corrected=repayDebt(d,m.reference,entry.amount,entry.account,actor,entry.note);corrected.actor=m.actor;d.debts.find(x=>x.id===m.reference).payments.find(x=>x.id===corrected.id).actor=m.actor;return corrected;}
    if(m.kind==='rent-payment'){const corrected=payRent(d,m.reference,entry.amount,entry.account,actor,entry.note);corrected.actor=m.actor;return corrected;}
    const corrected=recordFlow(d,entry,actor);corrected.actor=m.actor;const expense=d.expenses.find(e=>e.id===corrected.id);if(expense)expense.actor=m.actor;return corrected;
  });
}
export function correctSale(state,id,data,actor){
  const sale=state.sales.find(s=>s.id===id);requirePermission(state,actor,'returns');requirePermission(state,actor,'sell');
  if(!sale||sale.returned||!isAdmin(actor)&&sale.seller!==actor)throw Error('Faol o‘z chekingizni tanlang.');
  const seller=data.seller||sale.seller;if(!person(seller)||!isAdmin(actor)&&seller!==actor)throw Error('Sotuvchini tekshiring.');text(data.note);
  return atomic(state,d=>{returnSale(d,id,actor,CASH_ACCOUNT,'Chek tuzatildi: '+data.note);const replacement=recordSale(d,data.items,seller,{...data,account:CASH_ACCOUNT});replacement.corrects=id;d.sales.find(s=>s.id===id).correctedBy=replacement.id;audit(d,actor,id+' · chek tuzatildi',sale,replacement);return replacement;});
}
export function purchaseLot(state,entry){
  const p=state.products.find(p=>p.id===entry.productId);if(!p)return null;
  if(entry.lotId)return p.lots.find(l=>l.id===entry.lotId);
  const lots=p.lots.filter(l=>l.date===entry.date&&l.cost===entry.cost);
  return lots.length===1?lots[0]:null;
}
export function updatePurchase(state,id,data,actor,remove=false){
  admin(actor);const entry=state.purchases.find(p=>p.id===id),lot=entry&&purchaseLot(state,entry);
  if(!entry||entry.deletedAt||!lot)throw Error('Bu eski kirimning partiyasi aniq emas. Qoldiqni alohida tuzatish kerak.');
  const used=state.sales.flatMap(s=>s.items).some(i=>i.productId===entry.productId&&i.alloc.some(a=>a.lotId===lot.id))||state.defects.some(d=>d.productId===entry.productId&&(!d.alloc||d.alloc.some(a=>a.lotId===lot.id)));
  const qty=remove?0:integer(data.qty,1,100000),cost=remove?entry.cost:integer(data.cost,1,1e9),note=text(data.note);
  const consumed=entry.qty-lot.qty;
  if(consumed<0||qty<consumed||cost!==entry.cost&&used||remove&&used)throw Error('Bu partiyadan mahsulot ishlatilgan. Sarflangan son va eski tannarxni o‘zgartirib bo‘lmaydi; qolgan sonini tuzating.');
  const before=structuredClone(entry);lot.qty+=qty-entry.qty;lot.cost=cost;
  if(remove)entry.deletedAt=new Date().toISOString();else Object.assign(entry,{qty,cost,note});
  audit(state,actor,entry.productId+(remove?' · tovar kirimi o‘chirildi':' · tovar kirimi tuzatildi'),before,entry);
}
export function deleteRent(state,id,actor,note){
  admin(actor);text(note);const r=state.rents.find(r=>r.id===id);if(!r)throw Error('Ijara topilmadi.');
  if(r.paid)throw Error('Avval ijara to‘lovlarini bekor qiling. To‘langan ijara o‘chirilmaydi.');
  audit(state,actor,'Ijara o‘chirildi: '+r.month,r,null);r.deletedAmount=r.amount;r.amount=0;r.cancelledAt=new Date().toISOString();r.cancelReason=note;
}

export function updateClosing(state,id,data,actor,remove=false){
  admin(actor);const closing=state.closings.find(c=>c.id===id);if(!closing||closing.cancelledAt)throw Error('Kassa sanog‘i topilmadi.');
  text(data.note);if(!remove){integer(data.actual);integer(data.float,0,data.actual);}
  return atomic(state,d=>{
    let c=d.closings.find(c=>c.id===id);const before=structuredClone(c);
    for(const withdrawalId of c.withdrawalIds||[]){const m=d.movements.find(m=>m.id===withdrawalId);if(m&&!m.voidedBy)reverseMovement(d,m.id,actor,'Kassa sanog‘i tuzatildi: '+data.note);}
    c=d.closings.find(c=>c.id===id);
    if(remove)c.cancelledAt=new Date().toISOString();
    else {Object.assign(c,{actual:data.actual,float:data.float,handover:data.handover,note:data.note,difference:data.actual-c.expected,correctedAt:new Date().toISOString()});
      c.withdrawalIds ||= [];if(data.handover&&data.actual>data.float){const m=recordFlow(d,{kind:'withdrawal',amount:data.actual-data.float,account:CASH_ACCOUNT,note:'Kassa sanog‘i tuzatildi: '+data.note},actor);m.reference=id;c=d.closings.find(c=>c.id===id);c.withdrawalIds.push(m.id);}}
    audit(d,actor,'Kassa sanog‘i '+(remove?'o‘chirildi':'tahrirlandi'),before,c);
  });
}
export function updateDefect(state,id,data,actor,remove=false){
  admin(actor);const defect=state.defects.find(x=>x.id===id);if(!defect||defect.cancelledAt)throw Error('Nuqson yozuvi topilmadi.');text(data.note);if(!remove)integer(data.qty,1,100000);
  return atomic(state,d=>{
    const old=d.defects.find(x=>x.id===id),p=d.products.find(p=>p.id===old.productId);
    if(old.alloc){for(const a of old.alloc){let lot=p.lots.find(l=>l.id===a.lotId);if(!lot){lot={id:a.lotId,qty:0,cost:a.cost,date:localDate()};p.lots.push(lot);}lot.qty+=a.qty;}}
    else {const unit=Math.floor(old.cost/old.qty),extra=old.cost-unit*old.qty;for(const [qty,cost] of [[old.qty-extra,unit],[extra,unit+1]])if(qty)p.lots.push({id:uid(),qty,cost,date:localDate()});}
    old.cancelledAt=new Date().toISOString();old.cancelReason=data.note;
    if(!remove){if(data.qty>stock(p))throw Error('Tuzatilgan son ombordagi qoldiqdan oshmasin.');let left=data.qty,cost=0,alloc=[];for(const lot of p.lots){const qty=Math.min(left,lot.qty);if(qty){lot.qty-=qty;left-=qty;cost+=qty*lot.cost;alloc.push({lotId:lot.id,qty,cost:lot.cost});}if(!left)break;}d.defects.push({...old,id:uid(),at:new Date().toISOString(),actor,qty:data.qty,cost,alloc,note:data.note,cancelledAt:undefined,cancelReason:undefined});}
    audit(d,actor,'Nuqson '+(remove?'o‘chirildi':'tahrirlandi'),defect,old);
  });
}
