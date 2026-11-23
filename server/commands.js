// Every state change is one named command. The person who runs it always comes
// from the signed-in session, never from the request, and the shared domain code
// (the same modules the browser uses) re-checks permissions and every invariant.
import {CASH_ACCOUNT,log,purchase} from '../src/model.js';
import {recordSale,repayDebt,returnSale,recordFlow,setRent,payRent,setOpeningBalances,addOpeningDebt,closeDay,reverseMovement,disposeStock} from '../src/business.js';
import {saveService,deleteService,updateProduct,archiveProduct,updateDebt,deleteOpeningDebt,correctMovement,correctSale,updatePurchase,deleteRent,updateClosing,updateDefect} from '../src/management.js';
import {registerProduct,registerCaseGroups,setCatalogPrice,setLowStockLimit} from '../src/inventory-entry.js';
import {addCatalogOption,changeCatalogOption,saveStaffPermissions,renameAdmin} from '../src/admin.js';
import {createIntake,reassignIntake,cancelIntake,receiveIntake} from '../src/intake.js';
import {isAdmin} from '../src/access.js';

export class CommandError extends Error{
  constructor(message,status=422){super(message);this.status=status;}
}
const bad=()=>new CommandError('So‘rov ma’lumotlari noto‘g‘ri yoki to‘liq emas.',400);
const object=value=>{if(!value||typeof value!=='object'||Array.isArray(value))throw bad();return value;};
const list=value=>{if(!Array.isArray(value))throw bad();return value;};
const text=(value,max=500)=>{if(typeof value!=='string'||value.length>max)throw bad();return value;};
const flag=value=>value===true;

