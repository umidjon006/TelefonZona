export const QUALITY_TIERS = [
  { id:'budget', name:'Arzon' },
  { id:'standard', name:'O‘rta' },
  { id:'pro', name:'Pro' },
  { id:'premium', name:'Premium' },
];

export function qualityName(id,state) {
  return (state?.settings?.catalog?.qualities||QUALITY_TIERS).find(tier=>tier.id===id)?.name || '';
}


// Catalog navigation is independent of accounting and saved stock records.
export const BRANDS = [
  { id: 'samsung', name: 'Samsung', mark: 'SAMSUNG' },
  { id: 'apple', name: 'Apple', mark: 'Apple' },
  { id: 'xiaomi', name: 'Xiaomi', mark: 'mi' },
  { id: 'honor', name: 'Honor', mark: 'HONOR' },
  { id: 'huawei', name: 'Huawei', mark: 'HUAWEI' },
  { id: 'realme', name: 'Realme', mark: 'realme' },
  { id: 'infinix', name: 'Infinix', mark: 'Infinix' },
  { id: 'tecno', name: 'Tecno', mark: 'TECNO' },
  { id: 'jbl', name: 'JBL', mark: 'JBL' },
  { id: 'other', name: 'Boshqa brendlar', mark: 'Boshqa' },
];

const SERIES = {
  samsung: [
    ['s', 'S seriya', 'S23 · S23+ · S23U'],
    ['a', 'A seriya', 'A15 · A54 · A55'],
    ['note', 'Note seriya', 'Note 10 · Note 20U'],
    ['other', 'Boshqa modellar', 'J2 · J5 · M23'],
  ],
  apple: [
    ['iphone', 'iPhone', '15 · 15P · 15PM'],
    ['watch', 'Apple Watch', 'Soatlar va aksessuarlar'],
    ['other', 'Boshqa modellar', 'AirPods · adapterlar'],
  ],
  xiaomi: [
    ['redmi', 'Redmi', 'Note 12 · Note 13P'],
    ['poco', 'POCO', 'X5 · X6P'],
    ['other', 'Xiaomi va boshqalar', 'Telefonlar va aksessuarlar'],
  ],
};

export function seriesFor(brand) {
  return (SERIES[brand] || []).map(([id, name, hint]) => ({ id, name, hint }));
}

export function normalizeSearch(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\bgalaxy\b/g, '')
    .replace(/\bpro\s*max\b/g, 'pm')
    .replace(/\bultra\b/g, 'u')
    .replace(/\bplus\b/g, '+')
    .replace(/\bpro\b/g, 'p')
    .replace(/[^\p{L}\p{N}+]/gu, '');
}

function compactModel(value) {
  return value
    .replace(/\bPro\s*Max\b/gi, 'PM')
    .replace(/\bUltra\b/gi, 'U')
    .replace(/\bPlus\b/gi, '+')
    .replace(/\bPro\b/gi, 'P')
    .replace(/(\d)\s+(PM|P|U|\+)/gi, '$1$2')
    .replace(/(\d)(pm|p|u)\b/gi, (_, digit, suffix) => digit + suffix.toUpperCase())
    .replace(/^([SAJM])\s+(\d)/i, '$1$2')
    .trim();
}

export function variantLabel(product) {
  const pieces = String(product.variant || '').split('·');
  return productIdentity(product).model && pieces.length > 1
    ? pieces.slice(1).join('·').trim()
    : compactModel(product.variant || '');
}

