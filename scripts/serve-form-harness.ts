// Test-only browser harness. It never changes production authentication or creates an app route.
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
async function main(){
 const result=await build({entryPoints:['tests/browser/form-harness.tsx'],bundle:true,write:false,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},plugins:[{name:'test-only-adapters',setup(build){
  build.onResolve({filter:/server\/actions$/},()=>({path:resolve('tests/browser/mock-actions.ts')}));
  build.onResolve({filter:/^next\/link$/},()=>({path:resolve('tests/browser/mock-link.tsx')}));
  build.onResolve({filter:/^next\/navigation$/},()=>({path:resolve('tests/browser/mock-navigation.ts')}));
 }}]});
 const css=await readFile('src/app/globals.css');
 const server=createServer((req,res)=>{
  if(req.url==='/bundle.js'){res.setHeader('Content-Type','text/javascript');res.end(result.outputFiles[0].contents);}
  else if(req.url==='/style.css'){res.setHeader('Content-Type','text/css');res.end(css);}
  else {res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="ja"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="root"></div><script src="/bundle.js"></script></html>');}
 });
 const requests:{range:string|undefined;bytes:number;referer:boolean;cookie:boolean;authorization:boolean}[]=[];let captures=0;
 const uploads=createServer((req,res)=>{
  res.setHeader('Access-Control-Allow-Origin','http://127.0.0.1:3191');res.setHeader('Access-Control-Allow-Methods','GET,PUT,OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type,Content-Range');res.setHeader('Access-Control-Expose-Headers','Range');res.setHeader('Cache-Control','no-store');
  if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
  if(req.url==='/stats'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({requests,captures}));return;}
  if(req.url==='/reset'){requests.length=0;captures=0;res.end();return;}
  if(req.url==='/capture'){captures++;res.end();return;}
  let size=0;req.on('data',c=>{size+=c.length;});req.on('end',()=>{const range=req.headers['content-range'];requests.push({range,bytes:size,referer:!!req.headers.referer,cookie:!!req.headers.cookie,authorization:!!req.headers.authorization});
   if(req.url==='/redirect'){res.writeHead(308,{Location:'http://127.0.0.1:3192/capture',Range:'bytes=0-3'});res.end();return;}
   if(req.url!=='/resume'){res.writeHead(404);res.end();return;}
   if(range?.startsWith('bytes */')){res.writeHead(308,{Range:'bytes=0-3'});res.end();return;}
   const end=Number(/^bytes \d+-(\d+)\//.exec(range??'')?.[1]);if(end===299999){res.writeHead(200);res.end('{}');return;}
   res.writeHead(308,{Range:`bytes=0-${end}`});res.end();
  });
 });
 uploads.listen(3192,'127.0.0.1');
 server.listen(3191,'127.0.0.1');
 for(const signal of ['SIGTERM','SIGINT'] as const)process.on(signal,()=>{uploads.close();server.close(()=>process.exit(0));});
}
main().catch(()=>{console.error('Synthetic harness failed to start');process.exitCode=1;});
