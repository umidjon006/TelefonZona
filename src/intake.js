// Boss hands incoming goods to workers ("kirim topshirig‘i"). A worker records the
// receipt against a line, so the history shows who entered what and nobody enters
// the same goods twice. No money rule is added here: receipts use the existing
// purchase / registration functions and their cash effects.
import {DEFAULT_PEOPLE,isAdmin,people} from './access.js';
import {CASH_ACCOUNT,uid,log,purchase,intakeHolder} from './model.js';
import {registerProduct,registerCaseGroups} from './inventory-entry.js';
import {prepareState,timestamp,localDate} from './business.js';

export {intakeHolder};
const adminOnly=actor=>{if(!isAdmin(actor))throw Error('Bu amal faqat Otabek uchun.');};
const person=id=>DEFAULT_PEOPLE.some(p=>p.id===id);
const atomic=(state,fn)=>{const draft=prepareState(structuredClone(state));const result=fn(draft);Object.assign(state,draft);return result;};
const clean=(value,max)=>String(value??'').trim().replace(/\s+/g,' ').slice(0,max+1);
const name=(state,id)=>people(state).find(p=>p.id===id)?.name||id;

function nextCode(state){
  let n=1001+state.intakes.length;
  while(state.intakes.some(i=>i.code==='K-'+n))n++;
  return 'K-'+n;
}
function tell(state,to,text,ref,at){
  state.inbox.unshift({id:uid(),to,kind:'intake',ref,text,at:timestamp(at),read:false});
}
const remaining=intake=>intake.lines.reduce((sum,l)=>sum+Math.max(0,l.qty-l.doneQty),0);
export const intakeRemaining=remaining;

export function createIntake(state,data,actor,at=new Date()){
  adminOnly(actor);
  if(!person(data?.worker))throw Error('Kirimni topshiradigan xodimni tanlang.');
  const note=clean(data.note,500);
  if(note.length>500)throw Error('Izoh 500 belgidan oshmasin.');
  if(!Array.isArray(data.lines)||!data.lines.length||data.lines.length>50)throw Error('Kamida bitta, ko‘pi bilan 50 ta qator kiriting.');
  return atomic(state,draft=>{
    const lines=data.lines.map(row=>{
      const product=row.productId?draft.products.find(p=>p.id===row.productId&&!p.archivedAt):null;
      if(row.productId&&!product)throw Error('Tanlangan mahsulot topilmadi.');
      const label=clean(row.label||(product?`${product.name} · ${product.variant}`:''),120);
      if(!label||label.length>120)throw Error('Har qatorga nima kelgani yoziladi (120 belgigacha).');
      if(!Number.isSafeInteger(row.qty)||row.qty<1||row.qty>100000)throw Error('Kutilayotgan sonni butun son bilan kiriting.');
      return {id:uid(),label,productId:product?.id||null,qty:row.qty,doneQty:0};
    });
    const intake={id:uid(),code:nextCode(draft),worker:data.worker,note,createdBy:actor,at:timestamp(at),date:localDate(at),status:'open',lines,assignments:[{worker:data.worker,at:timestamp(at),by:actor}]};
    draft.intakes.push(intake);
    log(draft,actor,`${intake.code} · kirim ${name(draft,intake.worker)}ga topshirildi (${lines.length} qator)`);
    if(intake.worker!==actor)tell(draft,intake.worker,`${intake.code}: sizga ${lines.reduce((a,l)=>a+l.qty,0)} dona kirim topshirildi.`,intake.id,at);
    return intake;
  });
}

export function reassignIntake(state,id,worker,actor,at=new Date()){
  adminOnly(actor);
  if(!person(worker))throw Error('Xodimni tanlang.');
  return atomic(state,draft=>{
    const intake=draft.intakes.find(i=>i.id===id);
    if(!intake||intake.status!=='open')throw Error('Faol kirim topshirig‘i topilmadi.');
    if(intake.worker===worker)throw Error('Topshiriq allaqachon shu xodimda.');
    const previous=intake.worker;
    intake.worker=worker;intake.assignments.push({worker,at:timestamp(at),by:actor});
    log(draft,actor,`${intake.code} · ${name(draft,previous)}dan ${name(draft,worker)}ga o‘tkazildi`);
    if(worker!==actor)tell(draft,worker,`${intake.code}: sizga ${remaining(intake)} dona kirim topshirildi.`,intake.id,at);
    return intake;
  });
}