export function productIdentity(product) {
  const text = [product.model, product.variant, product.name].filter(Boolean).join(' ');
  let brand = product.brand || 'other';
  if (brand === 'other' && !product.brand) {
    const patterns = [
      ['samsung', /samsung|galaxy/i],
      ['apple', /apple|iphone|ipad|airpods|lightning/i],
      ['xiaomi', /xiaomi|redmi|poco/i],
      ...['honor', 'huawei', 'realme', 'infinix', 'tecno', 'jbl'].map(id => [id, new RegExp(id, 'i')]),
    ];
    brand = patterns.find(([, pattern]) => pattern.test(text))?.[0] || 'other';
  }

  let series = 'other';
  let model = product.model?.trim() || '';
  if (brand === 'samsung') {
    const match = text.match(/\b(Note\s*\d{1,2}|[SAJM]\s*\d{1,3})(?:\s*(Ultra|Plus|U\b|\+|FE\b|Lite\b))?/i);
    if (match) {
      model = compactModel(match[0].replace(/^note/i, 'Note').replace(/^[sajm]/i, letter => letter.toUpperCase()));
      series = /^S\d/i.test(model) ? 's' : /^A\d/i.test(model) ? 'a' : /^Note/i.test(model) ? 'note' : 'other';
    }
  } else if (brand === 'apple') {
    const match = text.match(/iPhone\s*\d{1,2}(?:\s*(?:Pro\s*Max|Pro|Plus|Mini|PM\b|P\b|\+))?/i);
    if (match) {
      model = compactModel(match[0].replace(/^iphone/i, 'iPhone'));
      series = 'iphone';
    } else if (/watch/i.test(text)) {
      model ||= /watch\s+ultra\s*\d*/i.test(text) ? 'Watch Ultra 2' : 'Apple Watch';
      series = 'watch';
    }
  } else if (brand === 'xiaomi') {
    series = /redmi/i.test(text) ? 'redmi' : /poco/i.test(text) ? 'poco' : 'other';
    const match = text.match(/(?:Redmi\s+(?:Note\s*)?|POCO\s+)[A-Z]?\d{1,2}(?:\s*(?:Pro\s*Plus|Pro\+|Pro|Plus|P\+|P\b|\+))?/i);
    if (match) model = compactModel(match[0]);
  }
  if (!model && !['samsung', 'apple', 'xiaomi', 'other'].includes(brand)) {
    model = compactModel((product.variant || '').split(/[·,]/)[0].replace(new RegExp(`^${brand}\\s*`, 'i'), '').trim());
  }
  return { brand, series, model: compactModel(model) };
}

export function matchesProduct(product, query) {
  if (productsByCode([product], query).length) return true;
  const identity = productIdentity(product);
  const tokens = String(query ?? '').trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  // Normalize the query as a whole so "S23 Ultra" and "S23 U" are equivalent.
  const haystack = normalizeSearch([
    product.name, product.variant, product.sku, product.barcode, product.category, product.qualityLabel, qualityName(product.quality),
    BRANDS.find(brand => brand.id === identity.brand)?.name,
    identity.model,
  ].join(' '));
  const normalized = normalizeSearch(query);
  const modelQuery = String(query).match(/\b(?:Note\s*\d+|[SAJM]\s*\d+|iPhone\s*\d+)(?:\s*(?:Pro\s*Max|Ultra|Plus|Pro|PM\b|P\b|U\b|\+))?/i)?.[0];
  if (modelQuery && !normalizeSearch(identity.model).includes(normalizeSearch(modelQuery))) return false;
  if (haystack.includes(normalized)) return true;
  // Still support searches such as "Samsung qora" across separate fields.
  return tokens.every(token => haystack.includes(normalizeSearch(token)));
}

// Scanning is an exact lookup, never a fuzzy model search. Shared factory codes
// can belong to several owners or variants, so callers must handle all matches.
export function productsByCode(products, code) {
  const normalized = String(code ?? '').trim().toUpperCase();
  if (!normalized) return [];
  return products.filter(product => [product.sku, product.barcode].some(value => value && String(value).trim().toUpperCase() === normalized));
}

export function filterCatalog(products, { brand = 'all', series = 'all', query = '', category = 'all', quality = 'all' } = {}) {
  return products.filter(product => {
    const identity = productIdentity(product);
    return (brand === 'all' || identity.brand === brand)
      && (brand === 'all' || series === 'all' || identity.series === series)
      && (category === 'all' || category === 'low' && product.lots.reduce((sum, lot) => sum + lot.qty, 0) <= product.min || product.category === category)
      && (quality === 'all' || product.quality === quality)
      && matchesProduct(product, query);
  });
}
