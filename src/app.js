import {saveService,deleteService,canEditService,updateProduct,archiveProduct,updateDebt,deleteOpeningDebt,correctMovement,correctSale,updatePurchase,deleteRent,updateClosing,updateDefect} from './management.js';
import {prepareResponsiveContent} from './responsive.js';
import {THEMES,resolveTheme,initializeTheme,chooseTheme} from './themes.js';
import {ownerAlternatives,selectCartOwner} from './ownership.js';
import {people,owners,PERMISSIONS,can,canVisit,requirePermission} from './access.js';
import {catalog,addCatalogOption,saveStaffPermissions,changeCatalogOption,renameAdmin} from './admin.js';
import {readBackup,backupSummary,MAX_BACKUP_BYTES} from './backup.js';
import {registerCaseGroups,setCatalogPrice,registerProduct,setLowStockLimit} from './inventory-entry.js';
import {seriesFor,productIdentity,variantLabel,matchesProduct,filterCatalog,qualityName} from './catalog.js';
import {CASH_ACCOUNT,createEmptyState,uid,stock,stockLimit,isLowStock,cost,saleTotal,saleProfit,inventoryValue,log,purchase} from './model.js';
import {ACCOUNTS,LEGACY_CASH_ACCOUNTS,AUDIENCES,FLOW_KINDS,prepareState,localDate,priceRange,outsideRange,recordSale,repayDebt,returnSale,recordFlow,accountBalances,staffPayable,setRent,payRent,setOpeningBalances,addOpeningDebt,closeDay,reportWindow,inWindow,businessReport,debtReminders,disposeStock,eventTime,reverseMovement,canReverseMovement} from './business.js';

import {runCommand} from './commands.js';
import {api,isServerPage} from './api.js';
import {entriesByWorker,intakeRemaining} from './intake.js';
import {remindersFor} from './reminders.js';

initializeTheme();

