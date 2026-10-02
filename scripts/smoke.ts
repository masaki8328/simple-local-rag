import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {setTimeout} from 'node:timers/promises';
async function main() {
const port=3187;
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{env:{...process.env,NEXT_TELEMETRY_DISABLED:'1',NEXT_PUBLIC_SUPABASE_URL:'',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:''},stdio:'pipe'});
let output='';child.stdout.on('data',c=>output+=c);child.stderr.on('data',c=>output+=c);
try {
 let ready=false;
 for(let i=0;i<100;i++) {
  if(child.exitCode!==null) throw Error(`Server exited: ${output}`);
  try {const r=await fetch(`http://127.0.0.1:${port}`,{signal:AbortSignal.timeout(1000)});if(r.ok){ready=true;break;}}catch{}
  await setTimeout(100);
 }
 assert.ok(ready,'production server became ready');
 const configPage=await fetch(`http://127.0.0.1:${port}/projects`);
 assert.ok((await configPage.text()).includes('設定が必要です'));
 assert.ok(configPage.headers.get('cache-control')?.includes('no-store'));
 console.log('PASS: unconfigured workspace fails closed with private no-store response');
 for(const [path,style] of [['/demo','solid'],['/demo?temperature=120','dashed']]) {
  const r=await fetch(`http://127.0.0.1:${port}${path}`);
  assert.equal(r.status,200);
  const html=await r.text();
  assert.ok(html.includes('Synthetic data'));
  assert.ok(html.includes(`edge ${style}`));
  assert.ok(html.includes('net_conversion'));
  assert.ok(html.includes('coproduct-h2'));
  assert.equal(r.headers.get('x-powered-by'),null);
  console.log(`PASS: production HTTP ${path} renders labelled synthetic ${style} projection with full participants`);
 }
} finally {child.kill('SIGTERM');}

}
main().catch(error=>{console.error(error);process.exitCode=1;});
