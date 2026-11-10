import {productIdentity,normalizeSearch} from './catalog.js';
import {stock} from './model.js';
import {requirePermission} from './access.js';

function groupKey(product){
  const identity=productIdentity(product);
  return JSON.stringify([identity.brand,normalizeSearch(identity.model),product.category,product.audience||'',product.material||'',product.quality||'',
    product.grouped?'grouped':normalizeSearch(product.name+' '+product.variant)]);
}
export function ownerAlternatives(state,product){
  const key=groupKey(product);
  return state.products.filter(p=>groupKey(p)===key);
}
export function selectCartOwner(state,cart,productId,owner,actor){
  requirePermission(state,actor,'sell');
  const row=cart.find(r=>r.productId===productId),product=state.products.find(p=>p.id===productId);
  if(!row||!product)throw Error('Savat mahsuloti topilmadi.');
  const matches=ownerAlternatives(state,product).filter(p=>p.owner===owner&&stock(p)>=row.qty);
  if(matches.length!==1)throw Error(matches.length?'Bu egada bir nechta mos guruh bor. Mahsulot kartasidan aniq guruhni tanlang.':'Bu egaga tegishli shu guruhda yetarli qoldiq yo‘q.');
  const target=matches[0];
  if(target.id!==productId&&cart.some(r=>r.productId===target.id))throw Error('Bu egaga tegishli mahsulot savatda bor. O‘sha qatordagi sonni o‘zgartiring.');
  return cart.map(r=>r===row?{...r,productId:target.id,owner:target.owner}:r);
}
