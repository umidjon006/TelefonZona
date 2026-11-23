import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {boot,PRODUCT,PASSWORDS} from './server-helpers.mjs';
import {TOOL_NAMES} from '../server/mcp.js';

const CALLBACK='https://claude.ai/api/mcp/auth_callback';
const form=values=>({'content-type':'application/x-www-form-urlencoded'});
const post=(url,values,headers={})=>fetch(url,{method:'POST',redirect:'manual',headers:{'content-type':'application/x-www-form-urlencoded',...headers},body:new URLSearchParams(values).toString()});
const pkce=()=>{const verifier=randomBytes(48).toString('base64url');return {verifier,challenge:createHash('sha256').update(verifier).digest('base64url')};};

async function register(ctx,redirect=CALLBACK){
  const res=await fetch(ctx.base+'/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({client_name:'Claude',redirect_uris:[redirect]})});
  return {status:res.status,json:await res.json()};
}
// Runs the real flow: register, sign in on the authorize page, exchange the code with PKCE.
async function connect(ctx,person,password=PASSWORDS[person]){
  const {json:client}=await register(ctx);
  const {verifier,challenge}=pkce();
  const params={response_type:'code',client_id:client.client_id,redirect_uri:CALLBACK,code_challenge:challenge,code_challenge_method:'S256',state:'xyz',scope:'mcp:read'};
  const page=await fetch(ctx.base+'/authorize?'+new URLSearchParams(params));
  assert.equal(page.status,200);
  const done=await post(ctx.base+'/authorize',{...params,person,password,decision:'allow'});
  assert.equal(done.status,302,'redirects back with a code');
  const back=new URL(done.headers.get('location'));
  assert.equal(back.origin+back.pathname,CALLBACK);assert.equal(back.searchParams.get('state'),'xyz');
  const token=await post(ctx.base+'/token',{grant_type:'authorization_code',code:back.searchParams.get('code'),client_id:client.client_id,redirect_uri:CALLBACK,code_verifier:verifier});
  assert.equal(token.status,200);
  return {client,tokens:await token.json(),params,verifier,code:back.searchParams.get('code')};
}
const rpc=(ctx,token,message,headers={})=>fetch(ctx.base+'/mcp',{method:'POST',headers:{'content-type':'application/json',accept:'application/json, text/event-stream',authorization:'Bearer '+token,...headers},body:JSON.stringify(message)});
async function call(ctx,token,name,args={}){
  const res=await rpc(ctx,token,{jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}});
  const body=await res.json();
  const result=body.result;
  return {isError:result.isError,text:result.content[0].text,data:result.isError?null:JSON.parse(result.content[0].text)};
}
async function shop(ctx){
  const [boss,boybek]=await Promise.all([ctx.signIn('aziz'),ctx.signIn('sardor')]);
  const product=(await boss.command('product.register',{data:PRODUCT})).json.view.products[0];
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tashkent'}).format(new Date());
  await boybek.command('sale.record',{cart:[{productId:product.id,qty:2,price:30000}],received:20000,data:{payment:'Naqd',customer:'Ali Valiyev',phone:'+998901234567',due:today,note:'ertaga beradi'}});
  await boss.command('sale.record',{cart:[{productId:product.id,qty:1,price:30000}],received:30000,data:{payment:'Naqd'}});
  return {boss,boybek,product,today};
}
const withServer=async fn=>{const ctx=await boot();try{await fn(ctx);}finally{await ctx.close();}};

