import {can,isAdmin,people} from '../src/access.js';
import {AUDIENCES} from '../src/business.js';
import {viewFor} from './view.js';
import {group} from './effects.js';

export class ToolError extends Error{}

export const asNumber=(value,label,{min,max,def})=>{
  if(value===undefined||value===null)return def;
  if(!Number.isInteger(value)||value<min||value>max)throw new ToolError(`${label} ${min} dan ${max} gacha butun son bo‘lsin.`);
  return value;
};
export const asEnum=(value,label,allowed,def)=>{
  if(value===undefined||value===null)return def;
  if(!allowed.includes(value))throw new ToolError(`${label}: ${allowed.join(', ')} dan birini tanlang.`);
  return value;
};
export const asText=(value,label,max=80)=>{
  if(value===undefined||value===null||value==='')return '';
  if(typeof value!=='string'||value.length>max)throw new ToolError(`${label} matn bo‘lishi va ${max} belgidan oshmasligi kerak.`);
  return value.trim();
};
export const asBool=(value,label)=>{
  if(value===undefined||value===null)return false;
  if(typeof value!=='boolean')throw new ToolError(`${label} true yoki false bo‘lsin.`);
  return value;
};

// Strict inputs for anything that is written. Amounts must arrive as real whole numbers: a text such as
// "20.000" is ambiguous (twenty or twenty thousand) and is refused instead of guessed.
export const exactInt=(value,label,{min=1,max=1e12,optional=false}={})=>{
  if(value===undefined||value===null){
    if(optional)return undefined;
    throw new ToolError(`${label} kerak.`);
  }
  if(typeof value!=='number'||!Number.isSafeInteger(value))
    throw new ToolError(`${label} butun son (raqam) bo‘lishi kerak: matn, kasr yoki ajratuvchili yozuv emas. Masalan 20000. Summani foydalanuvchi bilan aniqlab oling.`);
  if(value<min||value>max)throw new ToolError(`${label} ${group(min)} dan ${group(max)} gacha bo‘lsin.`);
  return value;
};
export const exactText=(value,label,{min=1,max=200,optional=false}={})=>{
  if(value===undefined||value===null||value===''){
    if(optional)return '';
    throw new ToolError(`${label} kerak.`);
  }
  if(typeof value!=='string')throw new ToolError(`${label} matn bo‘lishi kerak.`);
  const text=value.replace(/\s+/g,' ').trim();
  if(/[\u0000-\u001f]/.test(value)||text.length<min||text.length>max)throw new ToolError(`${label} ${min} dan ${max} belgigacha oddiy matn bo‘lsin.`);
  return text;
};
export const exactEnum=(value,label,allowed)=>{
  if(!allowed.includes(value))throw new ToolError(`${label}: ${allowed.join(', ')} dan birini tanlang.`);
  return value;
};

export const label=p=>[p.model||p.name,AUDIENCES.find(([v])=>v===p.audience)?.[1],p.material,p.qualityLabel,p.grouped?null:p.variant].filter(Boolean).join(' · ');

export function context(store,actor){
  const {state}=store.read();
  const admin=isAdmin(actor);
  const data=admin?state:viewFor(state,actor,0);
  const nameOf=id=>people(state).find(p=>p.id===id)?.name||id;
  const personId=value=>{
    const needle=String(value||'').trim().toLowerCase();
    return people(state).find(p=>p.id===needle||p.name.toLowerCase()===needle)?.id||null;
  };
  return {actor,admin,state,data,nameOf,personId,can:permission=>admin||can(state,actor,permission),mayCost:admin||can(state,actor,'stock')||can(state,actor,'products')};
}
export const adminOnly=ctx=>{if(!ctx.admin)throw new ToolError('Bu ma’lumot faqat Otabek uchun.');};

// A field the tool does not know is never ignored silently: it could be a number Claude meant to
// give (a discount, a different price name) that would otherwise be read as something else.
export function rejectUnknown(schema,value,path='args'){
  if(!schema||typeof value!=='object'||value===null)return;
  if(schema.type==='object'&&schema.properties&&!Array.isArray(value)){
    for(const key of Object.keys(value)){
      if(!Object.hasOwn(schema.properties,key))throw new ToolError(`${path}.${key} maydoni mavjud emas. Faqat shular mumkin: ${Object.keys(schema.properties).join(', ')}. Hech narsa tayyorlanmadi.`);
    }
    for(const [key,sub] of Object.entries(schema.properties))if(value[key]!==undefined)rejectUnknown(sub,value[key],`${path}.${key}`);
  }else if(schema.type==='array'&&Array.isArray(value)&&schema.items){
    value.forEach((item,index)=>rejectUnknown(schema.items,item,`${path}[${index}]`));
  }
}
