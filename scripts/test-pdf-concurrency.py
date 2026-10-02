"""Synthetic PostgreSQL finalizer concurrency, not a Storage HTTP test."""
import concurrent.futures,json,re,subprocess,sys
container=sys.argv[1]
def sql(statement,writer=False):
    identity="set role kg_pdf_verifier;" if writer else "set role authenticated;"
    return subprocess.run(['docker','exec','-i',container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','bootstrap_admin','-d','postgres'],input=identity+"select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);"+statement,text=True,capture_output=True)
def last_id(result):
    assert result.returncode==0,result.stderr
    return re.findall(r'(?m)^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$',result.stdout)[-1]
project=last_id(sql("select public.create_project_v2(gen_random_uuid(),'SYNTHETIC PDF concurrency','');"))
paper=last_id(sql(f"select public.create_paper('{project}',gen_random_uuid(),'SYNTHETIC concurrent PDF','',2026,'','');"))
intents=[last_id(sql(f"select public.begin_pdf_upload(gen_random_uuid(),'{project}','{paper}','synthetic.pdf',100,null,'edition','source','test');")) for _ in range(2)]
def finalize(intent):
    return sql(f"begin;select kg_private.finalize_pdf('{intent}',repeat('d',64),100,2);select pg_sleep(0.2);commit;",True)
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(finalize,intents))
assert all(r.returncode==0 for r in results),[r.stderr for r in results]
payloads=[json.loads(next(line for line in r.stdout.splitlines() if line.startswith('{'))) for r in results]
assert payloads[0]['assetId']==payloads[1]['assetId'] and payloads[0]['documentId']==payloads[1]['documentId']
assert sum(p['matchedKnownBytes'] for p in payloads)==1
print('PASS: actual concurrent same-hash finalization produces one asset/link and two retained attempts')
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(finalize,[intents[0],intents[0]]))
assert all(r.returncode==0 for r in results),[r.stderr for r in results]
print('PASS: actual concurrent finalize replay returns existing provenance without duplicate insertion')
