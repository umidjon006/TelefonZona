import test from 'node:test';
import assert from 'node:assert/strict';
import {makeSeed,stock,purchase,checkout} from '../src/model.js';
import {prepareState,recordSale,recordFlow,repayDebt,returnSale,disposeStock,reverseMovement,canReverseMovement,accountBalances,businessReport} from '../src/business.js';
import {DEFAULT_PEOPLE,PERMISSIONS,can,canVisit,people,owners} from '../src/access.js';
import {addCatalogOption,saveStaffPermissions,catalog} from '../src/admin.js';
import {registerCaseGroups,setCatalogPrice,registerProduct} from '../src/inventory-entry.js';
import {selectCartOwner} from '../src/ownership.js';
import {readBackup} from '../src/backup.js';

const at=new Date('2026-11-10T12:00:00+05:00');
const fresh=()=>{const s=makeSeed();for(const key of ['sales','expenses','purchases','payouts','closings','audit'])s[key]=[];return prepareState(s);};
const permissions=changes=>Object.fromEntries(PERMISSIONS.map(p=>[p.id,changes[p.id]??p.default]));
const grant=(s,id,changes)=>saveStaffPermissions(s,id,people(s).find(p=>p.id===id).name,permissions(changes),'aziz');
const row={quality:'standard',qty:5,cost:20000,minPrice:25000,price:30000};
const group=(s,owner,extra={})=>registerCaseGroups(s,{brand:'apple',model:'iPhone 16 Pro',audience:'men',material:'Karbon',owner,payment:'Naqd',rows:[row],...extra},'aziz')[0].id;

