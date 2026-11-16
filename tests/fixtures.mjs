import {TODAY,cost,uid} from '../src/model.js';

export function makeSeed(){
const data=[
['Silicone Case','iPhone 15 Pro · qora','G‘iloflar',85000,35000,9,'aziz','case','#384a40'],
['Clear MagSafe','iPhone 13 · shaffof','G‘iloflar',65000,27000,3,'aziz','case','#d4e2d7'],
['Carbon Case','Samsung A54 · grafit','G‘iloflar',55000,22000,17,'sardor','case','#40464d'],
['20W USB-C Adapter','Apple · oq','Quvvatlagichlar',145000,82000,8,'aziz','charger','#e9ece7'],
['Type-C → Lightning','1 metr · oq','Kabellar',65000,28000,4,'aziz','cable','#e3e5df'],
['AirPods Pro 2','Premium nusxa · oq','Quloqchinlar',285000,175000,6,'sardor','buds','#f0f1e9'],
['9D himoya oynasi','iPhone 15 Pro · tiniq','Himoya oynalari',45000,11000,2,'aziz','glass','#b1d0c2'],
['Galaxy Silicone','Samsung A15 · lavanda','G‘iloflar',45000,18000,22,'aziz','case','#a9a0bf'],
['Watch Ultra 2','49 mm · orange','Aqlli soatlar',420000,290000,5,'aziz','watch','#d9915f'],
['Sport Loop','Apple Watch · 42/44/45 mm','Soat aksessuarlari',75000,32000,11,'sardor','strap','#acc0a4'],
['Magnetic Car Mount','Universal · qora','Avto aksessuarlar',95000,45000,7,'aziz','mount','#343b39'],
['JBL Tune 520BT','Bluetooth · qora','Quloqchinlar',365000,240000,4,'aziz','headphones','#323b38'],
['USB-C → USB-C','60W · 1 metr · qora','Kabellar',55000,23000,18,'sardor','cable','#4b5c53'],
['33W Fast Charger','Xiaomi · oq','Quvvatlagichlar',120000,68000,10,'aziz','charger','#deded3'],
['Wired Earphones','3.5 mm · oq','Quloqchinlar',45000,18000,16,'aziz','buds','#f2ede0'],
['Watch himoya oynasi','Apple Watch · 45 mm','Soat aksessuarlari',35000,9000,14,'sardor','glass','#b6cbbf'],
['Clear MagSafe','iPhone 13 · shaffof','G‘iloflar',65000,29000,7,'sardor','case','#d4e2d7'],
['Leather Case','iPhone 11 · jigarrang','G‘iloflar',95000,46000,19,'aziz','case','#a2866b']
];
const products=data.map((r,i)=>({id:'p'+i,name:r[0],variant:r[1],category:r[2],price:r[3],min:5,owner:r[6],type:r[7],color:r[8],sku:'DF-'+String(1001+i),lots:[{id:'lot'+i,qty:r[5],cost:r[4],date:'2026-10-01'}]}));
const s={version:1,products,sales:[],expenses:[],purchases:[],payouts:[],closings:[],audit:[],settings:{shop:'TelefonZona',openingCash:1500000}};
for(let day=1;day<=22;day++){for(let j=0;j<4+(day%4);j++){let p=products[(day*3+j*5)%17],qty=j===0?2:1,seller=['aziz','sardor','jasur'][(day+j)%3],date=`2026-10-${String(day).padStart(2,'0')}`,price=p.price,profit=(price-cost(p))*qty;
s.sales.push({id:`S-${1000+s.sales.length+1}`,date,time:`${10+j}:15`,seller,payment:['Naqd','Karta','O‘tkazma'][(day+j)%3],items:[{productId:p.id,name:p.name,variant:p.variant,owner:p.owner,qty,price,cost:cost(p)*qty,alloc:[{lotId:p.lots[0].id,qty,cost:cost(p)}],commission:0}],returned:false});}}
s.expenses=[{id:'e1',date:'2026-10-01',category:'Ijara',note:'Oktabr oyi ijarasi',amount:1800000,owner:'aziz',payment:'Naqd'},{id:'e2',date:'2026-10-15',category:'Elektr',note:'Elektr energiyasi',amount:210000,owner:'aziz',payment:'Karta'},{id:'e3',date:'2026-10-18',category:'Boshqa',note:'Paketlar va qadoqlash',amount:85000,owner:'sardor',payment:'Naqd'}];
// Extra catalog examples demonstrate model browsing without inventing past sales.
const catalogExamples = [
  ['Samsung','S23','Silicone g‘ilof','qora',65000,26000,12,'aziz'],
  ['Samsung','S23 Plus','Shaffof g‘ilof','shaffof',65000,26000,7,'aziz'],
  ['Samsung','S23 Ultra','Carbon g‘ilof','qora',85000,35000,9,'sardor'],
  ['Samsung','S24','Silicone g‘ilof','ko‘k',75000,30000,8,'aziz'],
  ['Samsung','S24 Ultra','Himoya oynasi','tiniq',45000,12000,4,'aziz'],
  ['Samsung','A55','Shaffof g‘ilof','shaffof',45000,18000,13,'aziz'],
  ['Samsung','Note 10','Silicone g‘ilof','qora',45000,18000,5,'aziz'],
  ['Samsung','Note 20 Ultra','Carbon g‘ilof','grafit',65000,25000,3,'sardor'],
  ['Samsung','J2','Silicone g‘ilof','qora',25000,10000,2,'aziz'],
  ['Samsung','J5','Shaffof g‘ilof','shaffof',25000,10000,2,'aziz'],
  ['Samsung','M23','Silicone g‘ilof','ko‘k',35000,14000,3,'aziz'],
  ['Apple','iPhone 15 Pro Max','MagSafe g‘ilof','qora',95000,40000,6,'sardor'],
  ['Apple','iPhone 14 Plus','Shaffof g‘ilof','shaffof',65000,27000,7,'aziz'],
  ['Xiaomi','Redmi Note 13 Pro','Silicone g‘ilof','qora',45000,18000,11,'aziz'],
  ['Xiaomi','POCO X6 Pro','Shaffof g‘ilof','shaffof',45000,18000,5,'sardor'],
  ['Honor','Honor X9','Silicone g‘ilof','qora',45000,18000,6,'aziz'],
  ['Huawei','Huawei P30','Shaffof g‘ilof','shaffof',35000,14000,3,'aziz'],
  ['Realme','Realme C55','Silicone g‘ilof','qora',35000,14000,6,'aziz'],
  ['Infinix','Infinix Hot 30','Shaffof g‘ilof','shaffof',35000,14000,5,'sardor'],
  ['Tecno','Tecno Spark 10','Silicone g‘ilof','qora',35000,14000,4,'aziz'],
];
for (const [brand, model, name, variant, price, unitCost, qty, owner] of catalogExamples) {
  const id = 'catalog-' + products.length;
  products.push({id, brand:brand.toLowerCase(), model, name, variant:model+' · '+variant,
    category:name==='Himoya oynasi'?'Himoya oynalari':'G‘iloflar', price, min:5, owner,
    sku:'TZ-'+(1001+products.length), lots:[{id:'lot-'+id,qty,cost:unitCost,date:TODAY}]});
}
// These are explicitly synthetic classifications, never a migration of user stock.
for(const [index,p] of products.entries()){p.minPrice=Math.round(p.price*0.8);if(p.category==='G‘iloflar'){p.audience=index%3===1?'women':'men';p.material=/carbon/i.test(p.name)?'Karbon':/clear|shaffof|magsafe/i.test(p.name)?'Shaffof':/leather/i.test(p.name)?'Charm':'Silikon';p.quality=p.price>=85000?'premium':p.price>=55000?'pro':p.price>=35000?'standard':'budget';}}
s.audit=[{id:uid(),date:TODAY,time:'09:00',actor:'aziz',text:'Namuna ma’lumotlari yuklandi'}];return s;
}
