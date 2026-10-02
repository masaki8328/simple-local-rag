// Test-only browser harness. It never changes production authentication or creates an app route.
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
async function main(){
 const result=await build({entryPoints:['tests/browser/form-harness.tsx'],bundle:true,write:false,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},plugins:[{name:'test-only-adapters',setup(build){
  build.onResolve({filter:/server\/actions$/},()=>({path:resolve('tests/browser/mock-actions.ts')}));
  build.onResolve({filter:/^next\/navigation$/},()=>({path:resolve('tests/browser/mock-navigation.ts')}));
 }}]});
 const css=await readFile('src/app/globals.css');
 const server=createServer((req,res)=>{
  if(req.url==='/bundle.js'){res.setHeader('Content-Type','text/javascript');res.end(result.outputFiles[0].contents);}
  else if(req.url==='/style.css'){res.setHeader('Content-Type','text/css');res.end(css);}
  else {res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="ja"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="root"></div><script src="/bundle.js"></script></html>');}
 });
 server.listen(3191,'127.0.0.1');
 for(const signal of ['SIGTERM','SIGINT'] as const)process.on(signal,()=>server.close(()=>process.exit(0)));
}
main().catch(()=>{console.error('Synthetic harness failed to start');process.exitCode=1;});
