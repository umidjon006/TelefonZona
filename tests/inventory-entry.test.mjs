import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSeed, purchase, stock, checkout } from '../src/model.js';
import { registerCaseGroups, setCatalogPrice } from '../src/inventory-entry.js';
import { filterCatalog } from '../src/catalog.js';

const entry=(owner='aziz')=>({brand:'samsung',model:'S25U',owner,payment:'Naqd',rows:[
  {quality:'budget',qty:10,cost:4000,price:10000},
  {quality:'standard',qty:12,cost:12000,price:25000},
  {quality:'pro',qty:6,cost:25000,price:45000},
  {quality:'premium',qty:3,cost:45000,price:80000},
]});

test('both sellers cannot change catalog price, add stock or create groups, even for their own goods',()=>{
  for(const actor of ['sardor','jasur']) {
    const state=makeSeed();
    const product=state.products.find(product=>product.owner==='sardor');
    const before=JSON.stringify(state);
    assert.throws(()=>setCatalogPrice(state,product.id,10000,actor));
    assert.throws(()=>purchase(state,product.id,1,4000,'Naqd',actor));
    assert.throws(()=>registerCaseGroups(state,entry('sardor'),actor));
    assert.equal(JSON.stringify(state),before);
  }
});

test('one grouped entry creates four separately counted price tiers for one model',()=>{
  const state=makeSeed();
  const result=registerCaseGroups(state,entry(),'aziz');
  const products=result.map(item=>state.products.find(product=>product.id===item.id));
  assert.equal(new Set(products.map(product=>product.sku)).size,4);
  assert.deepEqual(products.map(product=>stock(product)),[10,12,6,3]);
  assert.deepEqual(products.map(product=>product.quality),['budget','standard','pro','premium']);
  assert.equal(state.purchases.length,4);
  assert.equal(filterCatalog(state.products,{brand:'samsung',query:'S25 Ultra',quality:'premium'}).length,1);
});

test('later receipts reuse the same model-tier-owner group and preserve old lot costs',()=>{
  const state=makeSeed();
  const first=registerCaseGroups(state,entry(),'aziz');
  const product=state.products.find(product=>product.id===first[0].id);
  const input=entry();
  input.model='Samsung S25 Ultra';
  input.rows=[{quality:'budget',qty:2,cost:5000,price:11000}];
  const next=registerCaseGroups(state,input,'aziz');
  assert.equal(next[0].id,product.id);
  const updated=state.products.find(item=>item.id===product.id);
  assert.deepEqual(updated.lots.map(lot=>[lot.qty,lot.cost]),[[10,4000],[2,5000]]);
  assert.equal(updated.price,11000);
});

test('same model and tier belonging to another owner stay separate',()=>{
  const state=makeSeed();
  registerCaseGroups(state,entry('aziz'),'aziz');
  registerCaseGroups(state,entry('sardor'),'aziz');
  const groups=filterCatalog(state.products,{query:'S25U',quality:'budget'});
  assert.equal(groups.length,2);
  assert.notEqual(groups[0].sku,groups[1].sku);
  assert.deepEqual(new Set(groups.map(product=>product.owner)),new Set(['aziz','sardor']));
});

test('an invalid later row does not partially add products or stock',()=>{
  const state=makeSeed();
  const input=entry();
  input.rows[2].price=0;
  const before=JSON.stringify(state);
  assert.throws(()=>registerCaseGroups(state,input,'aziz'));
  assert.equal(JSON.stringify(state),before);
});

test('negotiated sales preserve tier, catalog price, cost and owner; boss price edits keep old receipts',()=>{
  const state=makeSeed();
  const result=registerCaseGroups(state,entry(),'aziz');
  const product=state.products.find(product=>product.id===result[0].id);
  for(const seller of ['sardor','jasur']) {
    const sale=checkout(state,[{productId:product.id,qty:1,price:7000} ],seller,'Naqd');
    assert.equal(sale.items[0].quality,'budget');
    assert.equal(sale.items[0].listPrice,10000);
    assert.equal(sale.items[0].cost,4000);
    assert.equal(sale.items[0].owner,'aziz');
    assert.equal(product.price,10000);
    assert.equal(product.lots[0].cost,4000);
  }
  const last=state.sales.at(-1);
  setCatalogPrice(state,product.id,12000,'aziz');
  assert.equal(product.price,12000);
  assert.equal(last.items[0].listPrice,10000);
});