const KEY='telefonzona-v2',RECOVERY_KEY='telefonzona-v2-before-restore';
const DEMO_KEYS=['telefonzona-v1','telefonzona-before-restore'];
// In server mode the page was served by the TelefonZona server: records live there and
// this browser never reads or writes the local business data key.
const SERVER_MODE=isServerPage();
let pendingBackup=null;
let state,storedRaw=null,loadFailed=false;
if(SERVER_MODE)state=prepareState(createEmptyState());
else try {storedRaw=localStorage.getItem(KEY);state=JSON.parse(storedRaw)||createEmptyState();if(state.version!==1||!Array.isArray(state.products)||!Array.isArray(state.sales))throw Error('Format');prepareState(state);}
catch {loadFailed=Boolean(storedRaw);state=prepareState(createEmptyState());}
let TODAY=localDate();
let user='aziz',page='dashboard',period='month',owner='all',query='',category='all';
let brand='all',series='all',quality='all',audience='all',material='all',employee='all',salesIndex=0,catalogOwner='all';
let renderedPage=null;
let cart=[],modal=false,online=navigator.onLine;
let session=null,serverVersion=-1,lastReminders=[],intakeContext=null,pollTimer=null,polling=false,needsRender=false,lastFull=0,loginPeople=null;
const $=selector=>document.querySelector(selector);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=value=>(value===0?0:Math.round(value)).toLocaleString('fr-FR').replaceAll('\u202f',' ');
const short=value=>Math.abs(value)>=1e6?(value/1e6).toFixed(2).replace('.',',')+' mln':money(value);
const name=id=>people(state).find(u=>u.id===id)?.name||id;
const accountName=id=>id==='personal'?'O‘z cho‘ntagidan':LEGACY_CASH_ACCOUNTS.includes(id)||id===CASH_ACCOUNT?'Umumiy kassa':id;
const audienceName=id=>AUDIENCES.find(([v])=>v===id)?.[1]||'';
const boss=()=>user==='aziz';
const allowed=permission=>can(state,user,permission);
const qualityLabel=id=>qualityName(id,state);
const paths={grid:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',bag:'M5 7h14l1 14H4L5 7z M9 8V6a3 3 0 0 1 6 0v2',box:'m3 7 9-4 9 4v10l-9 4-9-4V7z M3 7l9 4 9-4 M12 11v10 M7 5l9 4',chart:'M4 20V10 M10 20V4 M16 20v-7 M22 20H2',users:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M16 3a4 4 0 0 1 0 8',wallet:'M20 8V5H5a3 3 0 0 0 0 6h16v9H5a3 3 0 0 1-3-3V8 M16 14h5',down:'m8 10 4 4 4-4',arrow:'M5 12h14 m-5-5 5 5-5 5',up:'m7 17 10-10 M7 7h10v10',plus:'M12 5v14 M5 12h14',search:'M21 21l-5-5 M18 10a8 8 0 1 0-16 0 8 8 0 0 0 16 0',bell:'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4',calendar:'M4 5h16v16H4z M4 10h16 M8 3v4 M16 3v4',check:'m5 12 4 4L19 6',close:'m6 6 12 12 M6 18 18 6',settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2',download:'M12 3v12 m-4-4 4 4 4-4 M4 17v4h16v-4',clock:'M12 8v5l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',alert:'m12 3 10 18H2L12 3z M12 9v5 M12 17h.01',receipt:'M5 3h14v19l-4-2-3 2-3-2-4 2V3z M8 8h8 M8 12h8 M8 16h5',return:'M3 10h11a6 6 0 1 1 0 12 M3 10l6-6 M3 10l6 6',logout:'M9 4H3v16h6 M12 12h10 m-4-4 4 4-4 4',menu:'M4 6h16 M4 12h16 M4 18h16',shield:'m12 2 9 4v6c0 6-9 10-9 10S3 18 3 12V6l9-4z m-4 10 3 3 5-5',trash:'M3 6h18 M8 6V3h8v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7',store:'M3 3h18l1 7H2l1-7z M4 10v11h16V10 M9 21v-7h6v7',filter:'M4 6h16 M7 12h10 M10 18h4',truck:'M2 6h12v10H2z M14 9h4l4 4v3h-8z M6 19.5h.01 M18 19.5h.01',sun:'M12 3v2 M12 19v2 M3 12h2 M19 12h2 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2 M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0'};
const icon=(id,cls='')=>`<svg class="icon ${cls}" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[id]||paths.box}"/></svg>`;
const pages={dashboard:'Umumiy ko‘rinish',pos:'Yangi sotuv',inventory:'Mahsulotlar',lowstock:'Kam qoldiqlar',sales:'Sotuvlar tarixi',cash:'Kirim va chiqim',debts:'Qarzdorlar',employees:'Xodimlar',reports:'Hisobotlar',settings:'Sozlamalar',services:'Qo‘shimcha xizmatlar',admin:'Boshqaruv',intake:'Kirim topshiriqlari'};
const options=(list,value)=>list.map(x=>{const [v,l]=Array.isArray(x)?x:[x,x];return `<option value="${esc(v)}" ${v===value?'selected':''}>${esc(l)}</option>`;}).join('');
const button=(text,action,ic='plus',cls='primary',extra='')=>`<button class="btn ${cls}" data-action="${action}" ${extra}>${icon(ic)}${text}</button>`;
const empty=(title,sub='Boshqa filtrni tanlang yoki yangi ma’lumot qo‘shing.')=>`<div class="empty">${icon('box')}<b>${title}</b><p>${sub}</p></div>`;
const heading=(title,description,actions='')=>`<div class="page-heading"><div><div class="eyebrow">SAVDO NAZORAT OSTIDA</div><h1>${title}</h1><p>${description}</p></div><div class="heading-actions">${actions}</div></div>`;
const badge=id=>`<span class="owner-badge ${id}"><i></i>${name(id)}</span>`;
function brandMark(id,compact=false){const b=catalog(state).brands.find(b=>b.id===id)||catalog(state).brands.at(-1);return `<span class="brand-logo brand-${b.id} ${compact?'compact-logo':''}">${esc(b.mark)}</span>`;}
function title(p){return [productIdentity(p).model||p.name,audienceName(p.audience),p.material,p.qualityLabel||qualityLabel(p.quality)].filter(Boolean).join(' · ');}
function detail(p){return p.grouped?'Rang va naqshlar bir guruhda':variantLabel(p);}
function range(p){const [min,max]=priceRange(p);return min===max?money(max):money(min)+' – '+money(max);}
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('show');clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),4500);}
function mutate(fn){
  if(loadFailed)throw Error('Avvalgi ma’lumotni o‘qib bo‘lmadi. Avval zaxira nusxasini yuklab oling; eski yozuvlar ustiga yozilmadi.');
  const draft=structuredClone(state),before=draft.operations.length;
  const result=fn(draft);
  if(draft.operations.length===before)draft.operations.push({id:uid(),actor:user,kind:'catalog-or-settings',at:new Date().toISOString(),status:'local'});
  try{localStorage.setItem(KEY,JSON.stringify(draft));}catch{throw Error('Brauzerga saqlanmadi. Amal bajarilmadi; xotirani tekshiring yoki zaxira nusxasini oling.');}
  state=draft;return result;
}
const newOpId=()=>('op-'+uid()+'-'+Date.now().toString(36)).replace(/[^A-Za-z0-9_-]/g,'').slice(0,100);
function applySnapshot(snapshot){
  if(snapshot.version<serverVersion)return false;
  serverVersion=snapshot.version;lastFull=Date.now();state=prepareState(snapshot.view);lastReminders=snapshot.reminders||[];return true;
}
// One entry point for every change: the server in server mode, this browser's copy otherwise.
// A form keeps its operation id until the server answers, so a retry after a lost reply is never applied twice.
async function act(command,args={},form=null){
  if(!SERVER_MODE)return mutate(d=>runCommand(d,command,args,user));
  const opId=form?(form.dataset.opId||=newOpId()):newOpId();
  try{
    const response=await api.command(command,args,opId);
    if(form)delete form.dataset.opId;
    applySnapshot(response);
    return response.result;
  }catch(error){
    if(form&&error.status>0)delete form.dataset.opId;
    throw error;
  }
}
const fail=error=>{if(error?.status===401)authLost();else toast(error?.message||'Xatolik yuz berdi.');};
const later=promise=>promise.catch(fail);
const currentReminders=()=>SERVER_MODE?lastReminders:remindersFor(state,user);
const connectionLabel=()=>SERVER_MODE?(online?'Server':'Offline'):(online?'Mahalliy hisob':'Offline');
const menuNote=()=>SERVER_MODE?(online?'Ma’lumotlar serverda saqlanadi.':'Internet yo‘q. Yangi amallar bajarilmaydi.'):(online?'Yozuvlar shu brauzerda saqlanadi.':'Internet yo‘q. Mahalliy rejimda ishlayapsiz.');
function scope(extra={}){return {period,owner:boss()?owner:'all',seller:boss()?'all':user,...extra};}
function report(extra={}){return businessReport(state,scope(extra));}
function dateLabel(date){return new Date(date).toLocaleString('en-GB',{timeZone:'Asia/Tashkent',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).replaceAll('/','.');}
function periodBar(showOwner=true){const w=reportWindow(period);return `<div class="filter-bar"><div class="tabs">${[['today','Bugun'],['week','Hafta'],['month','Oy'],['year','Yil'],['all','Umumiy']].map(([id,label])=>`<button data-action="period" data-value="${id}" class="${period===id?'selected':''}">${esc(label)}</button>`).join('')}</div><div class="filter-right">${showOwner&&boss()&&page!=='employees'?`<label class="select-wrap">${icon('users')}<select id="owner-filter" aria-label="Mahsulot egasi">${options([['all','Barcha egalar'],...owners(state).map(o=>[o.id,o.name])],owner)}</select></label>`:''}<span class="date-range">${icon('calendar')}${period==='all'?'Barcha saqlangan yozuvlar':dateLabel(w.start)+' dan'}</span></div></div>`;}
function stat(label,value,ic,sub,featured=false,unit='so‘m',exact=false){return `<div class="stat-card ${featured?'featured':''}"><div class="stat-label">${label}<span class="stat-icon">${icon(ic)}</span></div><div class="stat-number">${exact?money(value):short(value)} <small>${unit}</small></div><div class="stat-bottom">${sub}</div></div>`;}
function render(){
  if(SERVER_MODE&&!session)return;
  const scrollPositions=page===renderedPage?new Map([...document.querySelectorAll('[data-scroll-key]')].map(el=>[el.dataset.scrollKey,el.scrollLeft])):new Map();
  TODAY=localDate();
  if(!canVisit(state,user,page))page='dashboard';
  document.title=pages[page]+' — TelefonZona';
  document.body.dataset.page=page;
  document.body.classList.toggle('has-mobile-cart',page==='pos'&&cart.length>0);
  const navItems=[['dashboard','grid'],['pos','bag'],['inventory','box'],['intake','truck'],['lowstock','alert'],['sales','receipt'],['services','settings'],['cash','wallet'],['debts','clock'],['employees','users'],['reports','chart'],['admin','settings']].filter(([id])=>canVisit(state,user,id));
  const stockAlerts=allowed('inventory')?activeProducts().filter(isLowStock).length:0;
  const alerts=stockAlerts+currentReminders().length+(boss()?state.notices.filter(n=>!n.read).length:0);
  $('#app').innerHTML=`<aside class="sidebar"><a href="#" class="brand" data-action="nav" data-page="dashboard"><span class="brand-mark">t<span>•</span></span>TelefonZona<span class="brand-dot">.</span></a><div class="shop-selector">${icon('store')}<div><b>${esc(state.settings.shop)}</b><small>Aksessuarlar do‘koni</small></div><span class="live-dot"></span></div><div class="nav-label">ISH MAYDONI</div><nav>${navItems.map(([id,ic])=>`<button class="nav-item ${page===id?'active':''}" data-action="nav" data-page="${id}" aria-label="${pages[id]}">${icon(ic)}<span>${id==='employees'&&!boss()?'Mening sotuvlarim':pages[id]}</span>${id==='pos'?'<span class="nav-plus">+</span>':''}${id==='intake'&&intakeBadge()?`<span class="nav-count">${intakeBadge()}</span>`:''}${id==='lowstock'&&stockAlerts?`<span class="nav-count">${stockAlerts}</span>`:''}${id==='debts'&&state.debts.some(d=>d.balance)?`<span class="nav-count">${state.debts.filter(d=>d.balance>0).length}</span>`:''}</button>`).join('')}</nav><div class="side-bottom"><div class="demo-card">${storageCard()}<span class="demo-pill">TELEFONZONA</span></div><button class="nav-item ${page==='settings'?'active':''}" data-action="nav" data-page="settings">${icon('settings')}Sozlamalar</button></div></aside><div class="workspace"><header class="topbar"><a href="#" class="mobile-brand" data-action="nav" data-page="dashboard" aria-label="TelefonZona asosiy sahifa"><span class="mobile-brand-mark">t</span><span>TelefonZona<small>${connectionLabel()}</small></span></a><div class="breadcrumb">Ish maydoni <span>/</span> <b>${pages[page]}</b></div><div class="top-actions"><button class="theme-trigger" data-action="themes" aria-label="Mavzuni tanlash" title="Mavzuni tanlash"><span class="theme-trigger-orbit" aria-hidden="true"></span><span class="theme-trigger-label">Mavzu</span></button><span class="connection ${online?'':'offline'}">${connectionLabel()}</span><button class="icon-btn notification" data-action="notifications" aria-label="Eslatmalar">${icon('bell')}${alerts?`<i></i>`:''}</button><div class="avatar">${people(state).find(u=>u.id===user).initials}</div>${roleSwitch()}</div></header><main>${({dashboard,pos,inventory,services:servicesPage,lowstock:lowStockPage,sales:salesPage,cash:cashPage,debts:debtsPage,employees,reports,settings,admin:adminPage,intake:intakePage})[page]()}</main><footer class="main-footer"><span>TelefonZona <b>•</b> Har bir savdo hisobda.</span><span>${TODAY} · UZS · Asia/Tashkent</span></footer></div>${mobileNavigation()}${mobileCartSummary()}`;
  prepareResponsiveContent($('#app'));
  for(const el of document.querySelectorAll('[data-scroll-key]'))el.scrollLeft=scrollPositions.get(el.dataset.scrollKey)||0;
  renderedPage=page;
}
function mobileNavigation(){
  const links=[['dashboard','grid','Asosiy'],['inventory','box','Ombor'],['pos','plus','Sotuv'],['sales','receipt','Tarix']].filter(([id])=>canVisit(state,user,id));
  return `<nav class="mobile-bottom-nav" aria-label="Mobil menyu" style="--mobile-nav-count:${links.length+1}">${links.map(([id,ic,label])=>`<button data-action="nav" data-page="${id}" class="mobile-nav-item ${id==='pos'?'mobile-sale-link':''} ${page===id?'active':''}" ${page===id?'aria-current="page"':''}>${icon(ic)}<span>${label}</span></button>`).join('')}<button class="mobile-nav-item ${links.some(([id])=>id===page)?'':'active'}" data-action="mobile-menu" aria-label="Barcha bo‘limlar">${icon('menu')}<span>Bo‘limlar</span></button></nav>`;
}
function mobileCartSummary(){
  if(page!=='pos'||!cart.length)return '';
  return `<button class="mobile-cart-summary" data-action="view-cart" aria-label="Savatni ko‘rish"><span class="mobile-cart-count">${icon('bag')}<b data-mobile-cart-count>${cart.reduce((sum,row)=>sum+row.qty,0)}</b></span><span><small>Jami savdo</small><b data-mobile-cart-total>${money(cartTotal())} <small>so‘m</small></b></span><span class="mobile-cart-go">Savat ${icon('arrow')}</span></button>`;
}
function mobileMenu(){
  const items=[['dashboard','grid'],['pos','bag'],['inventory','box'],['intake','truck'],['lowstock','alert'],['sales','receipt'],['services','settings'],['cash','wallet'],['debts','clock'],['employees','users'],['reports','chart'],['admin','settings'],['settings','settings']].filter(([id])=>canVisit(state,user,id));
  openModal('Barcha bo‘limlar',`<p class="mobile-menu-intro">${esc(name(user))} · ${boss()?'Boshliq':'Sotuvchi'}</p><div class="mobile-section-grid">${items.map(([id,ic])=>`<button class="mobile-section-link ${page===id?'selected':''}" data-action="nav" data-page="${id}" ${page===id?'aria-current="page"':''}>${icon(ic)}<span>${pages[id]}</span>${icon('arrow')}</button>`).join('')}</div><p class="mobile-menu-note">${menuNote()}</p>`);
}
function sharedWorkplace(){
  const debtRows=allowed('debts')?state.debts.filter(d=>d.balance>0&&!d.cancelledAt).sort((a,b)=>a.due.localeCompare(b.due)).slice(0,4):[];
  const products=allowed('inventory')?activeProducts().slice().reverse().slice(0,4):[];
  return `<section class="shared-workplace panel"><div class="panel-heading"><div><span class="eyebrow">HAMMA UCHUN ISH MAYDONI</span><h2>Bugungi ishlar</h2><p>${esc(name(user))} · sotuv, mahsulot va qarzlar bir joyda</p></div><span class="status">Umumiy kassa</span></div>
    <div class="quick-actions">${allowed('sell')?button('Yangi sotuv','nav','bag','primary','data-page="pos"'):''}${allowed('services')?button('Xizmat foydasini yozish','new-service','settings','secondary'):''}${allowed('products')&&allowed('stock')?button('Mahsulot qo‘shish','new-product','plus','secondary'):''}${allowed('inventory')?button('Barcha mahsulotlar','nav','box','secondary','data-page="inventory"'):''}${button('Kirim topshiriqlari','nav','truck','secondary','data-page="intake"')}${allowed('debts')?button('Qarzdorlar','nav','clock','secondary','data-page="debts"'):''}</div>
    <div class="shared-lists"><section><h3>Mahsulotlar va narxlar</h3>${products.map(p=>`<button class="shared-row" data-action="find-product" data-id="${p.id}"><span><b>${esc(title(p))}</b><small>${esc(name(p.owner))} · ${stock(p)} dona</small></span><strong>${range(p)}<small>so‘m</small></strong></button>`).join('')||'<p>Mahsulot kiritilgach, shu yerda ko‘rinadi.</p>'}</section>
    <section><h3>Ochiq qarzlar</h3>${debtRows.map(d=>`<button class="shared-row" data-action="debt-detail" data-id="${d.id}"><span><b>${esc(d.customer)}</b><small>${esc(d.phone)} · ${d.due}</small></span><strong>${money(d.balance)}<small>so‘m qoldi</small></strong></button>`).join('')||'<p>Ochiq qarz yo‘q.</p>'}</section></div></section>`;
}
function servicesPage(){
  requirePermission(state,user,'services');const w=reportWindow(period);
  const rows=state.services.filter(s=>(boss()?employee==='all'||s.worker===employee:s.worker===user)&&(!query||[s.title,s.note,name(s.worker)].join(' ').toLowerCase().includes(query.toLowerCase()))&&(inWindow(s,w)||s.cancelledAt&&inWindow({at:s.cancelledAt},w))).slice().reverse();
  const totals=businessReport(state,{period,seller:boss()?employee:user});
  return heading('Qo‘shimcha xizmatlar','Telefon ta’miri, oldi-sotdisi va boshqa xizmatlarning hisoblab bo‘lingan foydasi.',button('Xizmat qo‘shish','new-service'))+periodBar(false)+
    `<section class="panel service-overview"><div><span>${boss()?'Tanlangan xodimlar':'Mening'} xizmat foydasi</span><b>${money(totals.serviceProfit)} <small>so‘m</small></b></div><p>Faqat sof foyda yoziladi. Umumiy foyda va xizmatni bajargan xodim natijasiga qo‘shiladi. Kassaga alohida tushum yozilmaydi.</p></section>
    <section class="panel section-gap"><div class="list-toolbar">${searchbar('Xizmat yoki izohni qidiring…')}${boss()?`<label>Xodim<select id="employee-filter">${options([['all','Hammasi'],...people(state).map(p=>[p.id,p.name])],employee)}</select></label>`:''}</div>
    <div class="table-scroll"><table class="service-records"><thead><tr><th>XIZMAT / SANA</th><th>BAJARGAN XODIM</th><th>SOF FOYDA</th><th>IZOH / HOLAT</th><th>AMALLAR</th></tr></thead><tbody>${rows.map(s=>`<tr><td><b>${esc(s.title)}</b><small>${dateLabel(s.at)}</small></td><td>${badge(s.worker)}<small>Kiritgan: ${esc(name(s.actor))}</small></td><td><b>${money(s.profit)} so‘m</b></td><td>${esc(s.note)}${s.cancelledAt?`<small class="amber">${s.replacedBy?'Tahrirlangan':'Bekor qilingan'} · ${esc(s.cancelReason)}</small>`:'<small class="green-text">Foydaga qo‘shilgan</small>'}</td><td><div class="row-actions">${canEditService(state,s,user)?button('Tahrirlash','edit-service','settings','compact secondary',`data-id="${s.id}"`)+button('O‘chirish','delete-service','trash','compact danger',`data-id="${s.id}"`):'<span class="status">Tarixda saqlanadi</span>'}</div></td></tr>`).join('')}</tbody></table>${rows.length?'':empty('Xizmat hali kiritilmagan','Bajargan ishingizni va undan qolgan foydani yozing.')}</div></section>`;
}
function serviceModal(id){
  requirePermission(state,user,'services');const entry=state.services.find(s=>s.id===id);if(id&&!canEditService(state,entry,user))throw Error('Bu xizmatni o‘zgartirib bo‘lmaydi.');
  openModal(id?'Xizmatni tahrirlash':'Qo‘shimcha xizmat',`<form id="service-form" data-id="${id||''}">${field('Xizmat nomi','title','text',entry?.title||'','maxlength="100" placeholder="Masalan: iPhone ekranini almashtirish"')}<div class="form-grid">${boss()?select('Kim bajardi?','worker',people(state).map(p=>[p.id,p.name]),entry?.worker||user):`<div class="inline-note">Bajargan: <b>${esc(name(user))}</b></div>`}${field('Hisoblab bo‘lingan sof foyda · so‘m','profit','number',entry?.profit??'',numberExtra)}</div>${note('Xizmat haqida izoh',entry?.note||'')}<p class="form-help">Material va boshqa sarflarni o‘zingiz hisoblab, qolgan foydani yozing. Bu summani «Qo‘shimcha daromad»ga takror kiritmang. Tahrir va o‘chirish hisobda alohida iz qoldiradi.</p>${submit()}</form>`);
}
function editProductModal(id){
  requirePermission(state,user,'products');const p=state.products.find(p=>p.id===id);if(!p)throw Error('Mahsulot topilmadi.');
  openModal('Mahsulotni tahrirlash',`<form id="edit-product-form" data-id="${id}"><div class="form-grid">${field('Mahsulot nomi','name','text',p.name,'maxlength="60"')}${field('Model / xususiyati','variant','text',p.variant||p.model||p.name,'maxlength="90"')}${select('Brend','brand',catalog(state).brands.map(b=>[b.id,b.name]),p.brand||productIdentity(p).brand)}${select('Kategoriya','category',catalog(state).categories,p.category)}<label>Sifat<select name="quality">${options([['','Belgilanmagan'],...catalog(state).qualities.map(q=>[q.id,q.name])],p.quality||'')}</select></label>${boss()?select('Mahsulot egasi','owner',owners(state).map(o=>[o.id,o.name]),p.owner):`<input type="hidden" name="owner" value="${p.owner}">`}${p.grouped?field('Telefon modeli','model','text',p.model,'maxlength="60"')+select('Kim uchun','audience',[['','Belgilanmagan'],...AUDIENCES],p.audience||'')+select('G‘ilof turi','material',[['','Belgilanmagan'],...catalog(state).materials],p.material||''):''}${field('Kam qoldiq eslatmasi','min','number',stockLimit(p),'min="0" max="100000" step="1"')}${field('Eng kam narx','minPrice','number',p.minPrice??p.price,numberExtra+(allowed('prices')?'':' readonly'))}${field('Yuqori narx','price','number',p.price,'min="1" max="1000000000" step="1"'+(allowed('prices')?'':' readonly'))}</div><p class="form-help">O‘zgarish yangi sotuvlarga tegishli. Eski cheklardagi nom, egasi va tannarx saqlanadi. Qoldiq va partiya tannarxini «Kirimlar tarixi»da tuzating.</p>${submit()}</form>`,true);
}
function editDebtModal(id){
  requirePermission(state,user,'debts');const d=state.debts.find(d=>d.id===id);
  openModal('Qarzdor ma’lumotini tahrirlash',`<form id="edit-debt-form" data-id="${id}"><div class="form-grid">${field('Xaridor ismi','customer','text',d.customer,'maxlength="80"')}${field('Telefon','phone','tel',d.phone,'maxlength="22"')}${field('Qaytarish sanasi','due','date',d.due)}${boss()&&d.opening&&!d.cancelledAt?field('Boshlang‘ich qarz summasi','amount','number',d.original,'min="1" max="1000000000000" step="1"'):''}</div>${note('Qarz sababi / izoh',d.note)}<p class="form-help">Sotuvdan chiqqan qarz summasi chek va olingan to‘lovlarga bog‘liq. Summasi xato bo‘lsa, chek yoki qarz to‘lovini tahrirlang.</p>${submit()}</form>`);
}
function editMovementModal(id){
  const m=state.movements.find(m=>m.id===id);if(!canReverseMovement(m,user,state))throw Error('Bu yozuvni tahrirlab bo‘lmaydi.');
  openModal('Pul yozuvini tahrirlash',`<form id="edit-movement-form" data-id="${id}"><p class="inline-note">${flowName(m.kind)} · ${esc(name(m.actor))}</p><div class="form-grid">${field('To‘g‘ri summa','amount','number',m.amount,'min="1" max="1000000000000" step="1"')}${select('Pul manbasi / hisobi','account',['expense','rent-payment'].includes(m.kind)?[...ACCOUNTS,['personal','O‘z cho‘ntagimdan']]:ACCOUNTS,m.account)}</div>${m.kind==='expense'?field('Xarajat turi','category','text',m.category||'Boshqa','maxlength="60"'):''}${note('To‘g‘ri izoh va tuzatish sababi',m.note)}<p class="form-help">Eski yozuv bekor qilinib, to‘g‘risi hozirgi sana bilan yoziladi. Qarz to‘lovi va ijara qoldig‘i ham qayta hisoblanadi.</p>${submit('Tuzatishni saqlash')}</form>`);
}
function editSaleModal(id){
  const s=state.sales.find(s=>s.id===id),d=state.debts.find(d=>d.saleId===id);if(!s||s.returned||!boss()&&s.seller!==user)throw Error('Bu chekni tahrirlab bo‘lmaydi.');
  const received=(s.received??saleTotal(s))+(d?.payments.filter(p=>!p.voidedBy).reduce((sum,p)=>sum+p.amount,0)||0);
  openModal('Sotuvni tuzatish',`<form id="edit-sale-form" data-id="${id}"><p class="form-help">Eski chek qaytarilib, to‘g‘ri ma’lumotli yangi chek yoziladi. Qoldiq, qarz va kassa farqi birga hisoblanadi.</p>${s.items.map((item,index)=>`<div class="sale-correction-row">${select('Mahsulot va egasi','product-'+index,state.products.filter(p=>!p.archivedAt||p.id===item.productId).map(p=>[p.id,(p.archivedAt?'Olib tashlangan · ':'')+title(p)+' · '+name(p.owner)]),item.productId)}<div class="form-grid">${field('Soni · 0 bo‘lsa chekdan olinadi','qty-'+index,'number',item.qty,'min="0" max="100000" step="1"')}${field('Bir dona sotilgan narx','price-'+index,'number',item.price,numberExtra)}</div></div>`).join('')}<div class="form-grid">${boss()?select('Sotuvchi','seller',people(state).map(p=>[p.id,p.name]),s.seller):''}${field('Jami olingan pul','received','number',received,numberExtra)}${select('To‘lov turi','payment',['Naqd','Karta','O‘tkazma'],s.payment)}</div><p class="form-help">Nasiya qolsa quyidagilarni to‘ldiring.</p><div class="form-grid"><label>Xaridor ismi<input name="customer" value="${esc(d?.customer||'')}" maxlength="80"></label><label>Telefon<input name="phone" type="tel" value="${esc(d?.phone||'')}" maxlength="22"></label>${field('Qarz muddati','due','date',d?.due&&d.due>TODAY?d.due:TODAY)}</div>${note('Tuzatish sababi',s.note)}${submit('Chekni tuzatish')}</form>`,true);
}
function editClosingModal(id){bossGuard();const c=state.closings.find(c=>c.id===id);openModal('Kassa sanog‘ini tahrirlash',`<form id="edit-closing-form" data-id="${id}"><p class="inline-note">${c.date} · o‘sha paytdagi kutilgan pul ${money(c.expected)} so‘m</p><div class="form-grid">${field('Sanalgan jami pul','actual','number',c.actual,numberExtra)}${field('Ertangi qaytim','float','number',c.float??0,numberExtra)}</div>${select('Boshliqqa topshirilganmi?','handover',[['no','Faqat sanash'],['yes','Ha, sanalgan puldan qaytim ayrilib topshirilgan']],c.handover?'yes':'no')}${note('Izoh va tuzatish sababi',c.note)}<p class="form-help">Oldingi pul topshirish bekor qilinadi. To‘g‘rilangan topshirish hozirgi sanada qayd etiladi.</p>${submit()}</form>`);}
function defectHistory(){bossGuard();openModal('Nuqsonlar tarixi',`<div class="table-scroll"><table><thead><tr><th>MAHSULOT / IZOH</th><th>SONI / ZARAR</th><th>AMALLAR</th></tr></thead><tbody>${state.defects.slice().reverse().map(d=>`<tr><td><b>${esc(title(state.products.find(p=>p.id===d.productId)))}</b><small>${dateLabel(d.at)} · ${esc(d.note)}</small></td><td>${d.qty} dona<small>${money(d.cost)} so‘m zarar</small></td><td>${d.cancelledAt?'Bekor qilingan':button('Tahrirlash','edit-defect','settings','compact secondary',`data-id="${d.id}"`)+button('O‘chirish','delete-defect','trash','compact danger',`data-id="${d.id}"`)}</td></tr>`).join('')}</tbody></table>${state.defects.length?'':empty('Nuqson yozuvi yo‘q')}</div>`,true);}
function editDefectModal(id){bossGuard();const d=state.defects.find(d=>d.id===id);openModal('Nuqsonni tuzatish',`<form id="edit-defect-form" data-id="${id}">${field('Hisobdan chiqarilgan to‘g‘ri son','qty','number',d.qty,'min="1" max="100000" step="1"')}${note('Izoh va tuzatish sababi',d.note)}<p class="form-help">Avvalgi chiqarish qaytariladi va to‘g‘ri son qayta hisobdan chiqariladi. Qoldiq va zarar birga tuzatiladi.</p>${submit()}</form>`);}
function editPurchaseModal(id){bossGuard();const p=state.purchases.find(p=>p.id===id);openModal('Tovar kirimini tuzatish',`<form id="edit-purchase-form" data-id="${id}"><p class="inline-note">${esc(title(state.products.find(x=>x.id===p.productId)))} · ${p.date}</p><div class="form-grid">${field('To‘g‘ri kelgan soni','qty','number',p.qty,'min="1" max="100000" step="1"')}${field('Bir dona tannarxi','cost','number',p.cost,'min="1" max="1000000000" step="1"')}</div>${note('Kirim izohi va tuzatish sababi',p.note)}<p class="form-help">Sotilgan mahsulotlar tannarxi saqlanadi. Partiyadan savdo qilingan bo‘lsa, uning tannarxini o‘zgartirib yoki sarflangan sondan kam qilib bo‘lmaydi.</p>${submit()}</form>`);}
function catalogEditModal(kind,value){
  bossGuard();const item=catalog(state)[kind]?.find(x=>(typeof x==='string'?x:x.id)===value);if(!item)throw Error('Tasnif topilmadi.');
  openModal('Tasnifni tahrirlash',`<form id="edit-catalog-form" data-kind="${kind}" data-value="${esc(value)}">${field('Nom','name','text',typeof item==='string'?item:item.name,'maxlength="60"')}<p class="form-help">Bog‘langan mahsulotlarning tasnifi ham yangilanadi. Eski savdo yozuvlari saqlanadi.</p>${submit()}</form>`);
}
function confirmDelete(kind,id,extra={}){
  const descriptions={sale:'Chek bekor qilinadi: mahsulotlar omborga qaytadi, haqiqatda olingan pul kassadan ayriladi va qolgan qarz yopiladi. Eski chek tarixda saqlanadi.',closing:'Kassa sanog‘i bekor qilinadi. Unga bog‘langan faol pul topshirish yozuvlari ham teskari hisoblanadi. Tarix saqlanadi.',defect:'Hisobdan chiqarilgan mahsulotlar omborga qaytadi va zarari bekor qilish sanasida qaytariladi. Tarix saqlanadi.',product:'Mahsulot faol katalogdan olib tashlanadi. Qoldiq, partiyalar va eski cheklar tarixda saqlanadi. Uni Boshqaruvdan qayta tiklash mumkin.',service:'Xizmat foydasi umumiy va xodim natijasidan bekor qilish sanasida ayriladi. Tarixi qoladi. Kassa o‘zgarmaydi.',debt:'Avvaldan kiritilgan, to‘lovsiz qarz yopiladi. Qolgan summa olinadigan qarzdan chiqadi. Sotuvga bog‘langan qarz chek orqali tuzatiladi.',purchase:'Ishlatilmagan tovar kirimi bekor qilinadi. Shu partiya qoldig‘i olib tashlanadi va kirim uchun qayd etilgan pul kassaga qaytadi. Tarixi saqlanadi.',rent:'Oy uchun ijara foydadan ayrilmaydi. To‘langan ijara bo‘lsa, avval uning to‘lovlarini bekor qilish kerak.',movement:'Pul yozuvi bekor qilinadi. Uning kassa, qarz yoki xarajatga ta’siri teskari yozuv bilan tuzatiladi. Tarixda qoladi.',catalog:'Tasnif tanlovlardan olib tashlanadi. Unga bog‘langan mahsulotlar tanlangan boshqa tasnifga o‘tkaziladi. Eski cheklar saqlanadi.'};
  let label='',replacement='';
  if(kind==='catalog'){bossGuard();const list=catalog(state)[extra.kind],item=list.find(x=>(typeof x==='string'?x:x.id)===id);label=typeof item==='string'?item:item.name;replacement=select('Mahsulotlar qaysi tasnifga o‘tsin?','replacement',list.filter(x=>(typeof x==='string'?x:x.id)!==id).map(x=>typeof x==='string'?[x,x]:[x.id,x.name]));}
  else {const item=({product:state.products,service:state.services,debt:state.debts,purchase:state.purchases,rent:state.rents,movement:state.movements,sale:state.sales,closing:state.closings,defect:state.defects}[kind]||[]).find(x=>x.id===id);if(!item)throw Error('Yozuv topilmadi.');label=item.title||item.name||item.customer||item.note||item.month||item.id;}
  openModal('O‘chirilsinmi?',`<form id="delete-form" data-kind="${kind}" data-id="${esc(id)}" data-catalog-kind="${esc(extra.kind||'')}"><div class="delete-summary">${icon('alert')}<div><h3>${esc(label)}</h3><p>${descriptions[kind]}</p></div></div>${replacement}${note('O‘chirish sababi')}<div class="form-error" role="alert"></div><div class="modal-actions"><button type="button" class="btn secondary" data-action="close-modal">Yo‘q</button><button type="submit" class="btn danger">${icon('trash')}Ha, o‘chirilsin</button></div></form>`);
}
async function deleteRecord(form,data){
  const id=form.dataset.id,reason=data.note;
  const calls={
    product:()=>{if(!String(reason||'').trim())throw Error('O‘chirish sababini yozing.');return ['product.archive',{id,archive:true,note:reason}];},
    service:()=>['service.delete',{id,note:reason}],
    debt:()=>['debt.openingDelete',{id,note:reason}],
    purchase:()=>['stock.updatePurchase',{id,data:{note:reason},remove:true}],
    closing:()=>['closing.update',{id,data:{...data},remove:true}],
    defect:()=>['defect.update',{id,data:{...data},remove:true}],
    rent:()=>['rent.delete',{id,note:reason}],
    sale:()=>['sale.delete',{id,note:reason}],
    movement:()=>['movement.reverse',{id,note:reason}],
    catalog:()=>['catalog.remove',{kind:form.dataset.catalogKind,value:id,replacement:data.replacement}],
  };
  const build=calls[form.dataset.kind];
  if(!build)throw Error('O‘chirish turi topilmadi.');
  const [command,args]=build();
  await act(command,args,form);
}

function sellerHome(){
  return heading('Xayrli kun, '+esc(name(user)),'Mahsulotlar, qarzdorlar va xizmatlar hammaga qulay ish maydonida.')+remindersPanel()+sharedWorkplace()+
    `<section class="panel seller-home"><div class="identity-card"><span class="avatar identity-avatar">${esc(people(state).find(p=>p.id===user).initials)}</span><div><h2>${esc(name(user))}</h2><p>Sotuvchi · o‘z mahsulotlari egasi</p></div></div>
    <div class="quick-actions">${allowed('sell')?button('Yangi sotuv','nav','bag','primary','data-page="pos"'):''}${allowed('inventory')?button('Mahsulot va qoldiq','nav','box','secondary','data-page="inventory"'):''}${allowed('cash')?button('Kirim / chiqim','nav','wallet','secondary','data-page="cash"'):''}${allowed('debts')?button('Qarz to‘lovi','nav','clock','secondary','data-page="debts"'):''}${button('O‘z cheklarim','nav','receipt','secondary','data-page="sales"')}${allowed('services')?button('Mening xizmatlarim','nav','settings','secondary','data-page="services"'):''}</div>
    <p class="panel-copy">Har savdoda mahsulot egasi qayd etiladi va to‘lov umumiy kassaga tushadi. Umumiy tushum, foyda va xodimlar hisobotini faqat Otabek ko‘radi.</p></section>`;
}
function archivedProductsPanel(){const rows=state.products.filter(p=>p.archivedAt);return `<section class="panel section-gap"><div class="panel-heading"><div><h2>Olib tashlangan mahsulotlar</h2><p>Cheklar va partiyalar saqlanadi. Qoldiq ombor qiymatiga kiradi.</p></div><span class="count-badge">${rows.length}</span></div>${rows.map(p=>`<div class="shared-row"><span><b>${esc(title(p))}</b><small>${p.sku} · ${stock(p)} dona</small></span>${button('Tiklash','restore-product','return','secondary',`data-id="${p.id}"`)}</div>`).join('')||'<p class="panel-copy">Olib tashlangan mahsulot yo‘q.</p>'}</section>`;}
function adminPage(){
  bossGuard();
  const groups=[['categories','Mahsulot turlari','Masalan: Powerbank, Planshet aksessuarlari'],['materials','G‘ilof turlari','Masalan: Mat, Magnitli, Naqshli'],['qualities','Sifat guruhlari','Masalan: Original, Ekonom'],['brands','Brendlar','Masalan: Ugreen, Baseus']];
  return heading('Otabek boshqaruvi','Mahsulot turlari va xodim imkoniyatlarini o‘zingiz sozlang.')+
    `<div class="admin-overview"><div class="identity-card"><span class="avatar identity-avatar">OT</span><div><h2>${esc(name('aziz'))}</h2><p>Boshliq · savdo, xizmatlar, barcha hisobotlar va sozlamalar</p></div></div><div><b>3 ta mahsulot egasi · 1 ta umumiy kassa</b><p>${owners(state).map(p=>esc(p.name)).join(', ')} mahsulotlari alohida sanaladi.</p></div></div>
    <div class="quick-actions section-gap">${button('O‘zim sotuv kiritaman','nav','bag','primary','data-page="pos"')}${button('Kirim topshirish','new-intake','plus','secondary')}${button('Xizmat foydasini yozish','new-service','settings','secondary')}</div><section class="admin-section"><h2>Mahsulot tasniflari</h2><p>Yangi tur qo‘shilgach, u mahsulot kiritish va qidiruvda darhol chiqadi. Eski qoldiq va cheklar saqlanadi.</p>
    <div class="admin-catalog-grid">${groups.map(([kind,label,hint])=>`<section class="panel catalog-setting"><div class="panel-heading"><h3>${label}</h3><span class="count-badge">${catalog(state)[kind].length}</span></div><div class="catalog-tags">${catalog(state)[kind].map(item=>{const value=typeof item==='string'?item:item.id,label=typeof item==='string'?item:item.name;return `<div class="catalog-option-row"><b>${esc(label)}</b><div><button type="button" class="icon-btn" data-action="edit-catalog" data-kind="${kind}" data-id="${esc(value)}" aria-label="${esc(label)} tahrirlash">${icon('settings')}</button><button type="button" class="icon-btn" data-action="delete-catalog" data-kind="${kind}" data-id="${esc(value)}" aria-label="${esc(label)} o‘chirish">${icon('trash')}</button></div></div>`;}).join('')}</div><form class="catalog-option-form" data-kind="${kind}"><label>Yangi nom<input name="name" aria-label="Yangi ${label.toLocaleLowerCase()} nomi" maxlength="60" placeholder="${hint}" required></label><div class="form-error" role="alert"></div><button type="submit" class="btn secondary">${icon('plus')}Qo‘shish</button></form></section>`).join('')}</div></section>
    <section class="admin-section"><h2>Xodimlar va ruxsatlar</h2><p>Faqat yoqilgan amallar xodimda ko‘rinadi va bajariladi. Mahsulot qo‘shish yoqilsa, kirim huquqi ham yoqiladi. Umumiy hisobotlar, foyda, zaxira va boshqaruv faqat Otabekda qoladi.</p>
    <div class="staff-permissions-grid">${people(state).filter(p=>p.id!=='aziz').map(person=>`<form class="panel staff-permissions-form" data-person="${person.id}" aria-label="${esc(person.name)} ruxsatlari"><div class="identity-card"><span class="avatar identity-avatar">${esc(person.initials)}</span><div><h3>${esc(person.name)}</h3><p>Sotuvchi · mahsulot egasi</p></div></div><label class="staff-name-field">Xodim ismi<input name="name" value="${esc(person.name)}" maxlength="60" required></label><div class="permission-list">${PERMISSIONS.map(p=>`<label class="permission-toggle"><span>${esc(p.label)}</span><input type="checkbox" name="${p.id}" ${can(state,person.id,p.id)?'checked':''} aria-label="${esc(person.name+' — '+p.label)}"><span class="toggle-track" aria-hidden="true"></span></label>`).join('')}</div>${SERVER_MODE?`<button type="button" class="btn secondary" data-action="reset-password" data-id="${person.id}">${icon('shield')}Parolni tiklash</button>`:''}<div class="locked-report">${icon('shield')}Umumiy hisobotlar: faqat Otabek</div><div class="form-error" role="alert"></div><button type="submit" class="btn primary">${icon('check')}Ruxsatlarni saqlash</button></form>`).join('')}</div></section>
    ${archivedProductsPanel()}${adminNote()}`;
}
function dashboard(){
  if(!boss())return sellerHome();
  const m=report(),low=activeProducts().filter(isLowStock),balances=accountBalances(state);
  return heading(`Xayrli kun, ${name(user)}`,boss()?'Savdo, qoldiq va pul harakati — bir qarashda.':'Sotuvlaringiz va do‘kondagi mavjud mahsulotlar.',button('Yangi sotuv','nav','plus','primary','data-page="pos"'))+remindersPanel()+sharedWorkplace()+periodBar()+`<div class="stats-grid">${stat('Savdo summasi',m.revenue,'wallet',`${m.count} ta chek · nasiya bilan birga`,true)}${boss()?stat('Yalpi foyda',m.gross,'chart','Savdo − sotilgan mahsulot tannarxi'):stat('Cheklar',m.count,'receipt','O‘zingiz rasmiylashtirgan sotuvlar',false,'ta')}${stat('Sotilgan mahsulot',m.units,'box','Qaytarishlar hisobga olingan',false,'dona')}${boss()?stat('Sof natija',m.net,'chart',m.rentIncluded?'Kiritilgan xarajatlar va ijara ayrilgan':'Ijara ayrilmagan'):stat('Menga qaytariladigan pul',staffPayable(state,user),'wallet','O‘z cho‘ntagingizdan qilgan chiqimlar')}</div>
<div class="dashboard-grid"><section class="panel chart-panel"><div class="panel-heading"><div><h2>${boss()?'Pul va savdo alohida hisobda':'Tezkor amallar'}</h2><p>Barcha tushum va chiqimlar umumiy kassada</p></div>${icon('shield')}</div>${boss()?`<div class="balance-list">${ACCOUNTS.map(([id,label])=>`<div><span>${label}</span><b>${money(balances[id])} <small>so‘m</small></b></div>`).join('')}<div><span>Xaridorlardan olinadigan qarz</span><b>${money(state.debts.reduce((sum,d)=>sum+d.balance,0))} <small>so‘m</small></b></div></div>`:'<p class="panel-copy">Kelishilgan narxni yozing. Nasiya va narxdan tashqari sotuvda izoh qoldiring.</p>'}<div class="quick-actions">${button('Kirim / chiqim','flow','wallet','secondary')}${button('Qarzdorlar','nav','clock','secondary','data-page="debts"')}${boss()?button('Kunni yopish','close-day','check','secondary'):''}</div></section><section class="panel stock-alert"><div class="panel-heading"><div><h2>Kam qolgan mahsulotlar</h2><p>Takroriy xaridni oldindan rejalang</p></div><span class="count-badge">${low.length}</span></div>${low.slice(0,4).map(p=>`<button class="low-item" data-action="find-product" data-id="${p.id}"><span class="product-thumb">${brandMark(productIdentity(p).brand,true)}</span><span class="low-text"><b>${esc(title(p))}</b><small>${esc(p.name)} · ${name(p.owner)} · Chegara ${stockLimit(p)}</small></span><span class="stock-number">${stock(p)}<small>dona</small></span></button>`).join('')||empty('Qoldiq yetarli')}<button class="text-link" data-action="lowstock">Barcha kam qoldiqlar ${icon('arrow')}</button></section></div>
${boss()&&debtReminders(state).length?`<div class="info-banner section-gap">${icon('bell')}<span><b>${debtReminders(state).length} ta qarzning muddati keldi.</b> Qarzdorlar bo‘limida telefon va qolgan summa tayyor.</span>${button('Ko‘rish','nav','arrow','secondary','data-page="debts"')}</div>`:''}<section class="panel section-gap"><div class="panel-heading"><div><h2>So‘nggi sotuvlar</h2><p>Haqiqiy sotilgan narx va to‘lov holati</p></div>${button('Barchasi','nav','arrow','secondary','data-page="sales"')}</div>${salesTable(filteredSales().slice(0,5))}</section>` ;
}
function searchbar(placeholder='Model yoki mahsulotni qidiring…'){return `<label class="search-field">${icon('search')}<input id="search" type="search" enterkeyhint="search" value="${esc(query)}" aria-label="${placeholder}" placeholder="${placeholder}" autocomplete="off"></label>`;}
function activeProducts(){return state.products.filter(p=>!p.archivedAt);}
function visibleProducts(){return filterCatalog(activeProducts(),{brand,series,query,category,quality}).filter(p=>(audience==='all'||p.audience===audience)&&(material==='all'||p.material===material)&&(catalogOwner==='all'||p.owner===catalogOwner));}
function catalogFilters(){
  const list=seriesFor(brand),b=catalog(state).brands.find(b=>b.id===brand);
  return `<section class="catalog-browser"><div class="catalog-filter-heading"><b>Brend → seriya → model</b><button class="small-link" data-action="catalog-reset">Filtrlarni tozalash</button></div><div class="brand-grid" aria-label="Brendlar" data-scroll-key="brands"><button class="brand-card ${brand==='all'?'selected':''}" data-action="brand" data-value="all"><span class="all-brands">Hammasi</span><small>${activeProducts().length} guruh</small></button>${catalog(state).brands.map(b=>`<button class="brand-card ${brand===b.id?'selected':''}" data-action="brand" data-value="${b.id}">${brandMark(b.id)}<span>${esc(b.name)}</span></button>`).join('')}</div>${list.length?`<div class="series-header"><b>${b.name} seriyalari</b><span>Qidiruvdan to‘g‘ridan-to‘g‘ri ham topasiz</span></div><div class="series-grid" data-scroll-key="series"><button class="series-card ${series==='all'?'selected':''}" data-action="series" data-value="all"><b>Hammasi</b></button>${list.map(s=>`<button class="series-card ${series===s.id?'selected':''}" data-action="series" data-value="${s.id}"><b>${s.name}</b><small>${s.hint}</small></button>`).join('')}</div>`:''}${searchbar('Modelni qidiring: S23, S23+, S23U, iPhone 15PM…')}<div class="search-caption"><span><b>${visibleProducts().length} ta guruh</b> topildi</span><span>Plus = + · Ultra = U · Pro = P · Pro Max = PM</span></div></section>
<div class="category-tabs" data-scroll-key="categories">${[['all','Barchasi'],...catalog(state).categories.map(c=>[c,c])].map(([id,label])=>`<button data-action="category" data-value="${id}" class="${category===id?'selected':''}">${esc(label)}</button>`).join('')}</div>
<div class="flat-filters" data-scroll-key="filters"><label>Mahsulot egasi<select id="catalog-owner">${options([['all','Uchala egasi'],...owners(state).map(o=>[o.id,o.name])],catalogOwner)}</select></label><label>Kim uchun<select id="audience-filter">${options([['all','Barchasi'],...AUDIENCES],audience)}</select></label><label>G‘ilof turi<select id="material-filter">${options([['all','Barchasi'],...catalog(state).materials.map(m=>[m,m])],material)}</select></label><label>Sifat<select id="quality-filter">${options([['all','Barchasi'],...catalog(state).qualities.map(t=>[t.id,t.name])],quality)}</select></label></div>`;
}
function productCard(p){const available=stock(p),inCart=cart.find(r=>r.productId===p.id)?.qty||0;return `<button class="product-card simple-product" data-action="add-cart" data-id="${p.id}" ${available<=inCart?'disabled':''} aria-label="${esc(title(p)+' · '+p.name+' · egasi '+name(p.owner))} savatga qo‘shish"><div class="product-card-top">${brandMark(productIdentity(p).brand)}<span class="stock-label ${isLowStock(p)?'low':''}">${available} dona</span></div><div class="product-meta">${p.quality?`<span class="quality-badge quality-${esc(p.quality)}">${esc(qualityLabel(p.quality))}</span>`:''}<b class="model-name">${esc(productIdentity(p).model||p.name)}</b><span class="accessory-name">${esc([audienceName(p.audience),p.material||p.name].filter(Boolean).join(' · '))}</span><p>${esc(detail(p))}</p><span class="card-owner">${name(p.owner)}</span><div><strong>${range(p)} <small>so‘m</small></strong><span class="card-add">+</span></div>${p.minPrice===undefined?'<small class="range-unset">Narx oralig‘i hali belgilanmagan</small>':''}</div></button>`;}
function addCart(id){requirePermission(state,user,'sell');const p=state.products.find(p=>p.id===id),row=cart.find(r=>r.productId===id);if(!p||(row?.qty||0)>=stock(p))throw Error('Omborda yetarli mahsulot yo‘q.');if(row)row.qty++;else cart.push({productId:id,owner:p.owner,qty:1,price:p.price});render();}
function cartItem(row){const p=state.products.find(p=>p.id===row.productId);return `<div class="cart-item"><div class="cart-info"><b>${esc(title(p))}</b><small>${esc(p.name)} · ${name(p.owner)}</small><label class="cart-owner-selector">Mahsulot egasi<select data-cart-owner="${p.id}" aria-label="Mahsulot egasi: ${esc(title(p))}">${owners(state).map(o=>{const alternatives=ownerAlternatives(state,p).filter(x=>x.owner===o.id),qty=alternatives.reduce((sum,x)=>sum+stock(x),0);return `<option value="${o.id}" ${o.id===p.owner?'selected':''} ${qty<row.qty?'disabled':''}>${esc(o.name)} · ${qty} dona${qty<row.qty?' · qoldiq yetmaydi':''}</option>`;}).join('')}</select></label><div class="cart-controls"><div class="stepper"><button data-action="cart-minus" data-id="${p.id}" aria-label="Kamaytirish">−</button><b>${row.qty}</b><button data-action="cart-plus" data-id="${p.id}" aria-label="Ko‘paytirish">+</button></div></div><label class="negotiated-price">Kelishilgan narx · 1 dona<span><input type="number" min="${allowed('priceException')?0:priceRange(p)[0]}" max="${allowed('priceException')?1e9:p.price}" step="1" data-price="${p.id}" value="${row.price}" aria-label="Kelishilgan narx: ${esc(title(p))}" required><span>so‘m</span></span></label><p class="price-note" data-price-note="${p.id}">${priceNote(row)}</p></div></div>`;}
function priceNote(row){const p=state.products.find(p=>p.id===row.productId);return `Oraliq: ${range(p)} so‘m${outsideRange(p,row.price)?' · Chegaradan tashqari, izoh kerak':''}`;}
function cartTotal(){return cart.reduce((sum,row)=>sum+row.qty*row.price,0);}
function pos(){return heading('Yangi sotuv','Modelni toping, guruhni tanlang va kelishilgan narxni yozing.',`<span class="seller-chip">Sotuvchi: ${name(user)}</span>`)+`<div class="pos-layout"><section class="catalog">${catalogFilters()}<div class="product-grid">${visibleProducts().map(productCard).join('')||(state.products.length?empty('Mahsulot topilmadi','Model, kim uchun va g‘ilof turi filtrlarini tekshiring.'):empty('Ombor bo‘sh',allowed('products')?'Mahsulotlarni Ombor bo‘limidan kiriting.':'Mahsulot kiritilgach, shu yerda ko‘rinadi.'))}</div></section><aside class="cart-panel panel" id="current-cart" tabindex="-1" aria-label="Joriy savat"><div class="panel-heading"><h2>Joriy savdo <span class="count-badge">${cart.reduce((s,r)=>s+r.qty,0)}</span></h2><button class="icon-btn" data-action="clear-cart" aria-label="Savatni tozalash">${icon('trash')}</button></div><div class="cart-items">${cart.length?cart.map(cartItem).join(''):empty('Savat bo‘sh','Mahsulot guruhini tanlang.')}</div><div class="cart-bottom"><div class="cart-note">${icon('shield')}Katalog narxi va tannarx Otabek ruxsati bilan o‘zgartiriladi</div><div class="cart-total"><span>Jami savdo</span><b id="cart-total">${money(cartTotal())}<small> so‘m</small></b></div>${button('To‘lov va yakunlash','checkout','check','primary full',cart.length?'':'disabled')}<p class="cart-footnote">Naqd, karta yoki qisman nasiya. Narxdan tashqari sotuvga sabab yoziladi.</p></div></aside></div>`;}
function lowStockPage() {
  requirePermission(state,user,'inventory');
  const all=activeProducts().filter(isLowStock);
  const rows=all.filter(product=>(catalogOwner==='all'||product.owner===catalogOwner)&&matchesProduct(product,query))
    .sort((left,right)=>stock(left)-stock(right));
  const emptyTitle=all.length?'Mos mahsulot topilmadi':'Kam qoldiq yo‘q';
  const emptyCopy=state.products.length?'Qoldiq belgilangan chegaraga tushganda shu yerda ko‘rinadi.':'Mahsulot qo‘shishda eslatma chegarasini belgilang.';
  return heading('Kam qoldiqlar','Har bir mahsulot guruhi o‘z eslatma chegarasi bo‘yicha tekshiriladi.',
    button('Mahsulotlar','nav','box','secondary','data-page="inventory"'))+
    `<div class="low-stock-summary"><span><b>${all.length}</b> ta guruh kamaygan</span><span><b>${all.filter(product=>stock(product)===0).length}</b> ta guruh tugagan</span></div>
    <section class="panel"><div class="list-toolbar">${searchbar('Model, mahsulot yoki SKU…')}
    <label class="low-stock-owner">Mahsulot egasi<select id="catalog-owner">${options([['all','Barcha egalar'],...owners(state).map(person=>[person.id,person.name])],catalogOwner)}</select></label></div>
    <div class="low-stock-list">${rows.map(product=>`<article class="low-stock-card">
      <div class="low-stock-card-title"><span class="product-thumb">${brandMark(productIdentity(product).brand,true)}</span>
        <div><h2>${esc(title(product))}</h2><p>${esc(product.name)} · ${esc(product.sku)} · ${esc(name(product.owner))}</p></div></div>
      <div class="low-stock-quantities"><span class="low-stock-remaining"><small>${stock(product)===0?'Tugagan':'Qoldiq'}</small><b>${stock(product)} <small>dona</small></b></span>
        <span><small>Eslatma chegarasi</small><b>${stockLimit(product)} <small>dona</small></b></span></div>
      <div class="low-stock-actions">${allowed('stock')?button('Tovar kiritish','purchase','plus','secondary',`data-id="${product.id}"`):''}
        ${allowed('products')?button('Chegarani o‘zgartirish','stock-limit','bell','secondary',`data-id="${product.id}"`):''}
        ${button('Mahsulotni ko‘rish','find-product','box','secondary',`data-id="${product.id}"`)}</div>
    </article>`).join('')||empty(emptyTitle,emptyCopy)}</div></section>`;
}
function inventory(){
  const rows=visibleProducts(),value=inventoryValue(state.products);
  return heading('Mahsulotlar','Model → kim uchun → g‘ilof turi → sifat. Rang va naqshlar birga sanaladi.',allowed('products')&&allowed('stock')?button('G‘iloflarni tez kiritish','case-groups')+button('Boshqa mahsulot','new-product','plus','secondary'):'')+`<div class="inventory-summary"><span><b>${activeProducts().length}</b> guruh</span><span><b>${activeProducts().reduce((s,p)=>s+stock(p),0)}</b> dona omborda</span><span class="amber"><b>${activeProducts().filter(isLowStock).length}</b> kam qolgan</span></div>${boss()?`<div class="inventory-values"><div><span>Ombordagi mahsulot tannarxi</span><b>${money(value.cost)} <small>so‘m</small></b></div><div><span>Yuqori narx bo‘yicha qiymati</span><b>${money(value.retail)} <small>so‘m</small></b></div><p>Sotilmagan zaxira foydadan ayrilmaydi.</p></div>`:''}<section class="panel inventory-panel">${catalogFilters()}<div class="list-toolbar">${button('Kam qoldiqlar','lowstock','alert','secondary')}${boss()?button('Kirimlar tarixi','purchase-history','download','secondary')+button('Nuqsonlar tarixi','defect-history','alert','secondary'):''}${button('CSV','export-products','download','secondary')}</div><div class="table-scroll"><table class="inventory-records"><thead><tr><th>MAHSULOT GURUHI</th><th>EGASI</th><th>NARX ORALIG‘I</th><th>QOLDIQ</th><th>AMALLAR</th></tr></thead><tbody>${rows.map(p=>`<tr><td><div class="product-cell"><span class="product-thumb">${brandMark(productIdentity(p).brand,true)}</span><div><b>${esc(title(p))}</b><small>${esc(p.name)} · ${esc(detail(p))}</small><span class="sku">${esc(p.sku)}</span></div></div></td><td>${badge(p.owner)}</td><td><b>${range(p)}</b><small>so‘m${p.minPrice===undefined?' · oraliq belgilanmagan':''}</small></td><td><span class="status ${isLowStock(p)?'warning':''}">${stock(p)} dona</span><small>Eslatma chegarasi ${stockLimit(p)} dona</small></td><td><div class="row-actions">${allowed('stock')?button('Kirim','purchase','plus','compact secondary',`data-id="${p.id}"`):''}${allowed('products')?button('Eslatma','stock-limit','bell','compact secondary',`data-id="${p.id}"`):''}${allowed('prices')?button('Narx','catalog-price','settings','compact secondary',`data-id="${p.id}"`):''}${allowed('products')?button('Tahrirlash','edit-product','settings','compact secondary',`data-id="${p.id}"`):''}${boss()?button('O‘chirish','delete-product','trash','compact danger',`data-id="${p.id}"`):''}${allowed('defects')?button('Nuqson','defect','alert','compact secondary',`data-id="${p.id}"`):''}</div></td></tr>`).join('')}</tbody></table>${rows.length?'':empty('Mahsulot topilmadi')}</div></section>`;
}
function filteredSales(){const w=reportWindow(period);return state.sales.filter(s=>(boss()||s.seller===user)&&(owner==='all'||s.items.some(i=>i.owner===owner))&&(inWindow(s,w)||s.returnAt&&inWindow({at:s.returnAt},w))).slice().reverse();}
function salesTable(rows){if(!rows.length)return empty('Sotuv topilmadi','Davrni o‘zgartiring yoki yangi sotuv kiriting.');return `<div class="table-scroll"><table class="sales-records"><thead><tr><th>CHEK / SANA</th><th>MAHSULOT</th><th>SOTUVCHI / KASSA</th><th>JAMI SAVDO</th><th>HOLATI</th><th></th></tr></thead><tbody>${rows.map(s=>{const debt=state.debts.find(d=>d.saleId===s.id);return `<tr><td><b>#${s.id}</b><small>${s.date} · ${s.time}</small></td><td><b>${esc(title(s.items[0]))}${s.items.length>1?' +'+(s.items.length-1):''}</b><small>${s.items.reduce((sum,i)=>sum+i.qty,0)} dona · ${[...new Set(s.items.map(i=>name(i.owner)))].join(', ')}</small></td><td><b>${name(s.seller)}</b><small>${esc(s.payment)} · Umumiy kassa</small></td><td><b>${money(saleTotal(s))}</b><small>so‘m</small></td><td><span class="status ${s.returned?'returned':debt?.balance?'warning':''}">${s.returned?'Qaytarilgan':debt?.balance?'Nasiya: '+money(debt.balance):'To‘langan'}</span>${s.exception?'<small class="amber">Narxdan tashqari</small>':''}</td><td><button class="icon-btn" data-action="receipt" data-id="${s.id}" aria-label="${s.id} tafsilotlari">${icon('arrow')}</button></td></tr>`;}).join('')}</tbody></table></div>`;}
function salesPage(){const rows=filteredSales().filter(s=>s.id.toLowerCase().includes(query.toLowerCase())||name(s.seller).toLowerCase().includes(query.toLowerCase())||s.items.some(i=>matchesProduct(i,query)));salesIndex=Math.min(salesIndex,Math.max(0,Math.ceil(rows.length/20)-1));return heading('Sotuvlar tarixi',boss()?'Kim nima sotdi, pul qayerga tushdi va qancha qarz qoldi.':'O‘zingiz rasmiylashtirgan sotuvlar. Boshqa sotuvchining chekini raqami bilan ham topasiz.',button('Chek raqami orqali topish','find-receipt','search','secondary'))+periodBar()+`<section class="panel"><div class="list-toolbar">${searchbar('Chek, model yoki sotuvchini qidiring…')}${button('CSV','export-sales','download','secondary')}</div>${salesTable(rows.slice(salesIndex*20,(salesIndex+1)*20))}<div class="table-foot">${rows.length} ta sotuv · ${salesIndex+1}-sahifa<div class="pagination">${button('Oldingi','sales-prev','arrow','compact secondary',salesIndex===0?'disabled':'')}${button('Keyingi','sales-next','arrow','compact secondary',(salesIndex+1)*20>=rows.length?'disabled':'')}</div></div></section>`;}
function rentPanel(){return `<section class="panel section-gap"><div class="panel-heading"><div><h2>Oylik ijara</h2><p>Oy foydasidan bir marta ayriladi. To‘lov pul harakatida alohida.</p></div>${boss()?button('Oy uchun belgilash','rent','store','secondary'):''}</div><div class="table-scroll"><table><thead><tr><th>OY / IZOH</th><th>KELISHILGAN IJARA</th><th>TO‘LANGAN</th><th>QOLDIQ</th><th></th></tr></thead><tbody>${state.rents.slice().sort((a,b)=>b.month.localeCompare(a.month)).map(r=>`<tr><td><b>${r.month}</b><small>${esc(r.note)}${r.cancelledAt?' · Bekor qilingan':''}</small></td><td>${money(r.amount)} so‘m</td><td>${money(r.paid)} so‘m</td><td><b>${money(r.amount-r.paid)} so‘m</b></td><td>${boss()&&!r.cancelledAt?button('Tahrirlash','rent','settings','compact secondary',`data-id="${r.id}"`)+button('O‘chirish','delete-rent','trash','compact danger',`data-id="${r.id}"`):''}${!r.cancelledAt&&r.amount>r.paid&&allowed('cash')?button('To‘lash','pay-rent','wallet','compact secondary',`data-id="${r.id}"`):`<span class="status">${r.cancelledAt?'Bekor qilingan':'To‘langan'}</span>`}</td></tr>`).join('')}</tbody></table>${state.rents.length?'':empty('Ijara belgilanmagan','Boshliq oy va kelishilgan summani yozadi.')}</div></section>`;}
function cashPage(){
  const balances=accountBalances(state);
  const rows=state.movements.filter(m=>boss()||m.actor===user);
  const legacy=state.expenses.filter(e=>!e.ledger).map(e=>({...e,kind:'expense',actor:e.owner,account:CASH_ACCOUNT}))
    .concat(state.purchases.filter(p=>!p.deletedAt).map(p=>({...p,kind:'purchase',amount:p.qty*p.cost,actor:p.actor||'aziz',account:p.account||CASH_ACCOUNT,note:p.note||'Tovar kirimi'})));
  const needle=query.trim().toLowerCase();
  const visible=[...rows,...legacy.filter(e=>boss()||e.actor===user)]
    .filter(m=>!needle||[m.note,name(m.actor),flowName(m.kind),m.amount].join(' ').toLowerCase().includes(needle))
    .sort((a,b)=>eventTime(b)-eventTime(a));
  return heading('Kirim va chiqim','Har bir pul harakati: kim, qayerdan, qayerga va nima uchun.',button('Pul harakatini yozish','flow','plus'))+
    (boss()?`<div class="stats-grid three">${ACCOUNTS.map(([id,label])=>stat(label,balances[id],'wallet','Hisob bo‘yicha kutilayotgan qoldiq',id===CASH_ACCOUNT,'so‘m',true)).join('')}</div>`:'')+
    `<div class="info-banner">${icon('shield')}<span>Xato yozuvni tafsilotidan sabab bilan bekor qiling, keyin to‘g‘risini kiriting. Eski yozuv saqlanadi; tuzatish bugungi sanada hisoblanadi.</span></div>
    <section class="panel"><div class="panel-heading"><div><h2>${boss()?'Pul harakatlari':'Men kiritgan harakatlar'}</h2><p>Sotuv, qarz to‘lovi va ijara to‘lovi ham shu yerda</p></div></div>
    <div class="list-toolbar">${searchbar('Izoh, xodim yoki summani qidiring…')}</div>
    <div class="table-scroll"><table class="movement-records"><thead><tr><th>SANA / XODIM</th><th>AMAL / HISOB</th><th>IZOH</th><th>SUMMA / HOLAT</th><th></th></tr></thead><tbody>${visible.map(m=>`<tr>
      <td>${m.date||localDate(new Date(m.at))}<small>${name(m.actor)}</small></td>
      <td><b>${flowName(m.kind)}</b><small>${accountName(m.account)}${m.kind==='transfer'?' · avvalgi o‘tkazma':''}${m.kind==='reimbursement'?' → '+name(m.person):''}</small></td>
      <td>${esc(m.note)}${m.reference?`<small>${esc(movementReference(m))}</small>`:''}</td>
      <td><b>${money(m.amount)} so‘m</b>${m.voidedBy?'<small class="amber">Bekor qilingan · tarixda saqlanadi</small>':m.kind==='reversal'?'<small class="green-text">Tuzatish yozuvi</small>':''}</td>
      <td>${state.movements.some(x=>x.id===m.id)?button('Tafsilot','movement-detail','receipt','compact secondary',`data-id="${esc(m.id)}"`):'<small>Avvalgi yozuv</small>'}</td>
    </tr>`).join('')}</tbody></table>${visible.length?'':empty('Harakat topilmadi')}</div></section>
    <section class="panel section-gap"><div class="panel-heading"><div><h2>Xodimga qaytariladigan pul</h2><p>O‘z cho‘ntagidan qilgan xarajatlar va kassaga qo‘shgan pul</p></div></div><div class="balance-list">${people(state).filter(u=>u.id!=='aziz'&&(boss()||u.id===user)).map(u=>`<div><span>${u.name}</span><b>${money(staffPayable(state,u.id))} so‘m</b></div>`).join('')}</div></section>${boss()?rentPanel()+closingPanel():''}`;
}
function movementReference(m){
  if(m.kind==='debt-payment')return state.debts.find(d=>d.id===m.reference)?.customer||'Qarz to‘lovi';
  if(m.kind==='rent-payment')return state.rents.find(r=>r.id===m.reference)?.month||'Ijara';
  if(m.kind==='withdrawal'&&state.closings.some(c=>c.id===m.reference))return 'Kun yakunida pul topshirish';
  return m.reference;
}
function flowName(kind){return FLOW_KINDS.find(([id])=>id===kind)?.[1]||({transfer:'Hisoblar orasidagi avvalgi o‘tkazma','sale-payment':'Sotuv to‘lovi','debt-payment':'Qarz to‘lovi',refund:'Xaridorga pul qaytarish','rent-payment':'Ijara to‘lovi',purchase:'Tovar kirimi uchun to‘lov',reversal:'Yozuvni bekor qilish'})[kind]||kind;}
function closingPanel(){
  return `<section class="panel section-gap"><div class="panel-heading"><div><h2>Kun oxiridagi kassa</h2><p>Umumiy kassadagi sanalgan pul, ertangi qaytim va topshirilgan pul.</p></div>${button('Sanash va yopish','close-day','check','secondary')}</div>
    ${state.closings.length?`<div class="table-scroll"><table><thead><tr><th>SANA</th><th>KUTILGAN / SANALGAN</th><th>FARQ</th><th>ERTANGI QAYTIM</th><th></th></tr></thead><tbody>${state.closings.slice().reverse().map(c=>`<tr><td>${c.date}<small>${esc(c.note||'Avvalgi tekshiruv')}</small></td><td>${money(c.expected)} / ${money(c.actual)}</td><td><b class="${c.actual===c.expected?'green-text':'amber'}">${money(c.actual-c.expected)}</b></td><td>${c.float===undefined?'—':money(c.float)}</td><td>${button('Tafsilot','closing-detail','receipt','compact secondary',`data-id="${esc(c.id)}"`)}${!c.cancelledAt?button('Tahrirlash','edit-closing','settings','compact secondary',`data-id="${c.id}"`)+button('O‘chirish','delete-closing','trash','compact danger',`data-id="${c.id}"`):'<small>Bekor qilingan</small>'}</td></tr>`).join('')}</tbody></table></div>`:empty('Kassa hali sanalmagan','Umumiy kassani sanab, ertangi qaytimni belgilang.')}</section>`;
}
function debtsPage(){requirePermission(state,user,'debts');const rows=state.debts.filter(d=>!query||[d.customer,d.phone,d.note].join(' ').toLowerCase().includes(query.toLowerCase())).slice().sort((a,b)=>(b.balance>0)-(a.balance>0)||a.due.localeCompare(b.due));return heading('Qarzdorlar','Qisman to‘lov, qolgan qarz va va’da qilingan sana — bir joyda.',boss()?button('Avvalgi qarzni kiritish','opening-debt','plus','secondary'):'')+(boss()?`<div class="stats-grid three">${stat('Jami olinadigan qarz',state.debts.reduce((s,d)=>s+d.balance,0),'wallet','Nasiya savdolaridan qolgan qism',true)}${stat('Muddat kelgan',debtReminders(state).reduce((s,d)=>s+d.balance,0),'clock',debtReminders(state).length+' ta qarz')}${stat('Ochiq qarzlar',state.debts.filter(d=>d.balance>0).length,'users','Ism va telefon bilan',false,'ta')}</div>`:'')+`<div class="info-banner">${icon('bell')}<span>${debtBanner()}</span></div><section class="panel"><div class="list-toolbar">${searchbar('Ism yoki telefonni qidiring…')}</div><div class="table-scroll"><table class="debt-records"><thead><tr><th>XARIDOR</th><th>CHEK / SABAB</th><th>MUDDAT</th><th>BOSHLANG‘ICH / QOLDIQ</th><th></th></tr></thead><tbody>${rows.map(d=>`<tr><td><b>${esc(d.customer)}</b><a class="phone-link" href="tel:${esc(d.phone.replace(/[^+\d]/g,''))}">${esc(d.phone)}</a></td><td><b>${esc(d.saleId||'Avvaldan qolgan qarz')}</b><small>${esc(d.note)}</small></td><td><span class="status ${d.balance&&d.due<=TODAY?'warning':''}">${d.due}</span></td><td>${money(d.original)}<small><b>${money(d.balance)} so‘m qoldi</b>${d.cancelledAt?' · chek qaytarilgan':''}</small></td><td>${button('Tafsilot','debt-detail','receipt','compact secondary',`data-id="${d.id}"`)}${button('Tahrirlash','edit-debt','settings','compact secondary',`data-id="${d.id}"`)}${boss()&&d.opening&&!d.cancelledAt?button('O‘chirish','delete-debt','trash','compact danger',`data-id="${d.id}"`):''}${d.balance?button('To‘lov olish','repay','wallet','compact primary',`data-id="${d.id}"`):'<span class="status">Yopilgan</span>'}</td></tr>`).join('')}</tbody></table>${rows.length?'':empty('Qarzdor yo‘q','Sotuvni yakunlashda qisman to‘lovni tanlasangiz, bu yerga tushadi.')}</div></section>`;}
function employees(){
  bossGuard();
  const persons=boss()?people(state):people(state).filter(u=>u.id===user),w=reportWindow(period);
  const rows=state.sales.filter(s=>(boss()?employee==='all'||s.seller===employee:s.seller===user)&&inWindow(s,w)).slice().reverse().flatMap(s=>s.items.map(i=>({s,i})));
  return heading(boss()?'Jamoa va sotuvlar':'Mening sotuvlarim','Sotuvchi savdosi bilan mahsulot egaligi alohida hisoblanadi.')+periodBar()+`<div class="employee-grid">${persons.map(u=>{const m=businessReport(state,{period,seller:u.id,owner:'all'});return `<section class="panel employee-card"><div class="employee-top"><span class="avatar large">${u.initials}</span><span class="status">Faol</span></div><h2>${u.name}</h2><p>${u.role}</p><div class="employee-metrics"><div><span>Cheklar</span><b>${m.count} ta</b></div><div><span>Sotilgan mahsulot</span><b>${m.units} dona</b></div><div><span>Savdo summasi</span><b>${money(m.revenue)} so‘m</b></div>${boss()?`<div><span>Sotilgan tovar tannarxi</span><b>${money(m.cogs)} so‘m</b></div><div><span>Keltirgan yalpi foyda</span><b>${money(m.gross)} so‘m</b></div><div><span>Xizmat foydasi · ${m.serviceCount} ta</span><b>${money(m.serviceProfit)} so‘m</b></div><div><span>Xarajatlardan keyingi natija</span><b>${money(m.net)} so‘m</b></div>`:''}</div>${button('Xizmatlarini ko‘rish','employee-services','settings','secondary',`data-id="${u.id}"`)}</section>`;}).join('')}</div><section class="panel section-gap"><div class="panel-heading"><div><h2>Kim nima va qanchaga sotdi?</h2><p>Maosh boshliq bilan kelishiladi. To‘langan maosh «Kirim va chiqim»ga yoziladi.</p></div>${boss()?`<label class="staff-select">Xodim<select id="employee-filter">${options([['all','Hammasi'],...people(state).map(u=>[u.id,u.name])],employee)}</select></label>`:''}</div><div class="table-scroll"><table><thead><tr><th>SANA / XODIM</th><th>MAHSULOT / EGASI</th><th>SONI</th><th>AMALDAGI NARX</th><th>JAMI</th>${boss()?'<th>TANNARX / YALPI FOYDA</th>':''}</tr></thead><tbody>${rows.map(({s,i})=>`<tr><td><b>${name(s.seller)}</b><small>${s.date} · ${s.id}</small></td><td><b>${esc(title(i))}</b><small>${esc(i.name)} · ${name(i.owner)}${s.returned?' · qaytarilgan':''}</small></td><td>${i.qty}</td><td><b>${money(i.price)}</b><small>Oraliq: ${i.listPrice===undefined?'—':money(i.minPrice??i.listPrice)+' – '+money(i.listPrice)}</small></td><td>${money(i.qty*i.price)}</td>${boss()?`<td>${money(i.cost)}<small>Foyda: ${s.returned?'qaytarilgan':money(i.qty*i.price-i.cost)}</small></td>`:''}</tr>`).join('')}</tbody></table>${rows.length?'':empty('Bu davrda sotuv yo‘q')}</div></section>`;
}
function reports(){bossGuard();const m=report();return heading('Hisobotlar','Yangi davr boshlansa ko‘rsatkichlar yangilanadi, avvalgi yozuvlar saqlanadi.',button('CSV yuklash','export-report','download','secondary'))+periodBar()+(!boss()?`<div class="stats-grid three">${stat('Mening savdo summam',m.revenue,'wallet','Nasiya bilan birga',true)}${stat('Mahsulotlar',m.units,'box','Qaytarishlar hisobga olingan',false,'dona')}${stat('Cheklar',m.count,'receipt','Tanlangan davr',false,'ta')}</div><div class="info-banner">${icon('shield')}<span>Tannarx va foyda hisoboti boshliq ko‘rinishida ochiladi.</span></div>`:`<div class="report-grid"><section class="panel profit-report"><div class="panel-heading"><div><h2>Foyda va zarar</h2><p>${owner==='all'?'Do‘kon bo‘yicha':name(owner)+' mahsulotlari bo‘yicha'}</p></div>${icon('chart')}</div>${[['Savdo summasi · nasiya bilan',m.revenue],['Sotilgan mahsulot tannarxi',-m.cogs],['Yalpi foyda',m.gross],['Qo‘shimcha daromad',m.income],['Qo‘shimcha xizmat foydasi',m.serviceProfit],['Kiritilgan xarajatlar',-m.expenses],['Yaroqsiz tovar zarari',-m.loss],['Oylik ijara'+(m.rentIncluded?'':' · ayrilmagan'),-m.rent]].map(([label,value],i)=>`<div class="report-line ${i===2?'subtotal':''}"><span>${label}</span><b>${money(value)} <small>so‘m</small></b></div>`).join('')}<div class="net-profit"><span>Sof natija${m.rentIncluded?'':' · ijara ayrilmagan'}</span><b>${money(m.net)} <small>so‘m</small></b></div><p class="report-hint">Faqat kiritilgan xarajatlar hisoblandi. Maosh, soliq va boshqa chiqimlar yozilganidan keyin natijaga ta’sir qiladi. Qarz to‘lovi savdo summasiga qayta qo‘shilmaydi.</p></section><section class="panel"><div class="panel-heading"><div><h2>Mahsulot egalari bo‘yicha</h2><p>Sotuvchi kimligidan qat’i nazar</p></div>${icon('users')}</div>${owners(state).map(o=>{const a=businessReport(state,{period,owner:o.id});return `<div class="owner-report"><div class="owner-report-title">${badge(o.id)}<span>${state.products.filter(p=>p.owner===o.id).reduce((s,p)=>s+stock(p),0)} dona qoldiq</span></div><div><span>Savdo summasi</span><b>${money(a.revenue)}</b></div><div><span>Sotilgan tovar tannarxi</span><b>${money(a.cogs)}</b></div><div><span>Yalpi foyda</span><b>${money(a.gross)}</b></div></div>`;}).join('')}<div class="inline-note">Boshqa egaga tegishli savdo pulini taqsimlash qoidasi hali kelishilmagan. Avtomatik hisob-kitob qilinmaydi.</div></section></div>${rentPanel()}`)+`<section class="panel section-gap"><div class="panel-heading"><div><h2>Hisobot davrlari</h2><p>Asia/Tashkent vaqti. Umumiy hisob, qoldiq, kassa va qarzlar davom etadi.</p></div></div><div class="period-rules"><span><b>Kun</b>07:00 dan</span><span><b>Hafta</b>Yakshanba 23:00 dan</span><span><b>Oy</b>1-sana 07:00 dan</span><span><b>Yil</b>31-dekabr 23:00 dan</span></div></section>`;}
function settings(){return heading('Sozlamalar','Do‘kon ma’lumoti, saqlash holati va amallar tarixi.')+`<div class="report-grid"><section class="panel settings-panel"><h2>Do‘kon ma’lumoti</h2><form id="settings-form">${boss()?field('Boshliq ismi','adminName','text',name('aziz'),'maxlength="60"'):''}<label>Do‘kon nomi<input name="shop" value="${esc(state.settings.shop)}" maxlength="35" required ${boss()?'':'disabled'}></label>${boss()?'<button class="btn primary" type="submit">Saqlash</button>':'<p>Faqat boshliq o‘zgartiradi.</p>'}</form>${boss()?`<div class="section-gap">${button('Turlar va xodimlar ruxsati','nav','settings','primary','data-page="admin"')}${button('Boshlang‘ich qoldiqlar','opening-balances','wallet','secondary')}</div>`:''}<h3 class="section-gap">Ruxsatlar</h3><p>Otabek xodimlarning har bir amalini Boshqaruv bo‘limidan yoqib-o‘chiradi. Umumiy tushum, foyda va xodimlar hisobotini faqat Otabek ko‘radi.</p></section>${dataPanel()}</div>${boss()?`<section class="panel section-gap"><div class="panel-heading"><div><h2>Amallar tarixi</h2><p>Yozuvlar o‘chirilmaydi; qaytarish va tuzatish alohida qayd etiladi.</p></div></div><div class="audit-list">${state.audit.slice(0,60).map(a=>`<div><span class="audit-dot"></span><span><b>${esc(a.text)}</b><small>${name(a.actor)} · ${a.date} · ${a.time}</small></span></div>`).join('')}</div></section>`:''}`;}
// ---------- reminders, receipt tasks and the server session ----------
const intakeBadge=()=>state.intakes.filter(i=>i.status==='open'&&(boss()||i.worker===user)).length;
function storageCard(){
  if(SERVER_MODE)return `<b>${online?'Server bilan ulangan':'Internet yo‘q'}</b><p>${esc(name(user))} hisobi. Ma’lumot serverda saqlanadi va barcha qurilmalarda bir xil.</p>`;
  return `<b>${online?'Shu brauzerda saqlanadi':'Internet yo‘q · mahalliy rejim'}</b><p>${state.operations.length} ta yangi amal saqlangan.<br>Server ulanmagan.</p>`;
}
function roleSwitch(){
  if(!SERVER_MODE)return `<label class="role-switch"><span>Demo rolini almashtirish</span><b class="mobile-profile-name" aria-hidden="true">${esc(name(user))}</b><select id="role" aria-label="Demo rolini almashtirish">${options(people(state).map(u=>[u.id,u.name+' · '+u.role]),user)}</select></label>`;
  return `<label class="role-switch"><span>Hisob</span><b class="mobile-profile-name" aria-hidden="true">${esc(name(user))}</b><select id="account-menu" aria-label="Hisob menyusi">${options([[user,name(user)+' · '+(session?.role||'')],['password','Parolni almashtirish'],['logout','Chiqish']],user)}</select></label>`;
}
function adminNote(){
  return `<div class="info-banner section-gap">${icon('shield')}<span>${SERVER_MODE?'Ruxsatlar serverda tekshiriladi: o‘chirilgan amalni xodim boshqa yo‘l bilan ham bajara olmaydi. «Parolni tiklash» xodimni barcha qurilmalardan chiqaradi.':'Bu frontenddagi amallar ruxsati. Haqiqiy shaxsiy kirish va serverdagi himoya bu rejimda ulanmagan; demo rolini almashtirish login emas.'}</span></div>`;
}
const debtBanner=()=>SERVER_MODE?'Muddat kelganda Otabek va xodimlarga «Bugun … qarzini berishi kerak» eslatmasi chiqadi. Telefonga alohida xabar (push) hali yo‘q.':'Muddat kelganda platformada eslatma ko‘rinadi. Telefon xabarlari va qurilmalararo sinxronlash server bosqichida ulanadi.';
function dataPanel(){
  if(SERVER_MODE)return `<section class="panel settings-panel"><h2>Server va hisob</h2><p>Ma’lumotlar serverda saqlanadi va barcha qurilmalarda bir xil ko‘rinadi. Kirgan shaxs: <b>${esc(name(user))}</b>. Har bir amal serverda ruxsat bo‘yicha tekshiriladi.</p><div class="settings-actions">${button('Parolni almashtirish','change-password','shield','secondary full')}${button('Chiqish','logout','logout','secondary full')}${boss()?button('Zaxira nusxasini yuklash','backup','download','secondary full'):''}</div>${boss()?'<p class="form-help">Server har kuni o‘zi ham zaxira nusxa oladi. Tiklash serverda qo‘lda bajariladi.</p>':''}</section>`;
  return `<section class="panel settings-panel"><h2>Mahalliy frontend</h2><p>Yozuvlar shu brauzer xotirasida saqlanadi. Sayt bir marta ochilgach, keshlangan interfeys internet uzilganda ham ishlaydi. ${state.operations.length} ta yangi amalga noyob ID berilgan.</p><div class="info-banner compact-info">${icon('shield')}<span>Bu rejimda server, haqiqiy kirish himoyasi, ikki qurilma orasidagi sinxronlash va telefon bildirishnomalari ulanmagan. Demo rolini almashtirish himoyalangan login emas.</span></div>${boss()?`<div class="settings-actions">${button('Zaxira nusxasini yuklash','backup','download','secondary full')}${button('Zaxiradan tiklash','restore-backup','return','secondary full')}<input id="backup-file" type="file" accept=".json,application/json" hidden>${recoverySaved()?button('Tiklashdan oldingi nusxani yuklash','recovery-backup','download','secondary full'):''}</div>`:''}</section>`;
}
function reminderActions(r){
  return (r.debtId?button('To‘lov olish','repay','wallet','compact secondary',`data-id="${r.debtId}"`):'')+(r.kind==='intake'?button('Ochish','nav','box','compact secondary','data-page="intake"'):'');
}
function remindersPanel(){
  const all=currentReminders();
  if(!all.length)return '';
  return `<section class="panel reminder-panel section-gap"><div class="panel-heading"><div><span class="eyebrow">ESLATMALAR</span><h2>Bugun nimalar kerak</h2></div><span class="count-badge">${all.length}</span></div>${all.slice(0,5).map(r=>`<div class="reminder-row ${r.level}"><span class="reminder-icon">${icon(r.kind==='debt'?'clock':r.kind==='intake'?'truck':'bell')}</span><span class="reminder-text"><b>${esc(r.text)}</b>${r.phone?`<small>${esc(r.phone)}</small>`:''}</span>${reminderActions(r)}</div>`).join('')}${all.length>5?`<button class="text-link" data-action="notifications">Barcha eslatmalar ${icon('arrow')}</button>`:''}</section>`;
}

// Sign-in screen (server mode only).
const rememberPerson=id=>{try{localStorage.setItem('telefonzona-last-person',id);}catch{}};
const lastPerson=()=>{try{return localStorage.getItem('telefonzona-last-person')||'';}catch{return '';}};
function renderLogin(message=''){
  document.body.dataset.page='login';document.title='Kirish — TelefonZona';
  const remembered=lastPerson();
  $('#app').innerHTML=`<main class="login-screen"><form id="login-form" class="login-card panel"><span class="brand-mark login-mark">t<span>•</span></span><h1>TelefonZona</h1><p>Hisobingizga kiring</p><div class="login-people" role="radiogroup" aria-label="Xodim">${(loginPeople||[]).map(p=>`<label class="login-person"><input type="radio" name="person" value="${esc(p.id)}" ${p.id===remembered?'checked':''} required><span class="avatar">${esc(p.initials)}</span><b>${esc(p.name)}</b></label>`).join('')}</div><label>Parol<input name="password" type="password" autocomplete="current-password" required></label><div class="form-error" role="alert">${esc(message)}</div><button class="btn primary full" type="submit">${icon('check')}Kirish</button></form></main>`;
}
async function showLogin(message=''){
  try{loginPeople??=(await api.people()).people;renderLogin(message);}
  catch(error){showConnectionProblem(error);}
}
function showConnectionProblem(error){
  document.body.dataset.page='login';
  $('#app').innerHTML=`<main class="login-screen"><section class="login-card panel"><h1>Server bilan aloqa yo‘q</h1><p>${esc(error?.message||'Qayta urinib ko‘ring.')}</p><button class="btn primary" data-action="retry-boot">Qayta urinish</button></section></main>`;
}
async function startSession(){
  const me=await api.me();
  session=me.user;user=me.user.id;owner='all';employee='all';cart=[];page='dashboard';
  serverVersion=-1;applySnapshot(await api.state());
  startPolling();render();
}
async function bootServer(){
  try{await startSession();}
  catch(error){if(error.status===401)await showLogin();else showConnectionProblem(error);}
}
async function doLogin(form,data){
  const output=form.querySelector('.form-error'),submitButton=form.querySelector('[type="submit"]');
  output.textContent='';submitButton.disabled=true;
  try{await api.login(data.person,data.password);rememberPerson(data.person);await startSession();}
  catch(error){output.textContent=error.message;form.elements.password.value='';submitButton.disabled=false;form.elements.password.focus();}
}
function clearSession(){stopPolling();session=null;state=prepareState(createEmptyState());serverVersion=-1;lastReminders=[];cart=[];closeModal();}
async function logout(){
  try{await api.logout();}catch{}
  clearSession();await showLogin();
}
function authLost(){
  if(!SERVER_MODE||!session)return;
  clearSession();void showLogin('Sessiya tugadi. Qayta kiring.');
}
function accountMenu(value){
  if(value==='password')passwordModal();
  else if(value==='logout')later(logout());
}
function passwordModal(){
  openModal('Parolni almashtirish',`<form id="password-form"><label>Joriy parol<input name="current" type="password" autocomplete="current-password" required></label><label>Yangi parol (kamida 8 belgi)<input name="next" type="password" autocomplete="new-password" minlength="8" maxlength="128" required></label><label>Yangi parolni takrorlang<input name="again" type="password" autocomplete="new-password" minlength="8" maxlength="128" required></label><p class="form-help">Parol almashsa, boshqa qurilmalardan chiqib ketasiz. Bu qurilmada davom etasiz.</p>${submit('Parolni almashtirish')}</form>`);
}
function resetPasswordModal(person){
  bossGuard();
  openModal('Xodim parolini tiklash',`<form id="reset-password-form" data-person="${esc(person)}"><p class="group-entry-help">${esc(name(person))} uchun yangi parol yozing. U barcha qurilmalardan chiqarib yuboriladi va yangi parol bilan kiradi.</p><label>Yangi parol (kamida 8 belgi)<input name="next" type="password" autocomplete="new-password" minlength="8" maxlength="128" required></label>${submit('Parolni o‘rnatish')}</form>`);
}

// Several devices see the same records: ask the server every few seconds whether anything changed.
const typing=()=>/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName||'');
function flushRender(){if(!needsRender||modal||typing())return;needsRender=false;render();}
function stopPolling(){clearInterval(pollTimer);pollTimer=null;}
function startPolling(){stopPolling();pollTimer=setInterval(()=>void poll(),5000);}
async function poll(force=false){
  if(!SERVER_MODE||!session||polling||(document.hidden&&!force))return;
  polling=true;
  try{
    // A full snapshot every ten minutes also refreshes reminders when the day changes.
    const snapshot=await api.state(Date.now()-lastFull>600000?undefined:serverVersion);
    if(!snapshot.unchanged&&applySnapshot(snapshot))needsRender=true;
    flushRender();
  }catch(error){if(error.status===401)authLost();}
  finally{polling=false;}
}

// Receipt tasks: the boss hands incoming goods to a worker, the worker records the receipt.
const intakeStatus=i=>({open:'Ochiq',done:'Yakunlangan',cancelled:'Bekor qilingan'}[i.status]||i.status);
const intakeCode=id=>state.intakes.find(i=>i.id===id)?.code||'Topshiriq';
function intakeLineLabel(line){const p=line.productId&&state.products.find(x=>x.id===line.productId);return p?title(p)+' · '+name(p.owner):'Yangi mahsulot';}
function intakeCard(i){
  const canReceive=i.status==='open'&&(boss()||i.worker===user);
  return `<section class="panel intake-card"><div class="panel-heading"><div><h2>${esc(i.code)} <span class="status ${i.status==='open'?'warning':''}">${intakeStatus(i)}</span></h2><p>${badge(i.worker)} · ${dateLabel(i.at)} · ${esc(name(i.createdBy))} topshirdi</p>${i.note?`<p>${esc(i.note)}</p>`:''}</div>${boss()&&i.status==='open'?`<div class="row-actions">${button('Boshqa xodimga','reassign-intake','users','compact secondary',`data-id="${i.id}"`)}${button('Bekor qilish','cancel-intake','close','compact danger',`data-id="${i.id}"`)}</div>`:''}</div>
    <div class="table-scroll"><table class="intake-lines"><thead><tr><th>NIMA KELADI</th><th>KUTILGAN</th><th>QABUL QILINGAN</th><th></th></tr></thead><tbody>${i.lines.map(l=>`<tr><td><b>${esc(l.label)}</b><small>${esc(intakeLineLabel(l))}</small></td><td>${l.qty} dona</td><td><span class="done-count"><b>${l.doneQty}</b> / ${l.qty}</span><span class="progress" aria-hidden="true"><i style="width:${Math.min(100,Math.round(l.doneQty/l.qty*100))}%"></i></span></td><td>${canReceive?button('Qabul qilish','intake-receive','plus','compact primary',`data-id="${i.id}" data-line="${l.id}"`):''}</td></tr>`).join('')}</tbody></table></div>
    ${i.status==='cancelled'?`<p class="panel-copy amber">Bekor qilingan: ${esc(i.cancelReason)}</p>`:''}${i.assignments.length>1?`<p class="panel-copy">Topshirilgan: ${i.assignments.map(a=>esc(name(a.worker))).join(' → ')}</p>`:''}</section>`;
}
function entriesPanel(){
  const groups=entriesByWorker(state).filter(g=>boss()||g.worker===user);
  return `<section class="panel section-gap"><div class="panel-heading"><div><h2>${boss()?'Kim nimani kiritgan':'Men kiritgan kirimlar'}</h2><p>Oxirgi tovar kirimlari${boss()?', xodimlar kesimida':''}.</p></div></div>${groups.map(g=>`<div class="entry-group"><div class="owner-report-title">${badge(g.worker)}<span>${g.units} dona · ${g.entries.length} ta kirim</span></div>${g.entries.slice(0,8).map(e=>{const p=state.products.find(x=>x.id===e.productId);return `<div class="shared-row"><span><b>${esc(p?title(p):e.sku)}</b><small>${e.date} · ${e.intakeId?esc(intakeCode(e.intakeId)):'Topshiriqsiz'}</small></span><strong>${e.qty}<small>dona</small></strong></div>`;}).join('')||'<p class="panel-copy">Hali kirim kiritilmagan.</p>'}</div>`).join('')}</section>`;
}
function intakePage(){
  const list=state.intakes.filter(i=>boss()||i.worker===user).slice().sort((a,b)=>(a.status==='open'?0:1)-(b.status==='open'?0:1)||b.at.localeCompare(a.at));
  const open=list.filter(i=>i.status==='open');
  return heading('Kirim topshiriqlari',boss()?'Yangi kelgan tovarni xodimlarga bo‘lib bering. Kim nimani kiritgani shu yerda ko‘rinadi.':'Sizga topshirilgan kirimlar. Tovar kelganda qatordagi «Qabul qilish» tugmasini bosing.',boss()?button('Topshiriq berish','new-intake'):'')
    +`<div class="inventory-summary"><span><b>${open.length}</b> ta ochiq topshiriq</span><span><b>${open.reduce((sum,i)=>sum+intakeRemaining(i),0)}</b> dona kutilmoqda</span></div>`
    +`<div class="intake-list">${list.map(intakeCard).join('')||empty('Kirim topshirig‘i yo‘q',boss()?'Yangi kelgan tovarni xodimga topshiring.':'Otabek topshirgan kirim shu yerda ko‘rinadi.')}</div>`
    +entriesPanel();
}
const intakeLineRow=()=>`<div class="intake-line" data-line-row><label>Nima keladi?<input name="label" maxlength="120" placeholder="Masalan: iPhone 15 Pro karbon g‘ilof"></label><label>Soni<input name="qty" type="number" min="1" max="100000" step="1" inputmode="numeric"></label><label>Ro‘yxatdagi mahsulot<select name="product">${options([['','Ro‘yxatda yo‘q — yangi mahsulot'],...activeProducts().map(p=>[p.id,title(p)+' · '+name(p.owner)])],'')}</select></label></div>`;
function intakeCreateModal(){
  bossGuard();
  const workers=people(state);
  openModal('Kirim topshirig‘i',`<form id="intake-form">${select('Kim qabul qiladi?','worker',workers.map(p=>[p.id,p.name]),(workers.find(p=>p.id!=='aziz')||workers[0]).id)}${note('Izoh (ixtiyoriy)','',false)}<div class="intake-lines-edit">${intakeLineRow()}${intakeLineRow()}</div><button type="button" class="btn secondary" data-action="intake-add-line">${icon('plus')}Qator qo‘shish</button><p class="form-help">Har qatorga nima kelishini yozing yoki ro‘yxatdagi mahsulotni tanlang. Topshirilgan mahsulotni boshqa xodim kirim qila olmaydi.</p>${submit('Topshirish')}</form>`,true);
}
function intakeHint(context){
  if(!context)return '';
  const intake=state.intakes.find(i=>i.id===context.intakeId),line=intake?.lines.find(l=>l.id===context.lineId);
  return line?`<div class="inline-note">Topshiriq ${esc(intake.code)}: <b>${esc(line.label)}</b> · ${line.qty} dona kutilmoqda</div>`:'';
}
function intakeReceiveModal(intakeId,lineId){
  const intake=state.intakes.find(i=>i.id===intakeId),line=intake?.lines.find(l=>l.id===lineId);
  if(!intake||!line||intake.status!=='open')throw Error('Topshiriq topilmadi yoki yopilgan.');
  if(!boss()&&intake.worker!==user)throw Error('Bu kirim boshqa xodimga topshirilgan.');
  const left=Math.max(1,line.qty-line.doneQty),p=line.productId&&state.products.find(x=>x.id===line.productId);
  if(p){
    openModal('Kirimni qabul qilish',`<form id="intake-receive-form" data-intake="${esc(intakeId)}" data-line="${esc(lineId)}"><p class="group-entry-help">${esc(intake.code)} · ${esc(line.label)}<br>${esc(title(p))} · ${esc(name(p.owner))}<br>Kutilgan ${line.qty} dona, qabul qilingan ${line.doneQty}.</p><div class="form-grid">${field('Kelgan soni','qty','number',left,'min="1" max="100000" step="1"')}${field('Bir dona tannarxi','cost','number',cost(p)||'','min="1" max="1000000000" step="1"')}</div>${note('Kirim izohi',intake.code+' · qabul qilindi')}${submit('Kirimni saqlash')}</form>`);
  }else{
    openModal('Yangi mahsulotni kiritish',`<p class="group-entry-help">${esc(intake.code)} · ${esc(line.label)}<br>Kutilgan ${line.qty} dona. Bu mahsulot hali ro‘yxatda yo‘q: avval uni kiriting, kirim shu topshiriqqa yoziladi.</p><div class="modal-actions">${button('Bitta mahsulot','intake-receive-product','plus','secondary',`data-id="${esc(intakeId)}" data-line="${esc(lineId)}"`)}${button('G‘iloflar guruhi','intake-receive-groups','plus','primary',`data-id="${esc(intakeId)}" data-line="${esc(lineId)}"`)}</div>`);
  }
}
function intakeReassignModal(id){
  bossGuard();const i=state.intakes.find(x=>x.id===id);
  if(!i||i.status!=='open')throw Error('Faol topshiriq topilmadi.');
  openModal('Boshqa xodimga topshirish',`<form id="intake-reassign-form" data-id="${esc(id)}"><p class="group-entry-help">${esc(i.code)} hozir ${esc(name(i.worker))}da, ${intakeRemaining(i)} dona kutilmoqda. Qabul qilingan qismi o‘zgarmaydi.</p>${select('Yangi mas’ul xodim','worker',people(state).filter(p=>p.id!==i.worker).map(p=>[p.id,p.name]),people(state).find(p=>p.id!==i.worker).id)}${submit('Topshirish')}</form>`);
}
function intakeCancelModal(id){
  bossGuard();const i=state.intakes.find(x=>x.id===id);
  if(!i||i.status!=='open')throw Error('Faol topshiriq topilmadi.');
  openModal('Topshiriq bekor qilinsinmi?',`<form id="intake-cancel-form" data-id="${esc(id)}"><div class="delete-summary">${icon('alert')}<div><h3>${esc(i.code)} · ${esc(name(i.worker))}</h3><p>Topshiriq yopiladi va qolgan ${intakeRemaining(i)} dona endi kutilmaydi. Qabul qilingan tovar omborda qoladi. Tarix saqlanadi.</p></div></div>${note('Bekor qilish sababi')}<div class="form-error" role="alert"></div><div class="modal-actions"><button type="button" class="btn secondary" data-action="close-modal">Yo‘q</button><button type="submit" class="btn danger">${icon('close')}Ha, bekor qilinsin</button></div></form>`);
}
let modalFocus=null;
function openModal(title,body,wide=false){modalFocus=document.activeElement;modal=true;document.body.classList.add('modal-open');$('#app').inert=true;$('#modal-root').innerHTML=`<div class="modal-overlay"><section class="modal ${wide?'wide':''}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header><div><span class="eyebrow">TELEFONZONA</span><h2>${title}</h2></div><button class="icon-btn" data-action="close-modal" aria-label="Yopish">${icon('close')}</button></header><div class="modal-body">${body}</div></section></div>`;prepareResponsiveContent($('#modal-root'));setTimeout(()=>$('#modal-root input,#modal-root select,#modal-root button')?.focus(),30);}
function openThemeModal(){
  const active=resolveTheme(document.documentElement.dataset.theme);
  openModal('O‘zingizga mos kayfiyat',`<p class="theme-intro">Ish maydoningiz, sizning uslubingiz. Ranglarni tanlang — o‘zgarishni shu zahoti ko‘rasiz.</p><div class="theme-gallery" role="group" aria-label="Interfeys mavzulari">${THEMES.map(t=>`<button type="button" class="theme-choice ${t.id===active.id?'selected':''}" data-action="theme-select" data-value="${t.id}" aria-label="${esc(t.name)} mavzusi" aria-pressed="${t.id===active.id}"><div class="theme-mini" aria-hidden="true" style="--preview-bg:${t.background};--preview-panel:${t.panel};--preview-accent:${t.accent};--preview-ink:${t.ink};--preview-side:${t.sidebar}"><span class="theme-mini-side"><i></i><i></i><i></i><i></i></span><span class="theme-mini-main"><i class="theme-mini-title"></i><span class="theme-mini-stats"><i></i><i></i><i></i></span><span class="theme-mini-table"><i></i><i></i><i></i></span></span></div><span class="theme-choice-title"><b>${esc(t.name)}</b><span class="theme-choice-status">${t.id===active.id?'Tanlangan':'Tanlash'}</span></span><p>${esc(t.description)}</p><span class="theme-swatches" aria-hidden="true">${t.colors.map(color=>`<i style="--swatch:${color}"></i>`).join('')}</span></button>`).join('')}</div><p id="theme-live-status" class="theme-live-status" role="status" aria-live="polite">${esc(active.name)} mavzusi tanlangan.</p><p class="theme-picker-footer">Tanlov shu brauzerda saqlanadi. Qurilmangizdagi «harakatni kamaytirish» sozlamasi ham hisobga olinadi.</p><div class="modal-actions">${button('Tayyor','close-modal','check','primary')}</div>`,true);
}
function closeModal(){pendingBackup=null;intakeContext=null;modal=false;document.body.classList.remove('modal-open');$('#app').inert=false;$('#modal-root').innerHTML='';modalFocus?.isConnected&&modalFocus.focus();}
const field=(label,key,type='text',value='',extra='')=>`<label>${label}<input name="${key}" type="${type}" value="${esc(value)}" ${extra} required></label>`;
const select=(label,key,list,value)=>`<label>${label}<select name="${key}" required>${options(list,value)}</select></label>`;
const note=(label='Sabab / izoh',value='',required=true)=>`<label>${label}<textarea name="note" maxlength="500" rows="2" ${required?'required':''}>${esc(value)}</textarea></label>`;
const submit=(label='Saqlash')=>`<div class="form-error" role="alert"></div><div class="modal-actions"><button type="button" class="btn secondary" data-action="close-modal">Bekor qilish</button><button class="btn primary" type="submit">${icon('check')}${label}</button></div>`;
const numberExtra='min="0" max="1000000000000" step="1"';
function stockLimitModal(id) {
  requirePermission(state,user,'products');
  const product=state.products.find(item=>item.id===id);
  if(!product)throw Error('Mahsulot topilmadi.');
  openModal('Kam qoldiq eslatmasi',`<form id="stock-limit-form" data-id="${product.id}">
    <p class="group-entry-help">${esc(title(product))} · ${esc(name(product.owner))}<br>Hozir ${stock(product)} dona bor.</p>
    ${field('Nechta qolganda eslatilsin?','min','number',stockLimit(product),'min="0" max="100000" step="1"')}
    <p class="form-help">Shu son yoki undan kam qolganda «Kam qoldiqlar»ga tushadi. 0 — faqat tugaganda.</p>
    ${submit('Chegarani saqlash')}</form>`);
}
function paymentModal(){
  requirePermission(state,user,'sell');
  if(!cart.length)return;
  const exception=cart.some(row=>outsideRange(state.products.find(p=>p.id===row.productId),row.price));
  openModal('To‘lov va yakunlash',`<form id="sale-form"><div class="inline-note">Jami savdo: <b>${money(cartTotal())} so‘m</b> · Sotuvchi: ${name(user)}<br>To‘lov umumiy kassaga yoziladi.</div><div class="payment-owner-review">${cart.map(row=>{const p=state.products.find(p=>p.id===row.productId);return `<div><span>${esc(title(p))} · ${row.qty} dona</span><b>Egasi: ${esc(name(p.owner))}</b></div>`;}).join('')}</div>${exception?'<div class="exception-note">Narx oralig‘idan tashqari sotuv. Sabab yoziladi va boshliqqa eslatma tushadi.</div>':''}<div class="form-grid">${select('To‘lov turi','payment',['Naqd','Karta','O‘tkazma'],'Naqd')}${select('To‘lov holati','mode',allowed('credit')?[['full','To‘liq to‘lov'],['credit','Qisman to‘lov / nasiya']]:[['full','To‘liq to‘lov']],'full')}</div><div id="credit-fields" hidden>${field('Hozir olingan pul (so‘m)','received','number',0,numberExtra+' disabled')}<div class="form-grid">${field('Xaridor ismi','customer','text','','maxlength="80" disabled')}${field('Telefon raqami','phone','tel','','placeholder="+998 90 123 45 67" maxlength="22" disabled')}${field('Qaytarish sanasi','due','date',TODAY,`min="${TODAY}" disabled`)}</div><p class="form-help" id="debt-preview"></p></div>${note(exception?'Sabab (majburiy)':'Izoh (nasiya bo‘lsa majburiy)','',exception)}<p class="form-help">Sotuv omborni kamaytiradi. Nasiya bo‘lsa, qolgan summa qarzdorga yoziladi.</p>${submit('Sotuvni saqlash')}</form>`);
}
function caseGroupsModal(context=null){requirePermission(state,user,'products');requirePermission(state,user,'stock');openModal('G‘iloflarni tez kiritish',`<form id="case-groups-form">${intakeHint(context)}<div class="form-grid">${select('Brend','brand',catalog(state).brands.map(b=>[b.id,b.name]),brand==='all'?'apple':brand)}${field('Telefon modeli','model','text','','maxlength="60" placeholder="iPhone 15 Pro yoki S23U"')}${select('Kim uchun','audience',AUDIENCES,'men')}${select('G‘ilof turi','material',catalog(state).materials,'Karbon')}${select('Mahsulot egasi','owner',owners(state).map(o=>[o.id,o.name]),'aziz')}${field('Kam qoldiq eslatmasi · dona','min','number',5,'min="0" max="100000" step="1"')}</div><p class="form-help">Yangi guruhda shu son yoki undan kam qolganda eslatma chiqadi. 0 — faqat tugaganda.</p><p class="group-entry-help">Faqat bor sifat qatorlarini to‘ldiring. Har xil rang va naqshlar shu guruh ichida birga sanaladi.</p><div class="table-scroll"><table class="group-entry-table"><thead><tr><th>SIFAT</th><th>SONI</th><th>TANNARX / DONA</th><th>ENG KAM NARX</th><th>YUQORI NARX</th></tr></thead><tbody>${catalog(state).qualities.map(t=>`<tr><td><span class="quality-badge quality-${t.id}">${esc(t.name)}</span></td>${['qty','cost','minPrice','price'].map(key=>`<td><input type="number" name="${key}-${t.id}" aria-label="${esc(t.name)}: ${{qty:'soni',cost:'tannarx',minPrice:'eng kam narx',price:'yuqori narx'}[key]}" min="${key==='minPrice'?0:1}" max="${key==='qty'?100000:1e9}" step="1" placeholder="—"></td>`).join('')}</tr>`).join('')}</tbody></table></div><p class="form-help">Model + kim uchun + g‘ilof turi + sifat + egasi bir xil bo‘lsa, mavjud guruhga partiya qo‘shiladi. Eski tannarxlar saqlanadi.</p>${submit('Guruhlarni saqlash')}</form>`,true);intakeContext=context;}
function catalogPriceModal(id){requirePermission(state,user,'prices');const p=state.products.find(p=>p.id===id);openModal('Narx oralig‘i',`<form id="price-form" data-id="${id}"><p class="group-entry-help">${esc(title(p))} · ${name(p.owner)}</p><div class="form-grid">${field('Eng kam narx (so‘m)','minPrice','number',p.minPrice??p.price,numberExtra)}${field('Yuqori narx (so‘m)','price','number',p.price,'min="1" max="1000000000" step="1"')}</div><p class="form-help">Sotuvchi shu oraliqda savdolashadi. Sabab yozib chegaradan tashqarida ham sotishi mumkin. Avvalgi cheklar o‘zgarmaydi.</p>${submit()}</form>`);}
function purchaseModal(id){requirePermission(state,user,'stock');const p=state.products.find(p=>p.id===id);openModal('Tovar kirimi',`<form id="purchase-form" data-id="${id}"><p class="group-entry-help">${esc(title(p))} · ${name(p.owner)}</p><div class="form-grid">${field('Kelgan soni','qty','number',1,'min="1" max="100000" step="1"')}${field('Bir dona tannarxi','cost','number',cost(p),'min="1" max="1000000000" step="1"')}</div>${note('Kirim izohi',p.sku+' · yangi partiya')}${submit('Kirimni saqlash')}</form>`);}
function productModal(context=null){requirePermission(state,user,'products');requirePermission(state,user,'stock');openModal('Boshqa mahsulot',`<form id="product-form">${intakeHint(context)}<div class="form-grid">${field('Mahsulot nomi','name','text','','maxlength="60" placeholder="Masalan: Type-C kabel"')}${field('Model / xususiyati','variant','text','','maxlength="90" placeholder="1 metr · 60W"')}${select('Brend','brand',catalog(state).brands.map(b=>[b.id,b.name]),'other')}${select('Kategoriya','category',catalog(state).categories,'Kabellar')}<label>Sifat (ixtiyoriy)<select name="quality">${options([['','Belgilanmagan'],...catalog(state).qualities.map(t=>[t.id,t.name])],'')}</select></label>${select('Mahsulot egasi','owner',owners(state).map(o=>[o.id,o.name]),'aziz')}${field('Boshlang‘ich soni','qty','number',1,'min="1" max="100000" step="1"')}${field('Bir dona tannarxi','cost','number','','min="1" max="1000000000" step="1"')}${field('Eng kam sotish narxi','minPrice','number','',numberExtra)}${field('Yuqori sotish narxi','price','number','','min="1" max="1000000000" step="1"')}${field('Kam qoldiq eslatmasi · dona','min','number',5,'min="0" max="100000" step="1"')}</div>${note('Kirim izohi','Boshlang‘ich kirim')}${submit('Mahsulotni qo‘shish')}</form>`,true);intakeContext=context;}
function flowModal(kind='expense'){requirePermission(state,user,'cash');openModal('Pul harakati',`<form id="flow-form">${select('Amal turi','kind',FLOW_KINDS,kind)}<div class="form-grid">${field('Summa (so‘m)','amount','number','','min="1" max="1000000000000" step="1"')}${select('Pul manbasi / hisobi','account',ACCOUNTS,CASH_ACCOUNT)}</div><div id="flow-expense">${select('Xarajat turi','category',['Boshqa','Transport','Elektr','Internet','Soliq','Maosh','Ta’mirlash'],'Boshqa')}</div><div id="flow-person" hidden>${select('Kimga qaytariladi?','person',people(state).filter(u=>u.id!=='aziz').map(u=>[u.id,u.name]),'jasur')}</div>${note()}<p class="form-help" id="flow-help"></p>${submit()}</form>`);updateFlowForm();}
function updateFlowForm(){const form=$('#flow-form');if(!form)return;const kind=form.elements.kind.value,old=form.elements.account.value;form.elements.account.innerHTML=options(kind==='expense'?[...ACCOUNTS,['personal','O‘z cho‘ntagimdan']]:ACCOUNTS,old);$('#flow-expense').hidden=kind!=='expense';$('#flow-person').hidden=kind!=='reimbursement';$('#flow-help').textContent=({expense:'Xarajat foydadan ayriladi. O‘z pulingizdan bo‘lsa, do‘konning sizga qarzi ham yoziladi.',income:'Faqat haqiqiy qo‘shimcha daromad uchun. Bu sof natijaga qo‘shiladi.',contribution:'Kassaga shaxsiy pul qo‘shish daromad emas. Xodim pul qo‘shsa, do‘konning unga qarzi yoziladi.',withdrawal:'Boshliqqa pul topshirish — pul harakati. Xarajat va foyda emas.',reimbursement:'Xodim o‘zidan qilgan xarajat / qo‘shgan pulini qaytarish. Foydadan qayta ayrilmaydi.'})[kind];}
function rentModal(id){if(!boss())throw Error('Faqat boshliq uchun.');const r=state.rents.find(r=>r.id===id);openModal('Oylik ijara',`<form id="rent-form">${field('Qaysi oy uchun','month','month',r?.month||TODAY.slice(0,7))}${field('Kelishilgan oylik summa (so‘m)','amount','number',r?.amount??'',numberExtra)}${note('Izoh / kelishuv',r?.note||'')}<p class="form-help">Bu summa shu oy foydasidan bir marta ayriladi. Kunlik / haftalik natijaga ijara taqsimlanmaydi. Haqiqiy to‘lov alohida yoziladi.</p>${submit('Ijarani belgilash')}</form>`);}
function rentPaymentModal(id){requirePermission(state,user,'cash');const r=state.rents.find(r=>r.id===id);openModal('Ijara to‘lovi',`<form id="rent-payment-form" data-id="${id}"><div class="inline-note">${r.month} uchun qoldiq: <b>${money(r.amount-r.paid)} so‘m</b></div>${field('Hozir to‘lanadigan summa','amount','number',r.amount-r.paid,`min="1" max="${r.amount-r.paid}" step="1"`)}${select('Qayerdan to‘lanadi?','account',[...ACCOUNTS,['personal','O‘z cho‘ntagimdan']],CASH_ACCOUNT)}${note('To‘lov izohi',r.month+' oyi ijara to‘lovi')}<p class="form-help">Kassa / bank qoldig‘i kamayadi. Foydadan ikkinchi marta ayrilmaydi.</p>${submit('To‘lovni saqlash')}</form>`);}
function repayModal(id){requirePermission(state,user,'debts');const d=state.debts.find(d=>d.id===id);openModal('Qarz to‘lovini olish',`<form id="repay-form" data-id="${id}"><div class="inline-note">${esc(d.customer)} · ${esc(d.phone)}<br>Qolgan qarz: <b>${money(d.balance)} so‘m</b></div>${field('Olingan summa','amount','number',d.balance,`min="1" max="${d.balance}" step="1"`)}${note('To‘lov izohi','Qarzning bir qismi / to‘liq qaytdi')}<p class="form-help">Savdo summasiga qayta qo‘shilmaydi. Qarz kamayadi, pul qoldig‘i oshadi.</p>${submit('To‘lovni saqlash')}</form>`);}
function debtDetail(id){requirePermission(state,user,'debts');const d=state.debts.find(d=>d.id===id);openModal('Qarz tafsilotlari',`<div class="receipt-top"><h3>${esc(d.customer)}</h3><p>${esc(d.phone)} · muddat ${d.due}</p><b>${money(d.balance)} so‘m qoldi</b></div><p class="panel-copy">${esc(d.note)}</p><div class="balance-list"><div><span>Boshlang‘ich qarz</span><b>${money(d.original)}</b></div>${d.payments.map(p=>`<div><span>${p.date} · ${name(p.actor)}<small>${accountName(p.account)} · ${esc(p.note)}${p.voidedBy?' · Bekor qilingan':''}</small></span><b>−${money(p.amount)}</b>${!p.voidedBy&&canReverseMovement(state.movements.find(m=>m.id===p.id),user,state)?button('Tuzatish','edit-movement','settings','compact secondary',`data-id="${p.id}"`):''}</div>`).join('')}${d.cancelledAt?`<div><span>Chek qaytarilishi sabab bekor qilingan</span><b>${money(d.cancelled)}</b></div>`:''}</div><div class="modal-actions">${d.saleId?button('Chekni ko‘rish','receipt','receipt','secondary',`data-id="${d.saleId}"`):''}${d.balance?button('To‘lov olish','repay','wallet','primary',`data-id="${d.id}"`):''}</div>`);}
function receiptModal(id){const s=state.sales.find(s=>s.id===id);if(!s)return;const d=state.debts.find(d=>d.saleId===id);openModal('Sotuv tafsilotlari',`<div class="receipt-top"><div class="receipt-symbol">${icon(s.returned?'return':'check')}</div><h3>${s.returned?'Sotuv qaytarilgan':'Sotuv saqlandi'}</h3><p>#${s.id} · ${s.date} · ${s.time}</p></div><div class="receipt-meta"><span>Sotuvchi <b>${name(s.seller)}</b></span><span>Pul hisobi <b>${esc(s.payment)} · Umumiy kassa</b></span></div>${s.items.map(i=>`<div class="receipt-line"><div><b>${esc(title(i))}</b><small>${esc(i.name)} · ${name(i.owner)}</small><small>${i.qty} × ${money(i.price)} so‘m · amaldagi narx</small>${i.listPrice===undefined?'':`<small>O‘sha paytdagi oraliq: ${money(i.minPrice??i.listPrice)} – ${money(i.listPrice)}</small>`}</div><b>${money(i.qty*i.price)}</b></div>`).join('')}<div class="cart-total"><span>Jami savdo</span><b>${money(saleTotal(s))}<small> so‘m</small></b></div><div class="receipt-meta"><span>Sotuvda olingan pul <b>${money(s.received??saleTotal(s))} so‘m</b></span>${d?`<span>Qolgan qarz <b>${money(d.balance)} so‘m</b></span>`:''}${boss()?`<span>Tannarx <b>${money(s.items.reduce((sum,i)=>sum+i.cost,0))} so‘m</b></span><span>Yalpi foyda${s.returned?' · qaytarilgan':''} <b>${money(saleProfit(s))} so‘m</b></span>`:''}</div>${s.note?`<div class="inline-note">Izoh: ${esc(s.note)}</div>`:''}${s.returned?`<div class="inline-note">Qaytargan: ${name(s.returnActor||'aziz')} · ${s.returnDate}<br>${esc(s.returnNote||'Avvalgi to‘liq qaytarish')}</div>`:''}<div class="modal-actions">${!s.returned&&allowed('returns')?button('Chekni o‘chirish','delete-sale','trash','danger',`data-id="${s.id}"`):''}${!s.returned&&allowed('returns')&&allowed('sell')&&(boss()||s.seller===user)?button('Tahrirlash','edit-sale','settings','secondary',`data-id="${s.id}"`):''}${!s.returned&&allowed('returns')?button('Qaytarish / almashtirish','return','return','danger',`data-id="${id}"`):''}${button('Yopish','close-modal','check','primary')}</div>`);}
function returnModal(id){requirePermission(state,user,'returns');const s=state.sales.find(s=>s.id===id),d=state.debts.find(d=>d.saleId===id),collected=(s.received??saleTotal(s))+(d?.payments.filter(p=>!p.voidedBy).reduce((sum,p)=>sum+p.amount,0)||0);openModal('Qaytarish / almashtirish',`<form id="return-form" data-id="${id}"><div class="inline-note">#${id} cheki to‘liq qaytariladi. Barcha mahsulotlari omborga qaytadi.<br>Qaytariladigan pul: <b>${money(collected)} so‘m</b>${d?.balance?`<br>Bekor qilinadigan qarz: ${money(d.balance)} so‘m`:''}</div>${note('Qaytarish sababi')}<p class="form-help">Almashtirishda shu chekni qaytaring, so‘ng yangi mahsulotga yangi sotuv yozing. Yaroqsiz qaytgan mahsulotni keyin «Nuqson» orqali belgilang. Qisman qaytarish hali qo‘shilmagan.</p>${submit('To‘liq qaytarishni saqlash')}</form>`);}
function defectModal(id){requirePermission(state,user,'defects');const p=state.products.find(p=>p.id===id);openModal('Nuqsonli mahsulot',`<form id="defect-form" data-id="${id}"><p class="group-entry-help">${esc(title(p))} · qoldiq ${stock(p)} dona</p>${select('Holati','kind',[['dispose','Yaroqsiz — hisobdan chiqarish'],['repair','Tuzatib sotiladi — ta’mir xarajati']],'dispose')}<div id="defect-dispose">${field('Hisobdan chiqariladigan soni','qty','number',1,`min="1" max="${stock(p)}" step="1"`)}</div><div id="defect-repair" hidden>${field('Ta’mirlash xarajati','amount','number','','min="1" max="1000000000" step="1" disabled')}${select('To‘lov manbasi','account',[...ACCOUNTS,['personal','O‘z cho‘ntagimdan']],CASH_ACCOUNT)}</div>${note('Nima bo‘ldi?')}<p class="form-help">Yaroqsiz tovar tannarxi bir marta zararga yoziladi. Ta’mirda soni o‘zgarmaydi; xarajat yoziladi, so‘ng savdoda arzonroq narxni sabab bilan kiriting.</p>${submit()}</form>`);}
function movementModal(id){
  const m=state.movements.find(m=>m.id===id);if(!m||!boss()&&m.actor!==user)throw Error('Bu yozuvni ko‘rish huquqi yo‘q.');
  const original=m.kind==='reversal'?state.movements.find(x=>x.id===m.reversalOf):null;
  openModal('Pul harakati tafsilotlari',`<div class="receipt-top"><h3>${flowName(m.kind)}</h3><p>${dateLabel(m.at)} · ${name(m.actor)}</p><b>${money(m.amount)} so‘m</b></div>
    <div class="receipt-meta"><span>Pul hisobi <b>${accountName(m.account)}${m.to?' → '+accountName(m.to):''}${m.person?' → '+name(m.person):''}</b></span></div>
    <div class="inline-note">Izoh: ${esc(m.note)}</div>
    ${original?`<div class="inline-note">Bekor qilingan amal: ${flowName(original.kind)} · ${dateLabel(original.at)}<br>${esc(original.note)}</div>`:''}
    ${m.voidedBy?`<div class="exception-note">${name(m.voidedActor)} tomonidan ${dateLabel(m.voidedAt)} da bekor qilingan.<br>Sabab: ${esc(m.voidedReason)}</div>`:''}
    <div class="modal-actions">${canReverseMovement(m,user,state)&&m.kind!=='transfer'?button('Tahrirlash','edit-movement','settings','secondary',`data-id="${id}"`):''}${canReverseMovement(m,user,state)?button('O‘chirish','delete-movement','trash','danger',`data-id="${id}"`):''}${m.kind==='sale-payment'||m.kind==='refund'?button('Chekni ko‘rish','receipt','receipt','secondary',`data-id="${esc(m.reference)}"`):''}${button('Yopish','close-modal','check','secondary')}</div>`);
}
function reverseModal(id){
  const m=state.movements.find(m=>m.id===id);if(!canReverseMovement(m,user,state))throw Error('Bu yozuvni bekor qilib bo‘lmaydi.');
  openModal('Xato pul yozuvini bekor qilish',`<form id="reverse-form" data-id="${id}"><div class="inline-note"><b>${flowName(m.kind)} · ${money(m.amount)} so‘m</b><br>${name(m.actor)} · ${accountName(m.account)}<br>${esc(m.note)}</div>${note('Nima uchun bekor qilinyapti?')}
    <p class="form-help">Eski yozuv o‘chmaydi. Tuzatish hozirgi sana bilan yoziladi; kassa, qarz yoki xodimga qaytariladigan pul mos ravishda o‘zgaradi. Keyin kerak bo‘lsa to‘g‘ri yozuvni kiriting.</p>${submit('Bekor qilishni saqlash')}</form>`);
}
function closingModal(){
  bossGuard();
  const expected=accountBalances(state)[CASH_ACCOUNT];
  openModal('Kun oxiridagi kassa',`<form id="closing-form">
    <div class="inline-note">Umumiy kassa qoldig‘i <b>${money(expected)} so‘m</b></div>
    <div class="form-grid">${field('Sanalgan jami pul','actual','number','',numberExtra)}${field('Ertangi qaytim','float','number',0,numberExtra)}</div>
    ${select('Boshliqqa pul topshirish','handover',[['no','Hozir faqat sanashni saqlash'],['yes','Pulni berdim — topshirishni ham yozish']],'no')}
    <div id="closing-preview" class="closing-preview" aria-live="polite">Sanalgan jami pulni yozing.</div>
    ${note('Sanash / farq izohi','Kun yakuni')}
    <p class="form-help">Topshirish summasi sanalgan puldan ertangi qaytimni ayirib hisoblanadi. Sanashdagi farq alohida saqlanadi.</p>
    ${submit('Kun yakunini saqlash')}</form>`);
}
function updateClosingPreview(){
  const form=$('#closing-form');
  const preview=$('#closing-preview');
  if(!form||!preview)return;
  const actual=form.elements.actual.valueAsNumber;
  const remaining=form.elements.float.valueAsNumber;
  if([actual,remaining].some(value=>!Number.isSafeInteger(value)||value<0)){
    preview.textContent='Sanalgan pul va qaytimni butun so‘mda yozing.';
    return;
  }
  if(remaining>actual){
    preview.textContent='Qaytim sanalgan puldan oshmasin.';
    return;
  }
  const difference=actual-accountBalances(state)[CASH_ACCOUNT];
  const handover=form.elements.handover.value==='yes';
  preview.innerHTML=`<div><span>Sanalgan jami</span><b>${money(actual)} so‘m</b></div>
    <div><span>Sanashdagi farq</span><b class="${difference?'amber':'green-text'}">${difference>0?'+':''}${money(difference)} so‘m</b></div>
    <div><span>Ertangi qaytim</span><b>${money(remaining)} so‘m</b></div>
    <div><span>${handover?'Hozir topshiriladi':'Topshirilishi mumkin'}</span><b>${money(actual-remaining)} so‘m</b></div>`;
}
function closingDetail(id){
  bossGuard();const c=state.closings.find(c=>c.id===id);if(!c)throw Error('Kassa sanog‘i topilmadi.');
  const withdrawals=(c.withdrawalIds||[]).map(id=>state.movements.find(m=>m.id===id)).filter(Boolean);
  openModal('Kassa yakuni tafsilotlari',`<p class="group-entry-help">${c.date} · ${name(c.actor||'aziz')}<br>${esc(c.note||'Avvalgi sanash')}</p>
    <div class="balance-list"><div><span>Hisob bo‘yicha jami</span><b>${money(c.expected)}</b></div><div><span>Sanalgan jami</span><b>${money(c.actual)}</b></div><div><span>Farq</span><b class="${c.actual===c.expected?'green-text':'amber'}">${money(c.actual-c.expected)}</b></div><div><span>Ertangi qaytim</span><b>${c.float===undefined?'—':money(c.float)}</b></div></div>
    <h3>Topshirilgan pul</h3>${withdrawals.length?withdrawals.map(m=>`<div class="receipt-line"><span>${accountName(m.account)}<small>${m.voidedBy?'Keyin bekor qilingan':'Boshliqqa topshirilgan'}</small></span><b>${money(m.amount)} so‘m</b></div>`).join(''):'<p class="group-entry-help">Bu sanash bilan pul topshirish yozilmagan.</p>'}<div class="modal-actions">${button('Yopish','close-modal','check','secondary')}</div>`);
}
function recoverySaved(){try{return !!localStorage.getItem(RECOVERY_KEY);}catch{return false;}}
async function loadBackupFile(file){
  try{
    bossGuard();if(!file)return;if(file.size>MAX_BACKUP_BYTES)throw Error('Zaxira fayli 8 MB dan oshmasin.');
    const next=readBackup(await file.text());bossGuard();
    const incoming=backupSummary(next),current=backupSummary(state);
    pendingBackup={state:next,name:file.name,baseRaw:localStorage.getItem(KEY)};
    openModal('Zaxirani tekshirish',`<p class="group-entry-help">Fayl: <b>${esc(file.name)}</b><br>Fayl tekshirildi. Quyidagi raqamlarni solishtiring.</p>
      <div class="table-scroll"><table class="backup-comparison"><thead><tr><th>MA’LUMOT</th><th>HOZIR</th><th>FAYLDA</th></tr></thead><tbody>${[['Mahsulot guruhlari','products'],['Omborda dona','units'],['Cheklar','sales'],['Qo‘shimcha xizmatlar','services'],['Pul harakatlari','movements'],['Xaridorlardan qarz','debt']].map(([label,key])=>`<tr><td>${label}</td><td>${money(current[key])}</td><td>${money(incoming[key])}</td></tr>`).join('')}${ACCOUNTS.map(([id,label])=>`<tr><td>${label}</td><td>${money(current.balances[id])}</td><td>${money(incoming.balances[id])}</td></tr>`).join('')}</tbody></table></div>
      <div class="exception-note">Tiklash ushbu brauzerdagi joriy ma’lumotni fayldagi ma’lumot bilan almashtiradi. Hozirgi nusxa tiklashdan oldin alohida saqlanadi va Sozlamalardan yuklab olinadi. Joriy savat tozalanadi.</div>
      <div class="modal-actions">${button('Bekor qilish','close-modal','close','secondary')}${button('Tekshirdim — zaxiradan tiklash','confirm-restore','check','primary')}</div>`,true);
  }catch(error){toast(error.message);}
  finally{const input=$('#backup-file');if(input)input.value='';}
}
function restoreBackup(){
  bossGuard();if(!pendingBackup)throw Error('Avval zaxira faylini tanlang.');
  const currentRaw=localStorage.getItem(KEY);
  if(currentRaw!==pendingBackup.baseRaw)throw Error('Fayl ko‘rilayotgan paytda boshqa oynada ma’lumot o‘zgardi. Zaxira faylini qayta tanlab solishtiring.');
  const next=structuredClone(pendingBackup.state);
  next.operations.push({id:uid(),actor:user,kind:'backup-restore',at:new Date().toISOString(),status:'local'});
  log(next,user,'Zaxira faylidan tiklandi: '+pendingBackup.name);
  try{if(currentRaw!==null)localStorage.setItem(RECOVERY_KEY,currentRaw);localStorage.setItem(KEY,JSON.stringify(next));}
  catch{throw Error('Brauzerda zaxira nusxasi uchun joy yetmadi yoki saqlash yopilgan. Joriy ma’lumot almashtirilmadi.');}
  state=next;loadFailed=false;storedRaw=null;cart=[];pendingBackup=null;closeModal();navigate('settings');toast('Zaxiradan tiklandi. Tiklashdan oldingi nusxa ham saqlandi.');
}
function notifications(){
  const low=allowed('inventory')?activeProducts().filter(isLowStock):[];
  const stockReminder=low.length?`<div class="notification-item"><b>${low.length} ta mahsulot guruhi kamaygan</b><p>Guruhlarning qoldig‘i va eslatma chegarasini ko‘ring.</p>${button('Kam qoldiqlarni ko‘rish','lowstock','alert','secondary')}</div>`:'';
  const rows=currentReminders().map(r=>`<div class="notification-item ${r.level==='overdue'?'urgent':''}"><b>${esc(r.text)}</b>${r.phone?`<p>${esc(r.phone)}</p>`:''}${reminderActions(r)}</div>`).join('');
  const notices=boss()?state.notices.slice(0,30).map(n=>`<div class="notification-item"><b>${esc(n.text)}</b><p>${name(n.actor)} · ${dateLabel(n.at)}</p></div>`).join(''):'';
  openModal('Eslatmalar',stockReminder+rows+notices+(!stockReminder&&!rows&&!notices?empty('Yangi eslatma yo‘q','Qarz muddati, kirim topshiriqlari va xodim amallari shu yerga tushadi.'):''));
  const markRead=promise=>later(promise.then(()=>{needsRender=true;}));
  if(boss()&&state.notices.some(n=>!n.read))markRead(act('notices.markRead'));
  if(state.inbox.some(n=>n.to===user&&!n.read))markRead(act('inbox.markRead',{}));
}
function purchaseHistory(){bossGuard();openModal('Tovar kirimlari',`<div class="table-scroll"><table><thead><tr><th>SANA / MAHSULOT</th><th>SONI / TANNARX</th><th>JAMI / HOLAT</th><th>AMALLAR</th></tr></thead><tbody>${state.purchases.slice().reverse().map(p=>`<tr><td>${p.date}<small>${esc(title(state.products.find(x=>x.id===p.productId)))}</small><small>${esc(p.note)}</small></td><td>${p.qty} dona<small>${money(p.cost)} so‘m</small></td><td>${money(p.qty*p.cost)}<small>${p.deletedAt?'Bekor qilingan':accountName(p.account||CASH_ACCOUNT)}</small></td><td>${!p.deletedAt?button('Tahrirlash','edit-purchase','settings','compact secondary',`data-id="${p.id}"`)+button('O‘chirish','delete-purchase','trash','compact danger',`data-id="${p.id}"`):'Tarixda'}</td></tr>`).join('')}</tbody></table>${state.purchases.length?'':empty('Yangi kirim yozilmagan')}</div>`,true);}
function openingBalancesModal(){bossGuard();openModal('Boshlang‘ich qoldiqlar',`<form id="opening-balances-form"><p class="group-entry-help">Hisob yuritish boshlanishidan oldingi pulni kiriting. Keyingi sotuv va chiqimlar shu summaga qo‘shib hisoblanadi. Bugungi sanalgan pulni bu yerga yozmang — «Kunni yopish»dan foydalaning.</p><div class="form-grid">${ACCOUNTS.map(([id,label])=>field(label+' · boshlang‘ich',id,'number',state.settings.openingAccounts[id],numberExtra)).join('')}${['jasur','sardor'].map(id=>field(name(id)+'ga avvaldan qarz',id,'number',state.settings.openingPayables?.[id]||0,numberExtra)).join('')}</div>${note('Boshlang‘ich hisob izohi')}${submit()}</form>`);}
function openingDebtModal(){bossGuard();openModal('Avvaldan qolgan qarz',`<form id="opening-debt-form"><p class="group-entry-help">Tizimga o‘tishdan oldingi qarz. Yangi savdo va foyda hisoblanmaydi.</p><div class="form-grid">${field('Xaridor ismi','customer','text','','maxlength="80"')}${field('Telefon raqami','phone','tel','','maxlength="22" placeholder="+998 90 123 45 67"')}${field('Qolgan qarz','amount','number','','min="1" max="1000000000000" step="1"')}${field('Qaytarish sanasi','due','date',TODAY)}</div>${note('Qarz nima uchun qolgan?')}${submit()}</form>`);}
function download(filename,text,type='text/csv;charset=utf-8'){const url=URL.createObjectURL(new Blob([type.includes('csv')?'\uFEFF':'',text],{type})),link=document.createElement('a');link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function csv(rows){return rows.map(row=>row.map(value=>'"'+String(value??'').replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"').join(',')).join('\r\n');}
function resetCatalog(){catalogOwner='all';brand='all';series='all';quality='all';audience='all';material='all';query='';category='all';}
function navigate(target){if(!canVisit(state,user,target))throw Error('Bu bo‘lim Otabek tomonidan ruxsat etilmagan.');page=Object.hasOwn(pages,target)?target:'dashboard';resetCatalog();salesIndex=0;closeModal();render();window.scrollTo({top:0});}
function bossGuard(){if(!boss())throw Error('Bu ma’lumotlarni faqat boshliq o‘zgartiradi.');}
document.addEventListener('pointerdown',event=>{
  if(event.button!==0||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const target=event.target.closest('.btn,.theme-trigger,.theme-choice,.nav-item,.brand-card,.product-card');
  if(!target||target.disabled)return;
  const rect=target.getBoundingClientRect(),size=Math.hypot(rect.width,rect.height)*2;
  const ripple=document.createElement('span');ripple.className='touch-ripple';ripple.setAttribute('aria-hidden','true');
  Object.assign(ripple.style,{width:size+'px',height:size+'px',left:event.clientX-rect.left-size/2+'px',top:event.clientY-rect.top-size/2+'px'});
  target.append(ripple);setTimeout(()=>ripple.remove(),600);
});
document.addEventListener('click',event=>{
  const el=event.target.closest('[data-action]');if(!el)return;event.preventDefault();const id=el.dataset.id,value=el.dataset.value;
  try{switch(el.dataset.action){
    case 'employee-services':bossGuard();employee=id;navigate('services');break;
    case 'new-service':serviceModal();break;
    case 'edit-service':serviceModal(id);break;
    case 'edit-product':editProductModal(id);break;
    case 'edit-debt':editDebtModal(id);break;
    case 'edit-movement':editMovementModal(id);break;
    case 'edit-sale':editSaleModal(id);break;
    case 'edit-purchase':editPurchaseModal(id);break;
    case 'edit-closing':editClosingModal(id);break;
    case 'edit-defect':editDefectModal(id);break;
    case 'defect-history':defectHistory();break;
    case 'edit-catalog':catalogEditModal(el.dataset.kind,id);break;
    case 'delete-catalog':confirmDelete('catalog',id,{kind:el.dataset.kind});break;
    case 'delete-sale':case 'delete-closing':case 'delete-defect':case 'delete-product':case 'delete-service':case 'delete-debt':case 'delete-purchase':case 'delete-rent':case 'delete-movement':confirmDelete(el.dataset.action.slice(7),id);break;
    case 'restore-product':later(act('product.archive',{id,archive:false}).then(()=>{render();toast('Mahsulot tiklandi.');}));break;
    case 'mobile-menu':mobileMenu();break;
    case 'view-cart':{const panel=$('#current-cart');panel?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});panel?.focus({preventScroll:true});break;}
    case 'themes':openThemeModal();break;
    case 'theme-select':{const result=chooseTheme(value);if(!result.persisted)toast('Mavzu o‘zgardi. Brauzer xotirasiga saqlab bo‘lmadi.');break;}
    case 'nav':navigate(el.dataset.page);break;
    case 'period':period=value;salesIndex=0;render();break;
    case 'brand':brand=value;series='all';query='';render();break;
    case 'series':series=value;query='';render();$('#search')?.focus();break;
    case 'category':category=value;render();break;
    case 'catalog-reset':resetCatalog();render();break;
    case 'lowstock':navigate('lowstock');break;
    case 'stock-limit':stockLimitModal(id);break;
    case 'find-product':{const p=state.products.find(p=>p.id===id);navigate('inventory');query=p.sku;render();break;}
    case 'case-groups':caseGroupsModal();break;
    case 'new-product':productModal();break;
    case 'catalog-price':catalogPriceModal(id);break;
    case 'purchase':purchaseModal(id);break;
    case 'purchase-history':purchaseHistory();break;
    case 'defect':defectModal(id);break;
    case 'add-cart':addCart(id);break;
    case 'cart-minus':cart.find(r=>r.productId===id).qty--;cart=cart.filter(r=>r.qty);render();break;
    case 'cart-plus':addCart(id);break;
    case 'clear-cart':cart=[];render();break;
    case 'checkout':if([...document.querySelectorAll('[data-price]')].every(i=>i.reportValidity()))paymentModal();break;
    case 'receipt':receiptModal(id);break;
    case 'find-receipt':openModal('Chekni topish',`<form id="find-receipt-form">${field('Chek raqami','receipt','text','','placeholder="S-1123" maxlength="40"')}${submit('Topish')}</form>`);break;
    case 'return':returnModal(id);break;
    case 'sales-prev':salesIndex=Math.max(0,salesIndex-1);render();break;
    case 'sales-next':salesIndex++;render();break;
    case 'flow':flowModal();break;
    case 'movement-detail':movementModal(id);break;
    case 'reverse-movement':reverseModal(id);break;
    case 'closing-detail':closingDetail(id);break;
    case 'restore-backup':bossGuard();$('#backup-file').click();break;
    case 'confirm-restore':restoreBackup();break;
    case 'recovery-backup':bossGuard();download(`telefonzona-tiklashdan-oldin-${TODAY}.json`,localStorage.getItem(RECOVERY_KEY)||'{}','application/json');break;
    case 'opening-balances':openingBalancesModal();break;
    case 'opening-debt':openingDebtModal();break;
    case 'rent':rentModal(id);break;
    case 'pay-rent':rentPaymentModal(id);break;
    case 'repay':repayModal(id);break;
    case 'debt-detail':debtDetail(id);break;
    case 'notifications':notifications();break;
    case 'new-intake':intakeCreateModal();break;
    case 'intake-add-line':document.querySelector('.intake-lines-edit')?.insertAdjacentHTML('beforeend',intakeLineRow());break;
    case 'intake-receive':intakeReceiveModal(id,el.dataset.line);break;
    case 'intake-receive-product':productModal({intakeId:id,lineId:el.dataset.line});break;
    case 'intake-receive-groups':caseGroupsModal({intakeId:id,lineId:el.dataset.line});break;
    case 'reassign-intake':intakeReassignModal(id);break;
    case 'cancel-intake':intakeCancelModal(id);break;
    case 'reset-password':resetPasswordModal(id);break;
    case 'change-password':passwordModal();break;
    case 'logout':later(logout());break;
    case 'retry-boot':void bootServer();break;
    case 'close-day':closingModal();break;
    case 'close-modal':closeModal();break;
    case 'backup':bossGuard();if(SERVER_MODE){later(api.exportBackup().then(text=>download(`telefonzona-${TODAY}.json`,text,'application/json')));break;}download(`telefonzona-${TODAY}.json`,loadFailed?storedRaw:JSON.stringify(state,null,2),'application/json');break;
    case 'export-products':download('telefonzona-mahsulotlar.csv',csv([['SKU','Mahsulot','Kim uchun','G‘ilof turi','Sifat','Egasi','Qoldiq','Eng kam narx','Yuqori narx'],...visibleProducts().map(p=>[p.sku,title(p),audienceName(p.audience),p.material,qualityLabel(p.quality),name(p.owner),stock(p),p.minPrice??'',p.price])]));break;
    case 'export-sales':download('telefonzona-sotuvlar.csv',csv([['Chek','Sana','Sotuvchi','Hisob','Mahsulot','Egasi','Soni','Amaldagi narx','Jami','Izoh','Holati'],...filteredSales().flatMap(s=>s.items.map(i=>[s.id,s.date,name(s.seller),s.account||s.payment,title(i),name(i.owner),i.qty,i.price,i.qty*i.price,s.note,s.returned?'Qaytarilgan':'Sotilgan']))]));break;
    case 'export-report':{bossGuard();const m=report();download('telefonzona-hisobot.csv',csv(boss()?[['Hisobot','Qiymat'],['Davr',period],['Savdo',m.revenue],['Tannarx',m.cogs],['Yalpi foyda',m.gross],['Qo‘shimcha daromad',m.income],['Qo‘shimcha xizmat foydasi',m.serviceProfit],['Xarajat',m.expenses],['Nuqson zarari',m.loss],['Ijara',m.rent],['Sof natija',m.net],['Ijara hisoblandi',m.rentIncluded?'Ha':'Yo‘q']]:[['Hisobot','Qiymat'],['Davr',period],['Sotuvchi',name(user)],['Savdo',m.revenue],['Soni',m.units],['Cheklar',m.count]]));break;}
  }}catch(error){toast(error.message);}
});
document.addEventListener('input',event=>{
  const input=event.target;
  if(input.dataset.price){
    const value=Number(input.value),p=state.products.find(p=>p.id===input.dataset.price),valid=input.value.trim()!==''&&Number.isSafeInteger(value)&&value>=0&&value<=1e9&&(allowed('priceException')||!outsideRange(p,value));
    input.setCustomValidity(valid?'':'Narxni butun so‘mda va ruxsat etilgan oraliqda kiriting.');
    if(valid){cart.find(r=>r.productId===input.dataset.price).price=value;$('#cart-total').innerHTML=money(cartTotal())+'<small> so‘m</small>';const mobileTotal=$('[data-mobile-cart-total]');if(mobileTotal)mobileTotal.innerHTML=money(cartTotal())+' <small>so‘m</small>';document.querySelectorAll('[data-price-note]').forEach(p=>p.textContent=priceNote(cart.find(r=>r.productId===p.dataset.priceNote)));}return;
  }
  if(input.id==='search'){query=input.value;salesIndex=0;const position=input.selectionStart;render();$('#search').focus();$('#search').setSelectionRange(position,position);}
  if(input.closest('#closing-form'))updateClosingPreview();
  if(input.name==='received'&&$('#debt-preview'))$('#debt-preview').textContent='Qoladigan qarz: '+money(Math.max(0,cartTotal()-Number(input.value)))+' so‘m';
});
document.addEventListener('change',event=>{
  const input=event.target;
  if(input.id==='account-menu'){accountMenu(input.value);input.value=user;return;}
  if(input.dataset.cartOwner){try{cart=selectCartOwner(state,cart,input.dataset.cartOwner,input.value,user);render();}catch(error){render();toast(error.message);}return;}
  if(input.id==='backup-file'){void loadBackupFile(input.files?.[0]);return;}
  if(input.closest('#closing-form'))updateClosingPreview();
  if(input.id==='role'){user=input.value;owner='all';employee='all';cart=[];navigate('dashboard');toast(name(user)+' demo ko‘rinishi.');}
  else if(input.id==='owner-filter'){owner=input.value;render();}
  else if(input.id==='catalog-owner'){catalogOwner=input.value;render();}
  else if(input.id==='audience-filter'){audience=input.value;render();}
  else if(input.id==='material-filter'){material=input.value;render();}
  else if(input.id==='quality-filter'){quality=input.value;render();}
  else if(input.id==='employee-filter'){employee=input.value;render();}
  else if(input.name==='mode'&&input.closest('#sale-form')){
    const credit=input.value==='credit';$('#credit-fields').hidden=!credit;$('#credit-fields').querySelectorAll('input').forEach(i=>i.disabled=!credit);
    const exception=cart.some(r=>outsideRange(state.products.find(p=>p.id===r.productId),r.price));$('#sale-form [name="note"]').required=credit||exception;
    $('#debt-preview').textContent='Qoladigan qarz: '+money(cartTotal())+' so‘m';
  }
  else if(input.name==='kind'&&input.closest('#flow-form'))updateFlowForm();
  else if(input.name==='kind'&&input.closest('#defect-form')){
    const repair=input.value==='repair';$('#defect-dispose').hidden=repair;$('#defect-dispose input').disabled=repair;$('#defect-repair').hidden=!repair;$('#defect-repair input').disabled=!repair;
  }
});
document.addEventListener('submit',event=>{
  event.preventDefault();const form=event.target;
  if(form.dataset.busy)return;
  void handleSubmit(form);
});
async function handleSubmit(form){
  const data=Object.fromEntries(new FormData(form));
  if(form.id==='login-form'){await doLogin(form,data);return;}
  const num=key=>{if(String(data[key]??'').trim()==='')throw Error('Raqamli maydonlarni to‘ldiring.');const n=Number(data[key]);if(!Number.isSafeInteger(n)||n<0||n>1e12)throw Error('Raqamlarni tekshiring.');return n;};
  const submitButton=form.querySelector('[type="submit"]');
  // One press, one request: the button stays off until the server (or this browser) has answered.
  form.dataset.busy='1';if(submitButton)submitButton.disabled=true;
  try {
    let receipt=null;
    const context=intakeContext;
    switch(form.matches('.catalog-option-form')?'catalog-option-form':form.matches('.staff-permissions-form')?'staff-permissions-form':form.id){
      case 'edit-closing-form':await act('closing.update',{id:form.dataset.id,data:{...data,actual:num('actual'),float:num('float'),handover:data.handover==='yes'}},form);break;
      case 'edit-defect-form':await act('defect.update',{id:form.dataset.id,data:{...data,qty:num('qty')}},form);break;
      case 'service-form':await act('service.save',{data:{...data,profit:num('profit'),worker:boss()?data.worker:user},id:form.dataset.id||undefined},form);break;
      case 'edit-product-form':await act('product.update',{id:form.dataset.id,data:{...data,min:num('min'),minPrice:num('minPrice'),price:num('price')}},form);break;
      case 'edit-debt-form':await act('debt.update',{id:form.dataset.id,data:{...data,...(data.amount!==undefined?{amount:num('amount')}:{})}},form);break;
      case 'edit-movement-form':await act('movement.correct',{id:form.dataset.id,data:{...data,amount:num('amount')}},form);break;
      case 'edit-sale-form':{const old=state.sales.find(s=>s.id===form.dataset.id);receipt=await act('sale.correct',{id:old.id,data:{...data,received:num('received'),items:old.items.map((item,i)=>({productId:data['product-'+i],qty:num('qty-'+i),price:num('price-'+i)})).filter(item=>item.qty>0)}},form);break;}
      case 'edit-purchase-form':await act('stock.updatePurchase',{id:form.dataset.id,data:{...data,qty:num('qty'),cost:num('cost')}},form);break;
      case 'edit-catalog-form':await act('catalog.change',{kind:form.dataset.kind,value:form.dataset.value,name:data.name},form);resetCatalog();break;
      case 'delete-form':await deleteRecord(form,data);resetCatalog();break;
      case 'catalog-option-form':await act('catalog.add',{kind:form.dataset.kind,name:data.name},form);break;
      case 'staff-permissions-form':await act('staff.permissions',{person:form.dataset.person,name:data.name,permissions:Object.fromEntries(PERMISSIONS.map(p=>[p.id,form.elements[p.id].checked]))},form);break;
      case 'find-receipt-form':{
        const receiptId=data.receipt.trim().replace(/^#/, '').toUpperCase();
        if(!state.sales.some(s=>s.id===receiptId)){
          if(!SERVER_MODE)throw Error('Bu raqamdagi chek topilmadi.');
          // A colleague's receipt is fetched by number; it is a view-only copy until the next sync.
          state.sales.push((await api.receipt(receiptId)).sale);
        }
        receiptModal(receiptId);return;
      }
      case 'sale-form':{
        const received=data.mode==='credit'?num('received'):cartTotal();
        receipt=await act('sale.record',{cart,received,data},form);cart=[];break;
      }
      case 'case-groups-form':{
        requirePermission(state,user,'products');requirePermission(state,user,'stock');const rows=catalog(state).qualities.flatMap(t=>{const values=['qty','cost','minPrice','price'].map(key=>String(data[key+'-'+t.id]||'').trim());if(!values.some(v=>v!==''))return [];if(values.some(v=>v===''))throw Error('Tanlangan sifat uchun soni, tannarx va ikkala narxni to‘ldiring.');return [{quality:t.id,qty:Number(values[0]),cost:Number(values[1]),minPrice:Number(values[2]),price:Number(values[3])}];});
        const payload={...data,min:num('min'),rows};
        if(context)await act('intake.receive',{intakeId:context.intakeId,lineId:context.lineId,mode:'groups',data:payload},form);
        else{await act('product.groups',{data:payload},form);page='inventory';resetCatalog();query=data.model;}
        break;
      }
      case 'stock-limit-form':await act('product.limit',{id:form.dataset.id,min:num('min')},form);break;
      case 'price-form':requirePermission(state,user,'prices');await act('product.price',{id:form.dataset.id,price:num('price'),minPrice:num('minPrice')},form);break;
      case 'purchase-form':requirePermission(state,user,'stock');await act('stock.purchase',{id:form.dataset.id,qty:num('qty'),cost:num('cost'),note:data.note},form);break;
      case 'product-form':{
        const payload={...data,price:num('price'),minPrice:num('minPrice'),min:num('min'),qty:num('qty'),cost:num('cost')};
        if(context)await act('intake.receive',{intakeId:context.intakeId,lineId:context.lineId,mode:'product',data:payload},form);
        else await act('product.register',{data:payload},form);
        break;
      }
      case 'opening-balances-form':bossGuard();await act('opening.set',{accounts:Object.fromEntries(ACCOUNTS.map(([id])=>[id,num(id)])),payables:{jasur:num('jasur'),sardor:num('sardor')},note:data.note},form);break;
      case 'opening-debt-form':bossGuard();await act('debt.openingAdd',{data:{...data,amount:num('amount')}},form);break;
      case 'flow-form':await act('flow.record',{data:{...data,amount:num('amount')}},form);break;
      case 'rent-form':bossGuard();await act('rent.set',{month:data.month,amount:num('amount'),note:data.note},form);break;
      case 'rent-payment-form':await act('rent.pay',{id:form.dataset.id,amount:num('amount'),account:data.account,note:data.note},form);break;
      case 'repay-form':await act('debt.repay',{id:form.dataset.id,amount:num('amount'),note:data.note},form);break;
      case 'return-form':await act('sale.return',{id:form.dataset.id,note:data.note},form);break;
      case 'defect-form':requirePermission(state,user,'defects');if(data.kind==='dispose')await act('stock.dispose',{id:form.dataset.id,qty:num('qty'),note:data.note},form);else await act('flow.record',{data:{kind:'expense',category:'Ta’mirlash',account:data.account,amount:num('amount'),note:form.dataset.id+' · '+data.note}},form);break;
      case 'closing-form':bossGuard();await act('closing.close',{data:{actual:num('actual'),float:num('float'),handover:data.handover==='yes',note:data.note}},form);break;
      case 'reverse-form':await act('movement.reverse',{id:form.dataset.id,note:data.note},form);break;
      case 'settings-form':bossGuard();if(!data.shop.trim())throw Error('Do‘kon nomini yozing.');await act('settings.update',{shop:data.shop.trim(),adminName:data.adminName},form);break;
      case 'intake-form':{
        bossGuard();
        const rows=[...form.querySelectorAll('[data-line-row]')].map(row=>({label:row.querySelector('[name="label"]').value.trim(),qty:row.querySelector('[name="qty"]').value.trim(),productId:row.querySelector('[name="product"]').value})).filter(row=>row.label||row.qty!==''||row.productId);
        if(!rows.length)throw Error('Kamida bitta qator kiriting.');
        const lines=rows.map(row=>{const qty=Number(row.qty);if(row.qty===''||!Number.isSafeInteger(qty)||qty<1)throw Error('Har qatorda kutilayotgan sonni kiriting.');if(!row.label&&!row.productId)throw Error('Har qatorga nima kelishini yozing yoki mahsulotni tanlang.');return {label:row.label,qty,productId:row.productId||undefined};});
        await act('intake.create',{data:{worker:data.worker,note:data.note||'',lines}},form);break;
      }
      case 'intake-receive-form':await act('intake.receive',{intakeId:form.dataset.intake,lineId:form.dataset.line,mode:'purchase',data:{qty:num('qty'),cost:num('cost'),note:data.note}},form);break;
      case 'intake-reassign-form':await act('intake.reassign',{id:form.dataset.id,worker:data.worker},form);break;
      case 'intake-cancel-form':await act('intake.cancel',{id:form.dataset.id,note:data.note},form);break;
      case 'password-form':{
        if(data.next!==data.again)throw Error('Yangi parollar bir xil emas.');
        await api.changePassword(data.current,data.next);closeModal();toast('Parol almashtirildi. Boshqa qurilmalardan chiqarildingiz.');return;
      }
      case 'reset-password-form':{
        bossGuard();await api.resetPassword(form.dataset.person,data.next);closeModal();
        toast(name(form.dataset.person)+' uchun yangi parol o‘rnatildi. U barcha qurilmalardan chiqarildi.');return;
      }
      default:return;
    }
    cart=cart.filter(r=>state.products.some(p=>p.id===r.productId&&!p.archivedAt));closeModal();render();if(receipt)receiptModal(receipt.id);toast(SERVER_MODE?'Saqlandi. Hisoblar yangilandi.':'Shu brauzerga saqlandi. Hisoblar yangilandi.');
  }catch(error){
    if(error.status===401){authLost();return;}
    const output=form.querySelector('.form-error');if(output)output.textContent=error.message;else toast(error.message);
  }finally{
    delete form.dataset.busy;if(submitButton)submitButton.disabled=false;
  }
}
document.addEventListener('keydown',event=>{
  if(event.key==='Enter'&&event.target.id==='search'){event.preventDefault();event.target.blur();}
  if(event.key==='Escape')closeModal();
  if(event.key==='Tab'&&modal){const list=[...document.querySelectorAll('.modal button,.modal input,.modal select,.modal textarea')].filter(el=>!el.disabled&&el.getClientRects().length);if(event.shiftKey&&document.activeElement===list[0]){event.preventDefault();list.at(-1)?.focus();}else if(!event.shiftKey&&document.activeElement===list.at(-1)){event.preventDefault();list[0]?.focus();}}
});
window.addEventListener('offline',()=>{online=false;render();toast(SERVER_MODE?'Internet yo‘q. Yangi amallar bajarilmaydi; ma’lumotlar serverda.':'Internet yo‘q. Yozuvlar shu brauzerda saqlanadi.');});
window.addEventListener('online',()=>{online=true;render();toast(SERVER_MODE?'Internet tiklandi.':'Internet tiklandi. Server ulanmagan; yozuvlar mahalliy saqlanadi.');if(SERVER_MODE)void poll(true);});
if(!SERVER_MODE)window.addEventListener('storage',event=>{if(event.key===KEY&&event.newValue){try{state=prepareState(JSON.parse(event.newValue));render();toast('Shu brauzerning boshqa oynasidan ma’lumot yangilandi.');}catch{toast('Boshqa oynadagi ma’lumotni o‘qib bo‘lmadi.');}}});
let displayedBoundary=+reportWindow(period).start;
setInterval(()=>{const next=+reportWindow(period).start;if(next!==displayedBoundary&&!modal){displayedBoundary=next;render();}},30000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void poll(true);});
document.addEventListener('focusout',()=>setTimeout(flushRender,400));
if(SERVER_MODE)void bootServer();
else{
  render();
  if(loadFailed)toast('Avvalgi ma’lumotni o‘qib bo‘lmadi. Yozuvlar saqlanib qoldi; Sozlamalardan zaxira nusxasini yuklab oling.');
  else {
    try {
      if(storedRaw===null)localStorage.setItem(KEY,JSON.stringify(state));
      // Retire the demo storage, including the pre-restore copy, after the new state exists.
      for(const key of DEMO_KEYS)localStorage.removeItem(key);
    } catch {
      toast('Brauzer xotirasini tekshiring. Ma’lumotlarni saqlab bo‘lmadi.');
    }
  }
}
if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>toast('Offline interfeys keshi o‘rnatilmadi. Yozuvlar brauzerda saqlanadi.'));
