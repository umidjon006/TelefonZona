import test from 'node:test';
import assert from 'node:assert/strict';
import {THEME_KEY,loadTheme,saveTheme} from '../src/themes.js';

test('theme choice persists without changing any accounting data',()=>{
  const data=new Map([['telefonzona-v1','{"sales":[123]}']]);
  const storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};
  for(const id of ['earth','forest','sky','glass']){
    assert.equal(saveTheme(storage,id).persisted,true);
    assert.equal(loadTheme(storage).id,id);
    assert.equal(data.get('telefonzona-v1'),'{"sales":[123]}');
    assert.equal(data.size,2);
  }
  assert.equal(data.get(THEME_KEY),'glass');
});

test('missing, unknown or inaccessible preferences fall back safely',()=>{
  for(const value of [null,'old-theme','__proto__'])assert.equal(loadTheme({getItem:()=>value}).id,'forest');
  assert.equal(loadTheme({getItem(){throw Error('Blocked');}}).id,'forest');
});

test('blocked storage still permits the requested appearance for this session',()=>{
  const result=saveTheme({setItem(){throw Error('Quota');}},'glass');
  assert.equal(result.theme.id,'glass');
  assert.equal(result.persisted,false);
  let writes=0;
  assert.throws(()=>saveTheme({setItem(){writes++;}},'unknown'));
  assert.equal(writes,0);
});
