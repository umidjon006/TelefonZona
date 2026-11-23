import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {PASSWORDS} from './server-helpers.mjs';

export const CALLBACK='https://claude.ai/api/mcp/auth_callback';
const post=(url,values)=>fetch(url,{method:'POST',redirect:'manual',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(values).toString()});

// Signs a person in through the real OAuth screens and returns the access token.
export async function connectAs(ctx,person,{write=false}={}){
  const reg=await (await fetch(ctx.base+'/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({client_name:'Claude',redirect_uris:[CALLBACK]})})).json();
  const verifier=randomBytes(48).toString('base64url'),challenge=createHash('sha256').update(verifier).digest('base64url');
  const params={response_type:'code',client_id:reg.client_id,redirect_uri:CALLBACK,code_challenge:challenge,code_challenge_method:'S256'};
  const done=await post(ctx.base+'/authorize',{...params,person,password:PASSWORDS[person],decision:write?'allow_write':'allow_read'});
  assert.equal(done.status,302);
  const code=new URL(done.headers.get('location')).searchParams.get('code');
  const token=await post(ctx.base+'/token',{grant_type:'authorization_code',code,client_id:reg.client_id,redirect_uri:CALLBACK,code_verifier:verifier});
  const tokens=await token.json();
  return {token:tokens.access_token,scope:tokens.scope,tokens,client:reg};
}
export const rpc=(ctx,token,message)=>fetch(ctx.base+'/mcp',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify(message)});
let counter=0;
export async function tool(ctx,token,name,args={}){
  const res=await rpc(ctx,token,{jsonrpc:'2.0',id:++counter,method:'tools/call',params:{name,arguments:args}});
  const body=await res.json();
  if(body.error)return {rpcError:body.error,isError:true,text:body.error.message,data:null};
  const result=body.result;
  return {isError:result.isError,text:result.content[0].text,data:result.isError?null:JSON.parse(result.content[0].text)};
}
