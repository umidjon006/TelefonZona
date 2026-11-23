// Reminders are derived from the current records every time they are asked for,
// so they never go stale and need no scheduler. They reach every signed-in person.
import {can} from './access.js';
import {debtReminders,localDate} from './business.js';
import {intakeRemaining} from './intake.js';

const group=n=>String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g,' ');
const dayNumber=date=>Math.round(Date.parse(date+'T12:00:00+05:00')/86400000);

export function remindersFor(state,actor,at=new Date()){
  const today=localDate(at),items=[];
  for(const debt of debtReminders(state,at)){
    const due=debt.due||today,days=Math.max(0,dayNumber(today)-dayNumber(due)),late=days>0;
    const entry={id:`debt:${debt.id}:${today}`,kind:'debt',level:late?'overdue':'today',customer:debt.customer,amount:debt.balance,due,days,
      text:late?`${debt.customer} qarzini ${days} kun kechiktirdi · ${group(debt.balance)} so‘m`:`Bugun ${debt.customer} qarzini berishi kerak · ${group(debt.balance)} so‘m`};
    // Contact details and the repay shortcut only for people who may take debt payments.
    if(can(state,actor,'debts')){entry.debtId=debt.id;entry.phone=debt.phone;}
    items.push(entry);
  }
  for(const intake of state.intakes||[])if(intake.status==='open'&&intake.worker===actor)
    items.push({id:'intake:'+intake.id,kind:'intake',level:'task',intakeId:intake.id,text:`${intake.code}: ${intakeRemaining(intake)} dona kirim kutilmoqda`});
  for(const note of state.inbox||[])if(note.to===actor&&!note.read)items.push({id:'inbox:'+note.id,kind:'inbox',level:'info',inboxId:note.id,text:note.text,at:note.at});
  const rank={overdue:0,today:1,task:2,info:3};
  return items.sort((a,b)=>rank[a.level]-rank[b.level]||(b.days||0)-(a.days||0));
}