test('discovery documents and the sign-in challenge let Claude find the way in',async()=>withServer(async ctx=>{
  const resource=await (await fetch(ctx.base+'/.well-known/oauth-protected-resource')).json();
  assert.equal(resource.resource,ctx.base+'/mcp');assert.deepEqual(resource.authorization_servers,[ctx.base]);
  const meta=await (await fetch(ctx.base+'/.well-known/oauth-authorization-server')).json();
  assert.equal(meta.authorization_endpoint,ctx.base+'/authorize');assert.deepEqual(meta.code_challenge_methods_supported,['S256']);
  assert.ok(meta.registration_endpoint&&meta.token_endpoint);
  const denied=await fetch(ctx.base+'/mcp',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
  assert.equal(denied.status,401);
  assert.match(denied.headers.get('www-authenticate'),/resource_metadata="[^"]+\/\.well-known\/oauth-protected-resource"/);
  assert.equal((await fetch(ctx.base+'/mcp')).status,405);
}));

test('a staff member authorises Claude with their password and the MCP handshake works',async()=>withServer(async ctx=>{
  const {tokens}=await connect(ctx,'sardor');
  assert.equal(tokens.token_type,'Bearer');assert.ok(tokens.refresh_token);assert.equal(tokens.expires_in,3600);
  const init=await (await rpc(ctx,tokens.access_token,{jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'claude',version:'1'}}})).json();
  assert.equal(init.result.protocolVersion,'2025-06-18');assert.equal(init.result.serverInfo.name,'telefonzona');assert.ok(init.result.capabilities.tools);
  assert.equal((await rpc(ctx,tokens.access_token,{jsonrpc:'2.0',method:'notifications/initialized'})).status,202);
  const old=await (await rpc(ctx,tokens.access_token,{jsonrpc:'2.0',id:2,method:'initialize',params:{protocolVersion:'1999-01-01'}})).json();
  assert.equal(old.result.protocolVersion,'2025-06-18','unknown versions get the newest supported one');
  const list=await (await rpc(ctx,tokens.access_token,{jsonrpc:'2.0',id:3,method:'tools/list'})).json();
  assert.deepEqual(list.result.tools.map(t=>t.name),TOOL_NAMES);
  assert.ok(list.result.tools.every(t=>t.annotations.readOnlyHint===true&&t.inputSchema.type==='object'),'every tool is declared read-only');
  const unknown=await (await rpc(ctx,tokens.access_token,{jsonrpc:'2.0',id:4,method:'resources/list'})).json();
  assert.equal(unknown.error.code,-32601);
  const batch=await (await rpc(ctx,tokens.access_token,[{jsonrpc:'2.0',id:5,method:'ping'},{jsonrpc:'2.0',method:'notifications/initialized'}])).json();
  assert.equal(batch.length,1);assert.equal(batch[0].id,5);
}));

test('the boss’s connector sees shop-wide money; a seller’s sees only what their own screen shows',async()=>withServer(async ctx=>{
  const {boss,product}=await shop(ctx);
  const b=(await connect(ctx,'aziz')).tokens.access_token,s=(await connect(ctx,'sardor')).tokens.access_token;
  const bossSummary=await call(ctx,b,'get_shop_summary',{period:'all'});
  assert.equal(bossSummary.data.receipts,2);assert.equal(bossSummary.data.revenue,90000);assert.equal(bossSummary.data.cost_of_goods,60000);
  assert.equal(bossSummary.data.gross_profit,30000);assert.equal(bossSummary.data.open_debt_total,40000);
  const mine=await call(ctx,s,'get_shop_summary',{period:'all'});
  assert.deepEqual(Object.keys(mine.data).sort(),['my_receipts','my_sales_total','my_service_profit','my_units_sold','period','since']);
  assert.equal(mine.data.my_receipts,1);assert.equal(mine.data.my_sales_total,60000);
  for(const tool of ['get_cash_position','staff_performance']){
    const refused=await call(ctx,s,tool);assert.equal(refused.isError,true,tool);assert.match(refused.text,/faqat Otabek/);
  }
  assert.equal((await call(ctx,b,'get_cash_position')).data.open_debt_total,40000);
  const sellerSales=await call(ctx,s,'list_sales',{period:'all'});
  assert.equal(sellerSales.data.sales.length,1);assert.equal(sellerSales.data.sales[0].seller,'Boybek');
  assert.equal('gross_profit' in sellerSales.data.sales[0],false);assert.equal('cost_of_goods' in sellerSales.data.sales[0],false);
  const bossSales=await call(ctx,b,'list_sales',{period:'all'});
  assert.equal(bossSales.data.sales.length,2);assert.equal(bossSales.data.sales.at(-1).gross_profit,20000);
  assert.equal((await call(ctx,s,'list_sales',{period:'all',seller:'aziz'})).isError,true,'a seller cannot ask for someone else’s receipts');
  const found=await call(ctx,b,'search_products',{query:product.name.split(' ')[0]});
  assert.equal(found.data.products[0].in_stock,7);assert.equal(found.data.products[0].avg_unit_cost,20000);
  assert.equal((await call(ctx,b,'search_products',{owner:'Boybek'})).data.total_found,0);
  const debts=await call(ctx,s,'list_debts',{only_due:true});
  assert.equal(debts.data.debts[0].customer,'Ali Valiyev');assert.equal(debts.data.debts[0].status,'due_today');
  const reminders=await call(ctx,s,'get_reminders');
  assert.match(reminders.data.reminders[0].text,/^Bugun Ali Valiyev qarzini berishi kerak/);
  void boss;
}));

