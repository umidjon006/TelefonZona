import {requirePermission} from './access.js';
import {catalog} from './admin.js';
import { OWNERS, uid, purchase, log } from './model.js';
import { normalizeSearch, qualityName } from './catalog.js';
import { AUDIENCES } from './business.js';


function validInteger(value, max) {
  return Number.isSafeInteger(value) && value > 0 && value <= max;
}

export function registerProduct(state,data,actor){
  requirePermission(state,actor,'products');requirePermission(state,actor,'stock');
  const name=String(data.name||'').trim(),variant=String(data.variant||'').trim(),note=String(data.note||'').trim(),config=catalog(state);
  if(!name||name.length>60||!variant||variant.length>90||!note||note.length>500||!OWNERS.some(o=>o.id===data.owner)
    ||!config.categories.includes(data.category)||!config.brands.some(b=>b.id===data.brand)||data.quality&&!config.qualities.some(q=>q.id===data.quality)
    ||!['till1','till2','bank'].includes(data.account)||!validInteger(data.qty,100000)||!validInteger(data.cost,1e9)||!validInteger(data.price,1e9)
    ||!Number.isSafeInteger(data.minPrice)||data.minPrice<0||data.minPrice>data.price||!Number.isSafeInteger(data.min)||data.min<0||data.min>100000)throw Error('Mahsulot, egasi, tanlangan tur va narxlarni tekshiring.');
  const draft=structuredClone(state);let suffix=1001+draft.products.length;
  while(draft.products.some(p=>p.sku==='TZ-'+suffix))suffix++;
  const product={id:uid(),sku:'TZ-'+suffix,name,variant,brand:data.brand,category:data.category,quality:data.quality||'',qualityLabel:qualityName(data.quality,state),
    owner:data.owner,price:data.price,minPrice:data.minPrice,min:data.min,lots:[]};
  draft.products.push(product);purchase(draft,product.id,data.qty,data.cost,data.account==='bank'?'Karta':'Naqd',actor);
  Object.assign(draft.purchases.at(-1),{account:data.account,note});
  Object.assign(state,{products:draft.products,purchases:draft.purchases,audit:draft.audit});return product;
}

export function setCatalogPrice(state, productId, price, actor, minPrice=price) {
  requirePermission(state,actor,'prices');
  const product = state.products.find(product=>product.id===productId);
  if (!product || !validInteger(price, 1e9) || !Number.isSafeInteger(minPrice) || minPrice<0 || minPrice>price) throw Error('Narx oralig‘ini tekshiring: eng kam narx yuqori narxdan oshmasin.');
  const previous = product.price;
  product.price=price;
  product.minPrice=minPrice;
  log(state,actor,`${product.sku} · tavsiya narxi ${previous} → ${price} so‘m`);
}

// Each model, quality tier and owner has its own stock group. Designs and colors
// are pooled only when the shop owner explicitly uses this grouped-entry form.
export function registerCaseGroups(state, data, actor) {
  requirePermission(state,actor,'products');
  requirePermission(state,actor,'stock');
  // Blank values keep older grouped stock separate from explicitly classified stock.
  const audience=data.audience||'',material=data.material||'';
  if(audience&&!AUDIENCES.some(([id])=>id===audience)||material&&!catalog(state).materials.includes(material))throw Error('Kim uchun va g‘ilof turini tanlang.');
  const model = String(data.model || '').trim().replace(/\s+/g,' ');
  if (!model || model.length > 60 || !catalog(state).brands.some(brand=>brand.id===data.brand)
    || !OWNERS.some(owner=>owner.id===data.owner)
    || !['Naqd','Karta','O‘tkazma'].includes(data.payment)) {
    throw Error('Brend, model, mahsulot egasi va to‘lov turini tekshiring.');
  }
  if (!Array.isArray(data.rows) || !data.rows.length || data.rows.length > catalog(state).qualities.length) throw Error('Kamida bitta sifat guruhini kiriting.');
  const tiers = new Set();
  for (const row of data.rows) {
    if (!qualityName(row.quality,state) || tiers.has(row.quality) || !validInteger(row.qty,100000)
      || !validInteger(row.cost,1e9) || !validInteger(row.price,1e9)
      || row.minPrice!==undefined&&(!Number.isSafeInteger(row.minPrice)||row.minPrice<0||row.minPrice>row.price)) {
      throw Error('Har bir tanlangan guruh uchun soni, tannarxi va tavsiya narxi musbat butun son bo‘lsin.');
    }
    tiers.add(row.quality);
  }

  // Validate and apply all rows to a draft so an invalid row cannot leave a partial receipt.
  const brandKey=normalizeSearch(catalog(state).brands.find(brand=>brand.id===data.brand).name);
  const modelKey=value=>{
    const key=normalizeSearch(value);
    return key.startsWith(brandKey)?key.slice(brandKey.length):key;
  };
  const draft = structuredClone(state);
  const result=[];
  for (const row of data.rows) {
    const matches=draft.products.filter(product=>product.grouped===true && product.brand===data.brand
      && modelKey(product.model)===modelKey(model) && product.quality===row.quality
      && product.owner===data.owner && (product.audience||'')===audience
      && (product.material||'')===material && product.category==='G‘iloflar');
    if (matches.length > 1) throw Error('Bu model va sifat guruhida takrorlangan yozuv bor. Avval ularni tekshiring.');
    let product=matches[0];
    if (!product) {
      let suffix=1001+draft.products.length;
      while (draft.products.some(item=>item.sku==='TZ-'+suffix)) suffix++;
      product={id:uid(),sku:'TZ-'+suffix,brand:data.brand,model,name:material?material+' g‘ilof':'G‘ilof',quality:row.quality,qualityLabel:qualityName(row.quality,state),audience,material,
        grouped:true,variant:model+' · turli rang va naqshlar',category:'G‘iloflar',owner:data.owner,
        price:row.price,minPrice:row.minPrice??row.price,min:5,lots:[]};
      draft.products.push(product);
    } else if (product.price !== row.price || product.minPrice !== (row.minPrice??row.price)) {
      setCatalogPrice(draft,product.id,row.price,actor,row.minPrice??row.price);
    }
    purchase(draft,product.id,row.qty,row.cost,data.payment,actor);
    if(data.account) {
      if(!['till1','till2','bank'].includes(data.account))throw Error('Pul hisobini tanlang.');
      draft.purchases.at(-1).account=data.account;
    }
    result.push({id:product.id,quality:row.quality,qty:row.qty});
  }
  log(draft,actor,`${model} · ${data.rows.length} ta sifat guruhida g‘iloflar kiritildi`);
  state.products=draft.products;
  state.purchases=draft.purchases;
  state.audit=draft.audit;
  return result;
}
