// Stable IDs preserve existing receipts; display names are shop configuration.
export const ADMIN_ID='aziz';
export const DEFAULT_PEOPLE=[
  {id:ADMIN_ID,name:'Otabek',role:'Boshliq',initials:'OT'},
  {id:'sardor',name:'Boybek',role:'Sotuvchi · mahsulot egasi',initials:'BO'},
  {id:'jasur',name:'Asilbek',role:'Sotuvchi · mahsulot egasi',initials:'AS'},
];
export const PERMISSIONS=[
  {id:'sell',label:'Sotuvni rasmiylashtirish',default:true},
  {id:'credit',label:'Nasiya savdo qilish',default:true},
  {id:'priceException',label:'Narx oralig‘idan tashqarida sotish',default:true},
  {id:'inventory',label:'Mahsulotlar va qoldiqni ko‘rish',default:true},
  {id:'products',label:'Mahsulot qo‘shish va tahrirlash · tannarx kiritiladi',default:true},
  {id:'services',label:'Qo‘shimcha xizmat foydasini kiritish',default:true},
  {id:'stock',label:'Tovar kirimi · tannarx bilan',default:true},
  {id:'prices',label:'Katalog narx oralig‘ini o‘zgartirish',default:false},
  {id:'cash',label:'Izohli kirim va chiqim yozish',default:true},
  {id:'debts',label:'Qarzdorlarni ko‘rish va to‘lov olish',default:true},
  {id:'returns',label:'Chekni qaytarish / almashtirish',default:true},
  {id:'defects',label:'Nuqsonni qayd etish',default:true},
  {id:'reverse',label:'O‘z pul yozuvini bekor qilish',default:true},
];
export function people(state){return DEFAULT_PEOPLE.map(person=>{
  const name=state?.settings?.people?.find(p=>p.id===person.id)?.name||person.name;
  return {...person,name,initials:name.slice(0,2).toLocaleUpperCase()};
});}
export function owners(state){return people(state);}
export function isAdmin(actor){return actor===ADMIN_ID;}
export function can(state,actor,permission){
  if(!DEFAULT_PEOPLE.some(p=>p.id===actor))return false;
  if(isAdmin(actor))return true;
  // Reports and administration cannot be delegated from this screen.
  const definition=PERMISSIONS.find(p=>p.id===permission);
  if(!definition)return false;
  const value=state?.settings?.permissions?.[actor]?.[permission];
  return value===undefined?definition.default:value===true;
}
export function requirePermission(state,actor,permission){
  if(!can(state,actor,permission))throw Error('Bu amal uchun Otabek ruxsati kerak.');
}
export function ensureAccess(state){
  state.settings ||= {};
  state.settings.people ||= structuredClone(DEFAULT_PEOPLE);
  state.settings.permissions ||= {};
  for(const person of DEFAULT_PEOPLE.filter(p=>!isAdmin(p.id))) {
    state.settings.permissions[person.id] ||= {};
    for(const permission of PERMISSIONS)state.settings.permissions[person.id][permission.id]??=permission.default;
  }
  if(!state.settings.sharedWorkplaceVersion){
    // Earlier releases stored false as the default. Preserve intentional owner choices.
    const customized=(state.audit||[]).some(a=>a.text?.includes('ismi va amallar ruxsatlari yangilandi'));
    if(!customized)for(const person of DEFAULT_PEOPLE.filter(p=>!isAdmin(p.id))){state.settings.permissions[person.id].products=true;state.settings.permissions[person.id].stock=true;}
    state.settings.sharedWorkplaceVersion=1;
  }
  return state;
}
export function canVisit(state,actor,page){
  if(!DEFAULT_PEOPLE.some(p=>p.id===actor))return false;
  if(isAdmin(actor))return true;
  if(['dashboard','settings','sales','intake'].includes(page))return true;
  const gate={pos:'sell',inventory:'inventory',lowstock:'inventory',cash:'cash',debts:'debts',services:'services'}[page];
  return !!gate&&can(state,actor,gate);
}
