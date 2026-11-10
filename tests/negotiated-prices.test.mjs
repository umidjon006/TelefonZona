import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSeed, checkout, refund, metrics, stock, inventoryValue, saleDiscount } from '../src/model.js';
import { productsByCode, filterCatalog } from '../src/catalog.js';

function fresh() {
  const state = makeSeed();
  state.sales = [];
  state.expenses = [];
  state.audit = [];
  const product = state.products[0];
  product.price = 10000;
  product.lots = [{ id:'negotiated-lot', qty:10, cost:4000 }];
  return { state, product };
}

test('seller records the negotiated price; revenue and FIFO cost use the actual sale', () => {
  const {state, product} = fresh();
  const sale = checkout(state, [{productId:product.id, qty:1, price:7000, listPrice:1}], 'jasur', 'Naqd');
  assert.equal(sale.seller, 'jasur');
  assert.equal(sale.items[0].listPrice, 10000);
  assert.equal(sale.items[0].price, 7000);
  assert.equal(sale.items[0].sku, product.sku);
  assert.equal(sale.items[0].owner, product.owner);
  assert.equal(metrics(state).revenue, 7000);
  assert.equal(metrics(state).gross, 3000);
  assert.equal(sale.items[0].commission, 0);
  assert.equal(metrics(state).net, 3000);
  assert.equal(saleDiscount(sale), 3000);
  assert.equal(stock(product), 9);
});

test('changing the catalog price does not rewrite old negotiated prices or discounts', () => {
  const {state, product} = fresh();
  const sale = checkout(state, [{productId:product.id, qty:2, price:7000}], 'sardor', 'Karta');
  product.price = 15000;
  assert.equal(sale.items[0].listPrice, 10000);
  assert.equal(sale.items[0].price, 7000);
  assert.equal(saleDiscount(sale), 6000);
  assert.equal(metrics(state).gross, 6000);
  refund(state, sale.id, 'aziz');
  assert.equal(metrics(state).gross, 0);
  assert.equal(state.sales.filter(item=>!item.returned).reduce((sum,item)=>sum+saleDiscount(item),0), 0);
  assert.equal(stock(product), 10);
});

test('old receipts and higher-price sales never create an invented discount', () => {
  assert.equal(saleDiscount({items:[{qty:2,price:7000}]}), 0);
  assert.equal(saleDiscount({items:[{qty:2,price:12000,listPrice:10000}]}), 0);
});

test('saved demo percentage settings do not calculate or deduct employee pay', () => {
  const {state, product} = fresh();
  state.settings.rates = {jasur:10, sardor:10};
  const sale = checkout(state, [{productId:product.id,qty:1,price:7000}], 'jasur', 'Naqd');
  assert.equal(sale.items[0].commission,0);
  // Legacy demo receipts can still contain the retired field.
  sale.items[0].commission=300;
  const before=JSON.stringify(state);
  const result=metrics(state);
  assert.equal(result.commission,0);
  assert.equal(result.net,3000);
  assert.equal(JSON.stringify(state),before);
});

test('inventory value uses remaining lots rather than treating unsold goods as profit', () => {
  const {state, product} = fresh();
  product.lots = [{id:'one', qty:1, cost:3001},{id:'two', qty:2, cost:4002}];
  assert.deepEqual(inventoryValue([product]), {cost:11005, retail:30000});
  checkout(state, [{productId:product.id, qty:1, price:7000}], 'aziz', 'Karta');
  assert.deepEqual(inventoryValue([product]), {cost:8004, retail:20000});
});

test('code lookup is exact and exposes ambiguous owners instead of choosing one', () => {
  const products = [
    {sku:'TZ-0001', barcode:'0012345', lots:[], name:'G‘ilof', owner:'aziz'},
    {sku:'TZ-0002', barcode:'0012345', lots:[], name:'G‘ilof', owner:'sardor'},
  ];
  assert.deepEqual(productsByCode(products, ' tz-0001 '), [products[0]]);
  assert.equal(productsByCode(products, '0012345').length, 2);
  assert.equal(productsByCode(products, '12345').length, 0);
  assert.equal(productsByCode(products, 'TZ-000').length, 0);
  assert.equal(productsByCode(products, '').length, 0);
  assert.equal(filterCatalog(products, {query:'0012345'}).length, 2);
});

test('an invalid negotiated price does not partially consume stock', () => {
  for (const price of [-1, NaN, 0.5, Infinity]) {
    const {state,product} = fresh();
    const before = JSON.stringify(state);
    assert.throws(()=>checkout(state,[{productId:product.id,qty:1,price}], 'jasur', 'Naqd'));
    assert.equal(JSON.stringify(state),before);
  }
});