test('permissions Otabek switches off also switch off the connector’s view',async()=>withServer(async ctx=>{
  const {boss}=await shop(ctx);
  const s=(await connect(ctx,'sardor')).tokens.access_token;
  const me=(await (await ctx.signIn('sardor')).get('/api/me')).json.user.permissions;
  const full={...me,debts:false,stock:false,products:false};
  assert.equal((await boss.command('staff.permissions',{person:'sardor',name:'Boybek',permissions:full})).status,200);
  const refused=await call(ctx,s,'list_debts');assert.equal(refused.isError,true);assert.match(refused.text,/ruxsat/);
  const found=await call(ctx,s,'search_products');
  assert.equal(found.data.products.some(p=>'avg_unit_cost' in p),false,'no cost without stock permission');
}));

test('no tool can change any record, and bad arguments come back as readable tool errors',async()=>withServer(async ctx=>{
  await shop(ctx);
  const b=(await connect(ctx,'aziz')).tokens.access_token;
  const before=ctx.store.version(),snapshot=JSON.stringify(ctx.store.read().state);
  for(const name of TOOL_NAMES)await call(ctx,b,name,{});
  assert.equal(ctx.store.version(),before);assert.equal(JSON.stringify(ctx.store.read().state),snapshot);
  for(const [name,args] of [['search_products',{limit:0}],['search_products',{limit:'many'}],['get_shop_summary',{period:'century'}],['list_sales',{seller:'nobody'}],['search_products',{owner:'nobody'}]]){
    const bad=await call(ctx,b,name,args);assert.equal(bad.isError,true,name+JSON.stringify(args));
  }
  const unknown=await (await rpc(ctx,b,{jsonrpc:'2.0',id:9,method:'tools/call',params:{name:'delete_everything',arguments:{}}})).json();
  assert.equal(unknown.error.code,-32602);
  assert.ok(!TOOL_NAMES.some(n=>/create|update|delete|record|set_|register|pay|close/.test(n)),'only read tools exist');
}));

test('wrong password gives no code; deny and unregistered addresses never reach another site',async()=>withServer(async ctx=>{
  const {json:client}=await register(ctx);
  const {challenge}=pkce();
  const params={response_type:'code',client_id:client.client_id,redirect_uri:CALLBACK,code_challenge:challenge,code_challenge_method:'S256',state:'s1'};
  const wrong=await post(ctx.base+'/authorize',{...params,person:'aziz',password:'xato-parol-1',decision:'allow'});
  assert.equal(wrong.status,401);assert.equal(wrong.headers.get('location'),null);
  const deny=await post(ctx.base+'/authorize',{...params,decision:'deny'});
  assert.equal(deny.status,302);assert.equal(new URL(deny.headers.get('location')).searchParams.get('error'),'access_denied');
  const evil=await fetch(ctx.base+'/authorize?'+new URLSearchParams({...params,redirect_uri:'https://evil.example/cb'}));
  assert.equal(evil.status,400);assert.equal(evil.headers.get('location'),null);
  const noPkce=await fetch(ctx.base+'/authorize?'+new URLSearchParams({...params,code_challenge_method:'plain'}));
  assert.equal(noPkce.status,400);
  const unknownClient=await fetch(ctx.base+'/authorize?'+new URLSearchParams({...params,client_id:'tzc_unknown'}));
  assert.equal(unknownClient.status,400);
  for(const uri of ['https://evil.example/cb','http://claude.ai/api/mcp/auth_callback','https://claude.ai.evil.example/api/mcp/auth_callback','javascript:alert(1)']){
    assert.equal((await register(ctx,uri)).status,400,uri);
  }
  assert.equal((await register(ctx,'http://localhost:6274/oauth/callback')).status,201,'developer tools on this machine are allowed');
}));

