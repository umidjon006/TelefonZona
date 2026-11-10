import {log,uid} from './model.js';
import {BRANDS,QUALITY_TIERS} from './catalog.js';
import {DEFAULT_PEOPLE,PERMISSIONS,ensureAccess,isAdmin} from './access.js';

export const DEFAULT_MATERIALS=['Karbon','Silikon','Shaffof','Charm','Boshqa'];
export const DEFAULT_CATEGORIES=['G‘iloflar','Quvvatlagichlar','Kabellar','Quloqchinlar','Himoya oynalari','Aqlli soatlar','Soat aksessuarlari','Avto aksessuarlar'];
export const catalog=state=>({categories:DEFAULT_CATEGORIES,materials:DEFAULT_MATERIALS,qualities:QUALITY_TIERS,brands:BRANDS,...state?.settings?.catalog});
export function prepareAdmin(state){
  ensureAccess(state);
  state.settings.catalog ||= {};
  for(const [key,defaults] of Object.entries({categories:DEFAULT_CATEGORIES,materials:DEFAULT_MATERIALS,qualities:QUALITY_TIERS,brands:BRANDS})) {
    state.settings.catalog[key] ||= structuredClone(defaults);
  }
  // Retained product types stay available after migration or backup restoration.
  for(const p of state.products||[]) {
    if(p.category&&!state.settings.catalog.categories.includes(p.category))state.settings.catalog.categories.push(p.category);
    if(p.material&&!state.settings.catalog.materials.includes(p.material))state.settings.catalog.materials.push(p.material);
  }
  return state;
}
function adminOnly(actor){if(!isAdmin(actor))throw Error('Boshqaruvni faqat Otabek sozlaydi.');}
function cleanName(name){const value=String(name||'').trim().replace(/\s+/g,' ');if(!value||value.length>60)throw Error('Nomni 1–60 belgida yozing.');return value;}
const key=value=>value.normalize('NFKC').toLocaleLowerCase().replace(/[‘’ʻʼ']/g,'').replace(/\s+/g,' ').trim();
export function addCatalogOption(state,kind,input,actor){
  adminOnly(actor);const name=cleanName(input);
  if(!['categories','materials','qualities','brands'].includes(kind))throw Error('Mahsulot turi bo‘limini tanlang.');
  const entries=catalog(state)[kind];
  if(entries.some(item=>key(typeof item==='string'?item:item.name)===key(name)))throw Error('Bu nom allaqachon bor.');
  prepareAdmin(state);
  const entry=['qualities','brands'].includes(kind)?{id:'custom-'+uid(),name,...(kind==='brands'?{mark:name}:{})}:name;
  state.settings.catalog[kind].push(entry);
  log(state,actor,'Yangi mahsulot tasnifi qo‘shildi: '+name);return entry;
}
export function saveStaffPermissions(state,personId,name,permissions,actor){
  adminOnly(actor);
  if(isAdmin(personId)||!DEFAULT_PEOPLE.some(p=>p.id===personId))throw Error('Sotuvchini tanlang. Boshliq ruxsatlari o‘zgarmaydi.');
  const value=cleanName(name);
  if(!/^[\p{L}\p{N}\s‘’ʻʼ'.-]+$/u.test(value))throw Error('Xodim ismida faqat harf, raqam va ism belgilarini ishlating.');
  if(Object.keys(permissions).some(id=>!PERMISSIONS.some(p=>p.id===id))||Object.values(permissions).some(v=>typeof v!=='boolean'))throw Error('Ruxsatlar ro‘yxatini tekshiring. Umumiy hisobotlar faqat boshliqqa tegishli.');
  if(permissions.products)permissions={...permissions,stock:true};
  prepareAdmin(state);
  const person=state.settings.people.find(p=>p.id===personId);
  person.name=value;person.initials=value.slice(0,2).toLocaleUpperCase();
  state.settings.permissions[personId]=Object.fromEntries(PERMISSIONS.map(p=>[p.id,permissions[p.id]??false]));
  log(state,actor,value+' ismi va amallar ruxsatlari yangilandi');
}
