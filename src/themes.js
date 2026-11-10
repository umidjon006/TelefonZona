export const THEME_KEY='telefonzona-theme';
export const DEFAULT_THEME='forest';
export const THEMES=[
  {id:'earth',name:'Sahro',description:'Iliq ranglar. Sokin, o‘ziga ishongan kayfiyat.',label:'Iliq tuproq ranglari',
    colors:['#2D4354','#73766A','#FED7A5','#9E6752','#534145','#20212B'],background:'#20212B',panel:'#2D4354',accent:'#FED7A5',ink:'#FED7A5',sidebar:'#534145'},
  {id:'forest',name:'O‘rmon',description:'Chuqur yashil. Tabiiy uyg‘unlik va xotirjamlik.',label:'Yashil ranglar',
    colors:['#051F20','#0B2B26','#163832','#235347','#8EB69B','#DAF1DE'],background:'#051F20',panel:'#163832',accent:'#8EB69B',ink:'#DAF1DE',sidebar:'#0B2B26'},
  {id:'sky',name:'Osmon',description:'Moviy tuslar. Yengillik, aniqlik va kenglik.',label:'Moviy ranglar',
    colors:['#223A5E','#355982','#4D79A8','#6E9ECC','#9FC0E3','#D0E1F2','#F3F8FD'],background:'#D0E1F2',panel:'#F3F8FD',accent:'#355982',ink:'#223A5E',sidebar:'#223A5E'},
  {id:'glass',name:'Shisha',description:'Ko‘k nur, shaffof qatlamlar va yumshoq harakat.',label:'macOS / iOS shisha uslubi',
    colors:['#03195B','#0B2CB1','#1951FC','#3781FC','#CBE9FD'],background:'#03195B',panel:'#D0E7FF',accent:'#1951FC',ink:'#03195B',sidebar:'#0B2CB1'},
];
export function resolveTheme(value){return THEMES.find(theme=>theme.id===value)||THEMES.find(theme=>theme.id===DEFAULT_THEME);}
export function loadTheme(storage){try{return resolveTheme(storage.getItem(THEME_KEY));}catch{return resolveTheme(DEFAULT_THEME);}}
export function saveTheme(storage,value){
  const theme=THEMES.find(theme=>theme.id===value);
  if(!theme)throw Error('Bunday mavzu yo‘q.');
  try{storage.setItem(THEME_KEY,theme.id);return {theme,persisted:true};}catch{return {theme,persisted:false};}
}
export function applyTheme(value,{animate=false}={}){
  const theme=resolveTheme(value),root=document.documentElement;
  root.dataset.theme=theme.id;
  root.style.colorScheme=['earth','forest'].includes(theme.id)?'dark':'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme.background);
  if(animate){
    root.classList.add('theme-changing');
    clearTimeout(applyTheme.timer);
    applyTheme.timer=setTimeout(()=>root.classList.remove('theme-changing'),500);
  }
  for(const button of document.querySelectorAll('[data-action="theme-select"]')){
    const selected=button.dataset.value===theme.id;
    button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));
    const status=button.querySelector('.theme-choice-status');if(status)status.textContent=selected?'Tanlangan':'Tanlash';
  }
  for(const button of document.querySelectorAll('[data-action="themes"]'))button.setAttribute('title','Mavzu: '+theme.name);
  const output=document.querySelector('#theme-live-status');if(output)output.textContent=theme.name+' mavzusi tanlandi.';
  return theme;
}
export function initializeTheme(){
  let theme;
  try{theme=loadTheme(window.localStorage);}catch{theme=resolveTheme(DEFAULT_THEME);}
  applyTheme(theme.id);
  window.addEventListener('storage',event=>{if(event.key===THEME_KEY)applyTheme(resolveTheme(event.newValue).id,{animate:true});});
}
export function chooseTheme(value){
  let result;
  try{result=saveTheme(window.localStorage,value);}catch(error){
    if(!THEMES.some(theme=>theme.id===value))throw error;
    result={theme:resolveTheme(value),persisted:false};
  }
  applyTheme(result.theme.id,{animate:true});return result;
}