test('a code works once, only with its PKCE verifier, client and address',async()=>withServer(async ctx=>{
  const first=await connect(ctx,'aziz');
  const replay=await post(ctx.base+'/token',{grant_type:'authorization_code',code:first.code,client_id:first.client.client_id,redirect_uri:CALLBACK,code_verifier:first.verifier});
  assert.equal(replay.status,400);assert.equal((await replay.json()).error,'invalid_grant');
  const {client}=first;
  const {verifier,challenge}=pkce();
  const params={response_type:'code',client_id:client.client_id,redirect_uri:CALLBACK,code_challenge:challenge,code_challenge_method:'S256'};
  const fresh=async()=>new URL((await post(ctx.base+'/authorize',{...params,person:'aziz',password:PASSWORDS.aziz,decision:'allow'})).headers.get('location')).searchParams.get('code');
  const wrongVerifier=await post(ctx.base+'/token',{grant_type:'authorization_code',code:await fresh(),client_id:client.client_id,redirect_uri:CALLBACK,code_verifier:pkce().verifier});
  assert.equal(wrongVerifier.status,400);
  const burnt=await fresh();
  assert.equal((await post(ctx.base+'/token',{grant_type:'authorization_code',code:burnt,client_id:client.client_id,redirect_uri:CALLBACK,code_verifier:pkce().verifier})).status,400);
  assert.equal((await post(ctx.base+'/token',{grant_type:'authorization_code',code:burnt,client_id:client.client_id,redirect_uri:CALLBACK,code_verifier:verifier})).status,400,'a failed attempt burns the code');
  const otherClient=await register(ctx);
  const stolen=await post(ctx.base+'/token',{grant_type:'authorization_code',code:await fresh(),client_id:otherClient.json.client_id,redirect_uri:CALLBACK,code_verifier:verifier});
  assert.equal(stolen.status,400);
  const ok=await post(ctx.base+'/token',{grant_type:'authorization_code',code:await fresh(),client_id:client.client_id,redirect_uri:CALLBACK,code_verifier:verifier});
  assert.equal(ok.status,200);
  assert.equal((await post(ctx.base+'/token',{grant_type:'password',username:'aziz',password:PASSWORDS.aziz})).status,400);
}));

test('refreshing rotates the tokens; reusing a spent refresh token ends that connection',async()=>withServer(async ctx=>{
  const {client,tokens}=await connect(ctx,'jasur');
  const next=await (await post(ctx.base+'/token',{grant_type:'refresh_token',refresh_token:tokens.refresh_token,client_id:client.client_id})).json();
  assert.ok(next.access_token&&next.refresh_token!==tokens.refresh_token);
  assert.equal((await rpc(ctx,tokens.access_token,{jsonrpc:'2.0',id:1,method:'ping'})).status,401,'old access token is gone');
  assert.equal((await rpc(ctx,next.access_token,{jsonrpc:'2.0',id:1,method:'ping'})).status,200);
  const reuse=await post(ctx.base+'/token',{grant_type:'refresh_token',refresh_token:tokens.refresh_token,client_id:client.client_id});
  assert.equal(reuse.status,400);
  assert.equal((await rpc(ctx,next.access_token,{jsonrpc:'2.0',id:1,method:'ping'})).status,401,'the whole login family is revoked');
}));

test('changing or resetting a password disconnects that person’s Claude connectors',async()=>withServer(async ctx=>{
  const boss=await ctx.signIn('aziz');
  const s=(await connect(ctx,'sardor')).tokens.access_token,j=(await connect(ctx,'jasur')).tokens.access_token;
  assert.equal((await boss.post('/api/admin/password',{person:'sardor',password:'tiklangan-parol-1'})).status,200);
  assert.equal((await rpc(ctx,s,{jsonrpc:'2.0',id:1,method:'ping'})).status,401);
  assert.equal((await rpc(ctx,j,{jsonrpc:'2.0',id:1,method:'ping'})).status,200,'other people stay connected');
  const jasur=await ctx.signIn('jasur');
  assert.equal((await jasur.post('/api/password',{current:PASSWORDS.jasur,next:'yangi-parol-2026'})).status,200);
  assert.equal((await rpc(ctx,j,{jsonrpc:'2.0',id:1,method:'ping'})).status,401);
}));

test('browser pages from other sites cannot talk to /mcp; the sign-in page cannot be framed',async()=>withServer(async ctx=>{
  const {tokens}=await connect(ctx,'aziz');
  assert.equal((await rpc(ctx,tokens.access_token,{jsonrpc:'2.0',id:1,method:'ping'},{origin:'https://evil.example'})).status,403);
  assert.equal((await rpc(ctx,tokens.access_token,{jsonrpc:'2.0',id:1,method:'ping'},{origin:'https://claude.ai'})).status,200);
  const {json:client}=await register(ctx);
  const page=await fetch(ctx.base+'/authorize?'+new URLSearchParams({response_type:'code',client_id:client.client_id,redirect_uri:CALLBACK,code_challenge:pkce().challenge,code_challenge_method:'S256'}));
  assert.match(page.headers.get('content-security-policy'),/frame-ancestors 'none'/);
  assert.equal(page.headers.get('x-frame-options'),'DENY');
  const html=await page.text();
  assert.match(html,/faqat o‘qimoqchi/);assert.ok(html.includes('claude.ai'));
}));
