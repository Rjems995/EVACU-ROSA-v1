import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({fail:false, payload:null as null | Record<string,unknown>}));
vi.mock('@/lib/supabase', () => ({configured:()=>true, supabase:()=>({rpc:async (_name:string, payload:Record<string,unknown>) => {
  state.payload=payload;
  return {data:state.fail ? null : payload.request_id,error:state.fail ? {message:'Database unavailable'} : null};
}})}));
import { POST } from '../src/app/api/assistance/route';
const input={id:'11111111-1111-4111-8111-111111111111',origin:[121.109,14.297],source:'selected',details:'Road is blocked',contact:'',consent:true};
const send=(data:unknown)=>POST(new Request('http://localhost/api/assistance',{method:'POST',body:JSON.stringify(data)}));
beforeEach(()=>{state.fail=false;state.payload=null;});
it('requires explicit location-sharing consent',async()=>{
  expect((await send({...input,consent:false})).status).toBe(400);
  expect(state.payload).toBeNull();
});
it('rejects invalid coordinates and forged status fields',async()=>{
  expect((await send({...input,origin:[999,999]})).status).toBe(400);
  expect((await send({...input,status:'resolved'})).status).toBe(400);
  expect(state.payload).toBeNull();
});
it('submits the exact selected location and stable request ID',async()=>{
  const response=await send(input);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({id:input.id,received:true});
  expect(state.payload).toMatchObject({request_id:input.id,lng:121.109,lat:14.297,source:'selected'});
});
it('never confirms receipt on database failure',async()=>{
  state.fail=true;
  const response=await send(input);
  expect(response.status).toBe(503);
  expect((await response.json()).received).toBeUndefined();
});
