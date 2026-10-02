import test from 'node:test';
import assert from 'node:assert/strict';
import {supabaseGateway} from '../../src/server/dal';
import {ResearchDAL} from '../../src/server/research';
import {AppError} from '../../src/application/models';
import type {SupabaseClient} from '@supabase/supabase-js';
const id='11111111-1111-4111-8111-111111111111';
test('Supabase gateway rejects unverified claims even if a sub is returned',async()=>{
 const client={auth:{getClaims:async()=>({data:{claims:{sub:id}},error:{message:'bad signature'}})}} as unknown as SupabaseClient;
 assert.equal(await supabaseGateway(client).verifiedUser(),null);
});
test('Supabase gateway uses verified sub, not user_metadata owner claims',async()=>{
 const client={auth:{getClaims:async()=>({data:{claims:{sub:id,user_metadata:{owner_user_id:'forged'}}},error:null})}} as unknown as SupabaseClient;
 assert.deepEqual(await supabaseGateway(client).verifiedUser(),{id});
});
test('gateway paper read always includes both tenant and paper filters',async()=>{
 const filters:unknown[]=[];
 const query={select:()=>query,eq:(key:string,value:string)=>{filters.push([key,value]);return query;},maybeSingle:async()=>({data:null,error:null})};
 const client={from:()=>query} as unknown as SupabaseClient;
 assert.equal(await supabaseGateway(client).getPaper('project-test','paper-test'),null);
 assert.deepEqual(filters,[['project_id','project-test'],['id','paper-test']]);
});
test('RPC conflict is safely mapped without echoing database detail',async()=>{
 const client={rpc:async()=>({data:null,error:{message:'KG_CONFLICT'}})} as unknown as SupabaseClient;
 await assert.rejects(supabaseGateway(client).write('edit_paper',{}),(e:unknown)=>e instanceof AppError&&e.code==='CONFLICT');
 const other={rpc:async()=>({data:null,error:{message:'private SQL detail should never reach UI'}})} as unknown as SupabaseClient;
 await assert.rejects(supabaseGateway(other).write('edit_paper',{}),(e:unknown)=>e instanceof AppError&&e.message==='UNAVAILABLE');
});
test('no request-time path supplies a fake identity to production DAL',async()=>{
 // Fakes exist only in this test. Production ResearchDAL must still verify gateway claims.
 const gateway=supabaseGateway({auth:{getClaims:async()=>({data:null,error:null})}} as unknown as SupabaseClient);
 await assert.rejects(new ResearchDAL(gateway).projects(),(e:unknown)=>e instanceof AppError&&e.code==='UNAUTHENTICATED');
});
