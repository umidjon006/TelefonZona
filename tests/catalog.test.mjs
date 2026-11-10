import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSeed, checkout, stock } from '../src/model.js';
import { filterCatalog, matchesProduct, productIdentity, seriesFor } from '../src/catalog.js';

const products = makeSeed().products;
const models = options => filterCatalog(products, options).map(product => productIdentity(product).model);

test('Samsung keeps S, A, Note and older models in four flat groups', () => {
  assert.deepEqual(seriesFor('samsung').map(series => series.id), ['s', 'a', 'note', 'other']);
  assert.ok(models({ brand: 'samsung', series: 's' }).includes('S23U'));
  assert.ok(models({ brand: 'samsung', series: 'a' }).includes('A54'));
  assert.deepEqual(models({ brand: 'samsung', series: 'note' }), ['Note 10', 'Note 20U']);
  assert.deepEqual(models({ brand: 'samsung', series: 'other' }), ['J2', 'J5', 'M23']);
});

test('Plus and Ultra search aliases return the same models without mixing variants', () => {
  for (const query of ['S23+', 'S23 Plus', 's 23 plus', 'Samsung Galaxy S23 Plus']) {
    assert.deepEqual(models({ brand: 'samsung', series: 's', query }), ['S23+'], query);
  }
  for (const query of ['S23U', 'S23 Ultra', 's23 u', 'Samsung S23 Ultra']) {
    assert.deepEqual(models({ brand: 'samsung', series: 's', query }), ['S23U'], query);
  }
  assert.equal(models({ brand: 'samsung', query: 'S23' }).length, 3);
});

test('iPhone Pro, Pro Max and Plus follow the same compact naming rule', () => {
  for (const query of ['iPhone 15PM', 'iPhone 15 Pro Max', 'iphone15pm']) {
    assert.deepEqual(models({ brand: 'apple', query }), ['iPhone 15PM']);
  }
  assert.deepEqual(models({ brand: 'apple', query: 'iPhone 14 Plus' }), ['iPhone 14+']);
  assert.deepEqual(models({ brand: 'apple', query: 'iPhone 15 Pro' }), ['iPhone 15P', 'iPhone 15P', 'iPhone 15PM']);
});

test('brand, category and series filters combine without crossing brands', () => {
  assert.equal(filterCatalog(products, { brand: 'samsung', series: 's', category: 'Himoya oynalari' }).length, 1);
  assert.equal(filterCatalog(products, { brand: 'apple', query: 'S23U' }).length, 0);
  assert.equal(filterCatalog(products, { brand: 'samsung', series: 'a', query: 'S23' }).length, 0);
  assert.equal(filterCatalog(products, { brand: 'samsung', series: 'other', query: 'M23' }).length, 1);
  assert.equal(filterCatalog(products, { query: 'mavjud emas' }).length, 0);
});

test('existing saved products are classified without rewriting their stock records', () => {
  const product = products.find(product => product.id === 'p2');
  const before = JSON.stringify(product);
  assert.deepEqual(productIdentity(product), { brand: 'samsung', series: 'a', model: 'A54' });
  assert.ok(matchesProduct(product, 'Samsung grafit'));
  assert.ok(matchesProduct(product, product.sku));
  assert.equal(JSON.stringify(product), before);
});

test('new products with a selected brand accept short model names', () => {
  assert.deepEqual(productIdentity({ brand: 'samsung', variant: 'S25U · qora', name: 'G‘ilof' }), { brand: 'samsung', series: 's', model: 'S25U' });
  assert.deepEqual(productIdentity({ brand: 'apple', variant: 'iPhone 16PM · tiniq', name: 'Oyna' }), { brand: 'apple', series: 'iphone', model: 'iPhone 16PM' });
});

test('catalog selection keeps each owner distinct and still supports checkout', () => {
  const state = makeSeed();
  const before = JSON.stringify(state);
  const variants = filterCatalog(state.products, { brand: 'apple', query: 'iPhone 13' });
  assert.equal(variants.length, 2);
  assert.equal(new Set(variants.map(product => product.owner)).size, 2);
  assert.equal(JSON.stringify(state), before);
  const product = filterCatalog(state.products, { brand: 'samsung', series: 's', query: 'S23U' })[0];
  const qty = stock(product);
  const sale = checkout(state, [{ productId: product.id, qty: 1, price: product.price }], 'jasur', 'Naqd');
  assert.equal(stock(product), qty - 1);
  assert.equal(sale.items[0].owner, product.owner);
});
