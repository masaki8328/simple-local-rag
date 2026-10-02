// Synthetic-only fixture reuses the reviewed source/evidence setup, not live data.
import {execFileSync} from 'node:child_process';
const setup=execFileSync(process.execPath,['--import','tsx','scripts/project-review-fixture.ts'],{encoding:'utf8'}).split('select public.create_reaction_identity')[0];
console.log(setup+String.raw`
select public.create_research_question(:'project',gen_random_uuid(),'SYNTHETIC bounded question') as question \gset
select gen_random_uuid() as request,gen_random_uuid() as result,gen_random_uuid() as revision \gset
select public.create_research_request(:'project',:'request',:'question',:'paper1',:'case1');
select pg_temp.ok(public.create_research_request(:'project',:'request',:'question',:'paper1',:'case1')=:'request','request retry is idempotent');
select pg_temp.ok((select snapshot#>>'{sources,0,pdf_sha256}'=repeat('1',64) and snapshot#>>'{sources,0,physical_page_start}'='1' and snapshot#>>'{sources,0,passage_hash}' is not null from public.research_requests where id=:'request'),'export pins PDF hash and page/passage');
select jsonb_build_object('schema_version','research-result/0.1','request_id',id,'request_hash',content_hash,'case_import',snapshot->'case_import','conclusion','SYNTHETIC proposed answer','uncertainties',jsonb_build_array('SYNTHETIC uncertain'))::text as raw from public.research_requests where id=:'request' \gset
select public.stage_research_result(:'project',:'result',:'raw') as batch \gset
select pg_temp.ok(public.stage_research_result(:'project',:'result',:'raw')=:'batch','result retry keeps same staged batch');
select pg_temp.ok((select count(*)=0 from public.question_revisions where question_id=:'question'),'AI conclusion does not answer question');
select pg_temp.err(format('select public.apply_research_import(%L,%L)',:'project',:'batch'),'KG_HUMAN_PROTECTED','result cannot overwrite human case');
select pg_temp.err(format('select public.stage_research_result(%L,%L,%L)',:'project',:'result',jsonb_set(:'raw'::jsonb,'{conclusion}','"changed"')::text),'KG_CONFLICT','result ID cannot be reused for different bytes');
select pg_temp.err(format('select public.stage_research_result(%L,gen_random_uuid(),%L)',:'project',jsonb_set(:'raw'::jsonb,'{request_hash}','"bad"')::text),'KG_CONFLICT','tampered request hash rejected');
select pg_temp.err(format('select public.stage_research_result(%L,gen_random_uuid(),%L)',:'project',jsonb_set(:'raw'::jsonb,'{case_import,expected_revision}','2')::text),'KG_CONFLICT','result cannot change expected revision');
select jsonb_build_object('question','SYNTHETIC edited question','importance','SYNTHETIC importance','priority',1,'status','answered','conclusion','SYNTHETIC human answer, scope limited','review_state','human_reviewed','result_id',:'result','evidence_versions',jsonb_build_array(:'version1'),'reason','SYNTHETIC review reason') as answer \gset
select public.revise_research_question(:'project',:'question',:'revision',0,:'answer');
select pg_temp.ok(public.revise_research_question(:'project',:'question',:'revision',0,:'answer')=:'revision','question revision retry is idempotent');
select pg_temp.err(format('select public.revise_research_question(%L,%L,gen_random_uuid(),0,%L)',:'project',:'question',:'answer'),'KG_CONFLICT','stale question revision rejected');
select pg_temp.err(format('select public.revise_research_question(%L,%L,gen_random_uuid(),1,%L)',:'project',:'question',jsonb_set(:'answer'::jsonb,'{review_state}','"unreviewed"')),'KG_INVALID','unreviewed answer rejected');
select pg_temp.err(format('select public.revise_research_question(%L,%L,gen_random_uuid(),1,%L)',:'project',:'question',jsonb_set(:'answer'::jsonb,'{evidence_versions}','[]')),'KG_INVALID','unsupported answered conclusion rejected');

-- New AI-only case exercises apply success, idempotency and stale request protection.
select gen_random_uuid() as ai_case,gen_random_uuid() as ai_request,gen_random_uuid() as ai_result \gset
select replace(payload::text,'80000000','93000000')::jsonb as ai_payload from public.research_case_versions where id=:'version1' \gset
select jsonb_build_object('schema_version','research-case/0.1','project_id',:'project','paper_id',:'paper1','case_id',:'ai_case','expected_revision',0,'analysis_run',jsonb_build_object('id','SYNTHETIC AI initial','adapter','dot_manual_json','protocol_version','0.1'),'payload',:'ai_payload'::jsonb)::text as ai_initial \gset
select public.stage_research_import(:'project',gen_random_uuid(),:'ai_initial') as ai_batch \gset
select public.apply_research_import(:'project',:'ai_batch') as ai_version \gset
select public.create_research_request(:'project',:'ai_request',:'question',:'paper1',:'ai_case');
select jsonb_build_object('schema_version','research-result/0.1','request_id',id,'request_hash',content_hash,'case_import',jsonb_set(snapshot->'case_import','{payload,evidence,strength_rationale}','"SYNTHETIC additional limitations"'),'conclusion','SYNTHETIC AI answer','uncertainties','[]'::jsonb)::text as ai_raw from public.research_requests where id=:'ai_request' \gset
select public.stage_research_result(:'project',:'ai_result',:'ai_raw') as ai_result_batch \gset
select public.apply_research_import(:'project',:'ai_result_batch') as ai_applied \gset
select pg_temp.ok(public.apply_research_import(:'project',:'ai_result_batch')=:'ai_applied','result application retry is idempotent');
select pg_temp.ok((select revision=2 and author_kind='ai' and review_state='ai_generated' from public.research_case_versions where id=:'ai_applied'),'result applied as new unreviewed AI revision');
select public.stage_research_result(:'project',gen_random_uuid(),:'ai_raw') as ai_stale_batch \gset
select pg_temp.err(format('select public.apply_research_import(%L,%L)',:'project',:'ai_stale_batch'),'KG_CONFLICT','old request cannot overwrite newer AI revision');
select public.attest_source_locator(:'project',gen_random_uuid(),:'anchor1',1,'withdrawn','SYNTHETIC withdrawal',true);
select pg_temp.err(format('select public.revise_research_question(%L,%L,gen_random_uuid(),1,%L)',:'project',:'question',:'answer'),'KG_SOURCE','withdrawn source prevents new answered review');
select public.revise_research_question(:'project',:'question',gen_random_uuid(),1,jsonb_set(:'answer'::jsonb,'{status}','"unresolved"'));
select pg_temp.ok((select count(*)=2 from public.question_revisions where question_id=:'question'),'reopening preserves prior conclusion and evidence links');
select pg_temp.err('update public.research_requests set content_hash=''forged''','42501','request direct write denied');
select pg_temp.err('delete from public.question_revisions','42501','question history direct delete denied');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select pg_temp.ok((select count(*)=0 from public.research_requests where id=:'request'),'other owner cannot export request');
select pg_temp.ok((select count(*)=0 from public.research_results where id=:'result'),'other owner cannot read result passages');
select pg_temp.err(format('select public.stage_research_result(%L,gen_random_uuid(),%L)',:'project',:'raw'),'KG_FORBIDDEN','other owner cannot stage result');
select pg_temp.err(format('select public.revise_research_question(%L,%L,gen_random_uuid(),2,%L)',:'project',:'question',:'answer'),'KG_FORBIDDEN','other owner cannot revise question');
reset role;set role anon;
select pg_temp.err('select * from public.research_requests','42501','anonymous request read denied');
select pg_temp.err(format('select public.create_research_request(%L,gen_random_uuid(),%L,%L,%L)',:'project',:'question',:'paper1',:'case1'),'42501','anonymous request RPC denied');
rollback;
`);