export function cancelIntake(state,id,note,actor,at=new Date()){
  adminOnly(actor);
  const reason=clean(note,300);
  if(!reason||reason.length>300)throw Error('Bekor qilish sababini yozing.');
  return atomic(state,draft=>{
    const intake=draft.intakes.find(i=>i.id===id);
    if(!intake||intake.status!=='open')throw Error('Faol kirim topshirig‘i topilmadi.');
    intake.status='cancelled';intake.cancelledAt=timestamp(at);intake.cancelReason=reason;
    log(draft,actor,`${intake.code} · kirim topshirig‘i bekor qilindi: ${reason}`);
    // Goods already received stay in stock; only the open task ends.
    return intake;
  });
}

// mode: 'purchase' adds a lot to the line's product, 'product' registers one new
// product, 'groups' registers case groups. All three also tag the new receipts.
export function receiveIntake(state,{intakeId,lineId,mode,data},actor,at=new Date()){
  return atomic(state,draft=>{
    const intake=draft.intakes.find(i=>i.id===intakeId);
    if(!intake||intake.status!=='open')throw Error('Faol kirim topshirig‘i topilmadi.');
    if(intake.worker!==actor&&!isAdmin(actor))throw Error(`Bu kirim ${name(draft,intake.worker)}ga topshirilgan.`);
    const line=intake.lines.find(l=>l.id===lineId);
    if(!line)throw Error('Kirim qatori topilmadi.');
    const before=draft.purchases.length;
    let produced;
    if(mode==='purchase'){
      if(!line.productId)throw Error('Bu qator yangi mahsulot uchun: mahsulotni ro‘yxatga oling.');
      purchase(draft,line.productId,data?.qty,data?.cost,'Naqd',actor);
      if(data?.note)draft.purchases.at(-1).note=clean(data.note,500);
    }else if(mode==='product'){
      produced=registerProduct(draft,{...data,account:CASH_ACCOUNT},actor);
      if(!line.productId)line.productId=produced.id;
    }else if(mode==='groups'){
      produced=registerCaseGroups(draft,{...data,payment:'Naqd'},actor);
    }else throw Error('Kirim turini tanlang.');
    const created=draft.purchases.slice(before);
    const received=created.reduce((sum,p)=>sum+p.qty,0);
    if(!received)throw Error('Kirim yozilmadi.');
    for(const entry of created){entry.intakeId=intake.id;entry.lineId=line.id;}
    line.doneQty+=received;
    const finished=intake.lines.every(l=>l.doneQty>=l.qty);
    if(finished){intake.status='done';intake.doneAt=timestamp(at);}
    log(draft,actor,`${intake.code} · ${received} dona qabul qilindi: ${line.label}${finished?' · topshiriq yakunlandi':''}`);
    if(actor!=='aziz')draft.notices.unshift({id:uid(),actor,text:`${intake.code}: ${received} dona kirim kiritildi (${line.label})${finished?' · topshiriq yakunlandi':''}`,at:timestamp(at),read:false});
    return {intakeId:intake.id,lineId:line.id,received,status:intake.status,produced:produced??null};
  });
}

// "Who entered what": every active receipt grouped by the person who entered it.
export function entriesByWorker(state,{from='2000-01-01',to='9999-12-31'}={}){
  return people(state).map(p=>{
    const entries=(state.purchases||[]).filter(x=>x.actor===p.id&&!x.deletedAt&&x.date>=from&&x.date<=to).map(x=>{
      const product=state.products.find(item=>item.id===x.productId);
      return {id:x.id,date:x.date,productId:x.productId,sku:product?.sku||'',name:product?[product.name,product.variant].filter(Boolean).join(' · '):'',qty:x.qty,cost:x.cost,intakeId:x.intakeId||null};
    }).sort((a,b)=>b.date.localeCompare(a.date));
    return {worker:p.id,name:p.name,units:entries.reduce((sum,e)=>sum+e.qty,0),entries};
  });
}
