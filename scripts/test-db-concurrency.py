"""Synthetic-only concurrent transactions against the disposable test container."""
import concurrent.futures
import re
import subprocess
import sys
container=sys.argv[1]
identity="set role authenticated; select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);"
def sql(statement):
    return subprocess.run(['docker','exec','-i',container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres'],input=identity+statement,text=True,capture_output=True)
def ids(result):
    return re.findall(r'(?m)^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$',result.stdout)
project_result=sql("select public.create_project_v2('90000000-0000-4000-8000-000000000001','SYNTHETIC concurrency','');")
assert project_result.returncode==0,project_result.stderr
project=ids(project_result)[-1]
create=f"begin;select public.create_paper('{project}','90000000-0000-4000-8000-000000000002','SYNTHETIC concurrent paper','',2026,'','');select pg_sleep(0.2);commit;"
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    results=list(pool.map(sql,[create,create]))
assert all(r.returncode==0 for r in results),[r.stderr for r in results]
papers=[ids(r)[-1] for r in results]
assert papers[0]==papers[1]
print('PASS: two concurrent create requests return the same paper ID')
edit=f"begin;select public.edit_paper('{project}','{papers[0]}',1,'SYNTHETIC concurrent revision','',2026,'');select pg_sleep(0.2);commit;"
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    results=list(pool.map(sql,[edit,edit]))
assert sum(r.returncode==0 for r in results)==1
assert any('KG_CONFLICT' in r.stderr for r in results)
print('PASS: two concurrent stale edits yield exactly one success and one conflict')
