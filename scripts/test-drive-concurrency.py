"""Synthetic-only concurrent receipt finalization in disposable PostgreSQL."""
import concurrent.futures,re,subprocess,sys
container=sys.argv[1]
def sql(s,role='kg_drive_worker'):
 return subprocess.run(['docker','exec','-i',container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','bootstrap_admin','-d','postgres'],input=f"set role {role};select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);"+s,text=True,capture_output=True)
def ident(r):
 assert r.returncode==0,r.stderr
 return re.findall(r'(?m)^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$',r.stdout)[-1]
p=ident(sql("select public.create_project_v2(gen_random_uuid(),'SYNTHETIC Drive concurrency','');",'authenticated'))
paper=ident(sql(f"select public.create_paper('{p}',gen_random_uuid(),'SYNTHETIC paper','',2026,'','');",'authenticated'))
b=ident(sql(f"select kg_private.bind_drive(gen_random_uuid(),'{p}','SYNTHETIC account','SYNTHETIC folder');"))
i=ident(sql(f'''select kg_private.begin_drive(gen_random_uuid(),'{p}','{paper}','{b}','SYNTHETIC concurrent file','{{"filename":"synthetic.pdf","size":8,"edition":"Original","source":"SYNTHETIC","accessBasis":"synthetic"}}');'''))
s=f"begin;select kg_private.finish_drive('{i}','r1',repeat('a',64),8);select pg_sleep(0.2);commit;"
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool: results=list(pool.map(sql,[s,s]))
assert ident(results[0])==ident(results[1])
print('PASS: concurrent Drive finalizers return one immutable receipt and link')
