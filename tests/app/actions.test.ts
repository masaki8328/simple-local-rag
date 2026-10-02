import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
// No fake session or service: entry points must stop before cookies/network when unconfigured.
test('all mutation and login actions fail closed without configuration',async()=>{
 const hook=registerHooks({resolve(specifier,context,nextResolve){if(specifier==='next/navigation')return {url:pathToFileURL(resolve('tests/app/mock-navigation.cjs')).href,shortCircuit:true};return nextResolve(specifier,context);}});
 const {createProject,editProject,createPaper,editPaper,archiveRecord,signIn}=await import('../../src/server/actions');
 hook.deregister();
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 try{
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  for(const action of [createProject,editProject,createPaper,editPaper,archiveRecord,signIn]){
   const result=await action({},new FormData());assert.ok(result.error?.includes('設定が必要'));assert.equal(result.success,undefined);assert.equal(result.destination,undefined);
  }
 }finally{if(url===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=url;if(key===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=key;}
});
