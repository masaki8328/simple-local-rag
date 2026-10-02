"""Synthetic-only concurrent research-case transactions in disposable PostgreSQL."""
import concurrent.futures,json,re,subprocess,sys,uuid
container=sys.argv[1]
def sql(statement):
 return subprocess.run(['docker','exec','-i',container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres'],input="set role authenticated;select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);"+statement,text=True,capture_output=True)
def last_id(r):
 assert r.returncode==0,r.stderr
 return re.findall(r'(?m)^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$',r.stdout)[-1]
def quote(v):return "'"+v.replace("'","''")+"'"
payload=json.loads(subprocess.check_output(['node','--import','tsx','-e',"import {syntheticCase} from './tests/fixtures/research-case.ts';process.stdout.write(JSON.stringify(syntheticCase()));"],text=True))
for c in payload['compounds']:
 old=c['id'];c['id']=str(uuid.uuid4())
 for p in payload['reaction']['participants']:
  if p['compound_id']==old:p['compound_id']=c['id']
for key in ['reaction','experiment','evidence']:payload[key]['id']=str(uuid.uuid4())
project=last_id(sql("select public.create_project_v2(gen_random_uuid(),'SYNTHETIC research concurrency','');"))
paper=last_id(sql(f"select public.create_paper('{project}',gen_random_uuid(),'SYNTHETIC concurrency paper','',2026,'','');"))
case=str(uuid.uuid4());raw=json.dumps(dict(schema_version='research-case/0.1',project_id=project,paper_id=paper,case_id=case,expected_revision=0,analysis_run=dict(id='SYNTHETIC',adapter='dot_manual_json',protocol_version='1'),payload=payload))
batch=last_id(sql(f"select public.stage_research_import('{project}',gen_random_uuid(),{quote(raw)});"))
apply=f"begin;select public.apply_research_import('{project}','{batch}');select pg_sleep(0.2);commit;"
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:r=list(pool.map(sql,[apply,apply]))
assert last_id(r[0])==last_id(r[1])
print('PASS: concurrent research import apply returns one revision')
edit=f"begin;select public.save_research_case('{project}','{paper}','{case}',1,{quote(json.dumps(payload))}::jsonb,'SYNTHETIC concurrent edit');select pg_sleep(0.2);commit;"
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:r=list(pool.map(sql,[edit,edit]))
assert sum(x.returncode==0 for x in r)==1 and any('KG_CONFLICT' in x.stderr for x in r)
print('PASS: concurrent scientific edits produce one immutable successor and one conflict')
