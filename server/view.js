import {can,isAdmin} from '../src/access.js';

// A single receipt looked up by number (a seller may open a colleague's receipt
// to answer a customer) never carries cost or the lots it consumed.
export function receiptFor(state,actor,id){
  const sale=state.sales.find(s=>s.id===id);
  if(!sale)return null;
  if(isAdmin(actor))return sale;
  return {...sale,items:sale.items.map(({cost,alloc,commission,...item})=>item)};
}

// What a person's device may receive. Otabek gets everything. A seller gets the
// shared workplace (products, debts) and only their own receipts, cash entries,
// services and receipts of goods. Reports, audit, rent, closings and owner-only
// settings never leave the server for a seller.
export function viewFor(state,actor,version){
  if(isAdmin(actor))return {...state,version:state.version,serverVersion:version};
  const mayCost=can(state,actor,'stock')||can(state,actor,'products');
  const strip=(entry,fields)=>{const copy={...entry};for(const f of fields)delete copy[f];return copy;};
  const mine=(list,...keys)=>(list||[]).filter(x=>keys.some(k=>x[k]===actor));
  const settings=state.settings;
  return {
    version:state.version,
    serverVersion:version,
    scope:'staff',
    products:state.products.map(p=>({...p,lots:p.lots.map(l=>mayCost?l:{id:l.id,qty:l.qty,date:l.date})})),
    sales:mine(state.sales,'seller').map(sale=>({...sale,items:sale.items.map(item=>strip(item,['cost','alloc','commission']))})),
    purchases:mine(state.purchases,'actor').map(x=>mayCost?x:strip(x,['cost'])),
    movements:can(state,actor,'cash')?mine(state.movements,'actor'):[],
    debts:can(state,actor,'debts')?state.debts:[],
    services:mine(state.services,'worker','actor'),
    defects:mine(state.defects,'actor').map(x=>strip(x,['cost','alloc'])),
    intakes:mine(state.intakes,'worker'),
    inbox:mine(state.inbox,'to'),
    expenses:[],payouts:[],closings:[],audit:[],rents:[],notices:[],operations:[],
    settings:{
      shop:settings.shop,
      people:settings.people,
      permissions:{[actor]:settings.permissions?.[actor]||{}},
      catalog:settings.catalog,
      caseCategory:settings.caseCategory,
      sharedWorkplaceVersion:settings.sharedWorkplaceVersion,
      openingAccounts:{cash:0},
    },
  };
}