test('migration corrects names and adds the third owner without reassigning historical stock or sellers',()=>{
  const s=makeSeed(),before=JSON.stringify({products:s.products,sales:s.sales});prepareState(s);
  assert.deepEqual(people(s).map(p=>p.name),['Otabek','Boybek','Asilbek']);assert.equal(owners(s).length,3);
  assert.equal(JSON.stringify({products:s.products,sales:s.sales}),before);
  const next=structuredClone(s);prepareState(next);assert.deepEqual(next,s);
});
test('only Otabek can view any aggregate report or administration, even if an untrusted flag claims otherwise',()=>{
  const s=fresh();
  for(const id of ['sardor','jasur'])for(const page of ['reports','employees','admin'])assert.equal(canVisit(s,id,page),false);
  s.settings.permissions.sardor.reports=true;assert.equal(can(s,'sardor','reports'),false);assert.equal(canVisit(s,'sardor','reports'),false);
  for(const page of ['reports','employees','admin'])assert.equal(canVisit(s,'aziz',page),true);
  assert.equal(can(s,'missing','sell'),false);
});
test('staff cannot reconfigure categories, their own permissions, or the permanent administrator',()=>{
  const s=fresh(),before=JSON.stringify(s);
  assert.throws(()=>addCatalogOption(s,'categories','Powerbank','jasur'));
  assert.throws(()=>saveStaffPermissions(s,'jasur','Asilbek',permissions({}),'jasur'));
  assert.throws(()=>saveStaffPermissions(s,'aziz','Otabek',permissions({sell:false}),'aziz'));
  assert.throws(()=>saveStaffPermissions(s,'jasur','Asilbek',{reports:true},'aziz'));
  assert.equal(JSON.stringify(s),before);
});
test('configuration adds categories, materials, brands and more than four quality tiers and survives backup restore',()=>{
  const s=fresh();addCatalogOption(s,'categories','Powerbank','aziz');addCatalogOption(s,'materials','Mat','aziz');
  const brand=addCatalogOption(s,'brands','Baseus','aziz'),quality=addCatalogOption(s,'qualities','Original','aziz');
  const id=group(s,'jasur',{brand:brand.id,material:'Mat',rows:[{...row,quality:quality.id}]});
  assert.equal(stock(s.products.find(p=>p.id===id)),5);assert.equal(s.products.find(p=>p.id===id).owner,'jasur');
  const product=registerProduct(s,{name:'20 000 mAh',variant:'USB-C · qora',brand:brand.id,category:'Powerbank',quality:quality.id,owner:'jasur',qty:2,cost:10000,price:20000,minPrice:15000,min:1,account:'till2',note:'Sinov kirimi'},'aziz');assert.equal(product.category,'Powerbank');assert.equal(product.owner,'jasur');assert.equal(stock(product),2);
  const restored=readBackup(JSON.stringify(s));assert.deepEqual(catalog(restored),catalog(s));assert.equal(catalog(s).qualities.length,5);
  const snapshot=JSON.stringify(s);assert.throws(()=>addCatalogOption(s,'categories',' powerbank ','aziz'));assert.equal(JSON.stringify(s),snapshot);
});
test('permission changes protect the operation functions as well as navigation and can later be granted',()=>{
  const s=fresh();grant(s,'jasur',{sell:false,cash:false,debts:false,returns:false,defects:false,reverse:false});
  let snapshot=JSON.stringify(s);
  for(const action of [()=>recordSale(s,[{productId:'p0',qty:1,price:85000}],'jasur',{account:'till1',received:85000},at),()=>checkout(s,[{productId:'p0',qty:1,price:85000}],'jasur','Naqd'),()=>recordFlow(s,{kind:'income',account:'till1',amount:1000,note:'Sinov'},'jasur',at),()=>disposeStock(s,'p0',1,'Sinov','jasur',at),()=>returnSale(s,'missing','jasur','till1','Sinov',at),()=>repayDebt(s,'missing',1,'till1','jasur','Sinov',at)])assert.throws(action);
  assert.equal(JSON.stringify(s),snapshot);assert.equal(canVisit(s,'jasur','pos'),false);
  grant(s,'jasur',{sell:true});recordSale(s,[{productId:'p0',qty:1,price:85000}],'jasur',{account:'till2',received:85000},at);assert.equal(s.sales.length,1);
});
test('credit and exceptional prices can be disabled independently of ordinary sales',()=>{
  const s=fresh();grant(s,'sardor',{credit:false,priceException:false});const p=s.products[0],before=JSON.stringify(s);
  assert.throws(()=>recordSale(s,[{productId:p.id,qty:1,price:0}],'sardor',{account:'till1',received:0,note:'Sovg‘a'},at));
  assert.throws(()=>recordSale(s,[{productId:p.id,qty:1,price:p.price}],'sardor',{account:'till1',received:0,note:'Nasiya',customer:'Ali',phone:'+998901234567',due:'2026-11-11'},at));
  assert.equal(JSON.stringify(s),before);
  recordSale(s,[{productId:p.id,qty:1,price:p.price}],'sardor',{account:'till1',received:p.price},at);assert.equal(s.sales.length,1);
});
test('explicit stock and price permissions work without revealing or granting reports',()=>{
  const s=fresh();grant(s,'sardor',{stock:true,prices:true});const p=s.products[0],n=stock(p);
  purchase(s,p.id,2,25000,'Naqd','sardor');setCatalogPrice(s,p.id,80000,'sardor',60000);
  assert.equal(stock(p),n+2);assert.equal(p.minPrice,60000);assert.equal(canVisit(s,'sardor','reports'),false);
  grant(s,'sardor',{stock:false,prices:false});const before=JSON.stringify(s);assert.throws(()=>purchase(s,p.id,1,20000,'Naqd','sardor'));assert.throws(()=>setCatalogPrice(s,p.id,10000,'sardor'));assert.equal(JSON.stringify(s),before);
});
test('switching owner changes the actual stock group, while mixed-owner revenue all goes into a shared till',()=>{
  const s=fresh(),ids=['aziz','sardor','jasur'].map(owner=>group(s,owner));
  const cart=[{productId:ids[0],qty:2,price:30000}],switched=selectCartOwner(s,cart,ids[0],'jasur','sardor');
  assert.equal(cart[0].productId,ids[0]);assert.equal(switched[0].productId,ids[2]);
  recordSale(s,[...switched,{productId:ids[0],qty:1,price:30000},{productId:ids[1],qty:1,price:30000}],'sardor',{account:'till2',received:120000},at);
  assert.deepEqual(ids.map(id=>stock(s.products.find(p=>p.id===id))),[4,4,3]);assert.equal(accountBalances(s).till2,120000);
  const all=businessReport(s,{period:'all',at}),parts=['aziz','sardor','jasur'].map(owner=>businessReport(s,{period:'all',owner,at}));
  assert.equal(all.revenue,parts.reduce((sum,r)=>sum+r.revenue,0));assert.equal(s.sales[0].seller,'sardor');assert.deepEqual(s.sales[0].items.map(i=>i.owner),['jasur','aziz','sardor']);
});
test('owner selection refuses absent stock and duplicate cart groups rather than relabeling someone else’s goods',()=>{
  const s=fresh(),a=group(s,'aziz'),b=group(s,'jasur');
  const cart=[{productId:a,qty:1,price:30000},{productId:b,qty:1,price:30000}],before=JSON.stringify(s);
  assert.throws(()=>selectCartOwner(s,cart,a,'sardor','jasur'));assert.throws(()=>selectCartOwner(s,cart,a,'jasur','jasur'));
  assert.equal(JSON.stringify(s),before);assert.equal(cart[0].productId,a);
});
test('custom permissions and names round trip safely; backup cannot introduce report grants or unsafe profile labels',()=>{
  const s=fresh();grant(s,'jasur',{cash:false});const restored=readBackup(JSON.stringify(s));assert.equal(can(restored,'jasur','cash'),false);
  for(const change of [d=>d.settings.permissions.jasur.reports=true,d=>d.settings.people[1].name='<img src=x>',d=>d.settings.people.push({id:'admin2',name:'Other'})]){const bad=structuredClone(s);change(bad);assert.throws(()=>readBackup(JSON.stringify(bad)));}
});
test('revoked reversal permission applies even to the employee’s own pre-existing entry',()=>{
  const s=fresh(),entry=recordFlow(s,{kind:'expense',account:'till1',amount:1000,note:'Sinov'},'jasur',at);grant(s,'jasur',{reverse:false});
  assert.equal(canReverseMovement(s.movements[0],'jasur',s),false);const before=JSON.stringify(s);assert.throws(()=>reverseMovement(s,entry.id,'jasur','Xato',at));assert.equal(JSON.stringify(s),before);
});
