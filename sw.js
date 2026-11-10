const CACHE='telefonzona-shell-v6';
const FILES=['/','/index.html','/src/app.js','/src/model.js','/src/catalog.js','/src/inventory-entry.js','/src/business.js','/src/backup.js','/src/access.js','/src/admin.js','/src/ownership.js','/src/style.css','/src/themes.js','/src/themes.css','/src/responsive.js','/src/responsive.css'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('telefonzona-shell-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
// Cache only the frontend shell. Business data lives in the browser; there is
// deliberately no pretend server sync or queue acknowledgement here.
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin||!FILES.includes(url.pathname))return;
  event.respondWith(fetch(event.request).then(response=>{
    if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)));}
    return response;
  }).catch(()=>caches.match(event.request).then(cached=>cached||Response.error())));
});