// boss:true commands are refused before running for anyone but Otabek.
const COMMANDS={
  // Sales and receipts
  'sale.record':{run:(s,a,u)=>recordSale(s,list(a.cart),u,{...object(a.data??{}),account:CASH_ACCOUNT,received:a.received})},
  'sale.correct':{run:(s,a,u)=>correctSale(s,text(a.id,100),object(a.data),u)},
  'sale.return':{run:(s,a,u)=>returnSale(s,text(a.id,100),u,CASH_ACCOUNT,text(a.note))},
  'sale.delete':{run:(s,a,u)=>returnSale(s,text(a.id,100),u,CASH_ACCOUNT,'Chek o‘chirildi: '+text(a.note))},
  // Debts
  'debt.repay':{run:(s,a,u)=>repayDebt(s,text(a.id,100),a.amount,CASH_ACCOUNT,u,text(a.note))},
  'debt.update':{run:(s,a,u)=>updateDebt(s,text(a.id,100),object(a.data),u)},
  'debt.openingAdd':{boss:true,run:(s,a,u)=>addOpeningDebt(s,object(a.data),u)},
  'debt.openingDelete':{boss:true,run:(s,a,u)=>deleteOpeningDebt(s,text(a.id,100),u,text(a.note))},
  // Cash
  'flow.record':{run:(s,a,u)=>recordFlow(s,object(a.data),u)},
  'movement.reverse':{run:(s,a,u)=>reverseMovement(s,text(a.id,100),u,text(a.note))},
  'movement.correct':{run:(s,a,u)=>correctMovement(s,text(a.id,100),object(a.data),u)},
  'opening.set':{boss:true,run:(s,a,u)=>setOpeningBalances(s,object(a.accounts),object(a.payables??{}),u,text(a.note))},
  'closing.close':{boss:true,run:(s,a,u)=>closeDay(s,object(a.data),u)},
  'closing.update':{boss:true,run:(s,a,u)=>updateClosing(s,text(a.id,100),object(a.data),u,flag(a.remove))},
  'rent.set':{boss:true,run:(s,a,u)=>setRent(s,text(a.month,7),a.amount,text(a.note),u)},
  'rent.pay':{run:(s,a,u)=>payRent(s,text(a.id,100),a.amount,CASH_ACCOUNT,u,text(a.note))},
  'rent.delete':{boss:true,run:(s,a,u)=>deleteRent(s,text(a.id,100),u,text(a.note))},
  // Products and stock
  'product.register':{run:(s,a,u)=>registerProduct(s,{...object(a.data),account:CASH_ACCOUNT},u)},
  'product.groups':{run:(s,a,u)=>registerCaseGroups(s,{...object(a.data),payment:'Naqd'},u)},
  'product.update':{run:(s,a,u)=>updateProduct(s,text(a.id,100),object(a.data),u)},
  'product.archive':{boss:true,run:(s,a,u)=>archiveProduct(s,text(a.id,100),u,a.archive!==false,a.note===undefined?'':text(a.note))},
  'product.price':{run:(s,a,u)=>setCatalogPrice(s,text(a.id,100),a.price,u,a.minPrice??a.price)},
  'product.limit':{run:(s,a,u)=>setLowStockLimit(s,text(a.id,100),a.min,u)},
  'stock.purchase':{run:(s,a,u)=>{purchase(s,text(a.id,100),a.qty,a.cost,'Naqd',u);if(a.note!==undefined)s.purchases.at(-1).note=text(a.note);return s.purchases.at(-1);}},
  'stock.updatePurchase':{boss:true,run:(s,a,u)=>updatePurchase(s,text(a.id,100),object(a.data),u,flag(a.remove))},
  'stock.dispose':{run:(s,a,u)=>disposeStock(s,text(a.id,100),a.qty,text(a.note),u)},
  'defect.update':{boss:true,run:(s,a,u)=>updateDefect(s,text(a.id,100),object(a.data),u,flag(a.remove))},
  // Extra services
  'service.save':{run:(s,a,u)=>saveService(s,object(a.data),u,a.id===undefined?undefined:text(a.id,100))},
  'service.delete':{run:(s,a,u)=>deleteService(s,text(a.id,100),u,text(a.note))},
  // Boss administration
  'catalog.add':{boss:true,run:(s,a,u)=>addCatalogOption(s,text(a.kind,30),text(a.name,100),u)},
  'catalog.change':{boss:true,run:(s,a,u)=>changeCatalogOption(s,text(a.kind,30),text(a.value,100),text(a.name,100),u)},
  'catalog.remove':{boss:true,run:(s,a,u)=>changeCatalogOption(s,text(a.kind,30),text(a.value,100),'',u,true,a.replacement===undefined?'':text(a.replacement,100))},
  'staff.permissions':{boss:true,run:(s,a,u)=>saveStaffPermissions(s,text(a.person,30),text(a.name,60),object(a.permissions),u)},
  'settings.update':{boss:true,run:(s,a,u)=>{
    const shop=text(a.shop,100).trim();
    if(!shop)throw new CommandError('Do‘kon nomini yozing.');
    s.settings.shop=shop;renameAdmin(s,text(a.adminName,60),u);log(s,u,'Do‘kon nomi yangilandi');return {shop};
  }},
  'notices.markRead':{boss:true,run:s=>{s.notices.forEach(n=>{n.read=true;});return {read:s.notices.length};}},
  // Receipt of goods handed to workers
  'intake.create':{boss:true,run:(s,a,u)=>createIntake(s,object(a.data),u)},
  'intake.reassign':{boss:true,run:(s,a,u)=>reassignIntake(s,text(a.id,100),text(a.worker,30),u)},
  'intake.cancel':{boss:true,run:(s,a,u)=>cancelIntake(s,text(a.id,100),text(a.note),u)},
  'intake.receive':{run:(s,a,u)=>receiveIntake(s,{intakeId:text(a.intakeId,100),lineId:text(a.lineId,100),mode:text(a.mode,20),data:object(a.data??{})},u)},
  // Personal inbox
  'inbox.markRead':{run:(s,a,u)=>{
    const ids=a.ids===undefined?null:new Set(list(a.ids).map(id=>text(id,100)));
    let count=0;for(const n of s.inbox)if(n.to===u&&!n.read&&(!ids||ids.has(n.id))){n.read=true;count++;}
    return {read:count};
  }},
};

export const COMMAND_NAMES=Object.keys(COMMANDS);
export const isBossCommand=name=>COMMANDS[name]?.boss===true;

// Keys that could poison objects, plus runaway sizes, are refused outright.
export function assertPlain(value,state={nodes:0},depth=0){
  if(depth>8||++state.nodes>20000)throw bad();
  if(typeof value==='string'){if(value.length>5000)throw bad();return;}
  if(typeof value==='number'){if(!Number.isFinite(value))throw bad();return;}
  if(value===null||typeof value==='boolean'||value===undefined)return;
  if(typeof value!=='object')throw bad();
  if(Array.isArray(value)){for(const v of value)assertPlain(v,state,depth+1);return;}
  for(const [key,v] of Object.entries(value)){
    if(key==='__proto__'||key==='constructor'||key==='prototype')throw bad();
    assertPlain(v,state,depth+1);
  }
}

export function runCommand(state,name,args,actor){
  const command=Object.hasOwn(COMMANDS,name)?COMMANDS[name]:null;
  if(!command)throw new CommandError('Noma’lum amal.',404);
  if(command.boss&&!isAdmin(actor))throw new CommandError('Bu amal faqat Otabek uchun.',403);
  assertPlain(args);
  const result=command.run(state,object(args??{}),actor);
  return result===undefined?null:result;
}
