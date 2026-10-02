\set ON_ERROR_STOP on
begin;
create function pg_temp.ok(ok boolean,label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL %',label;end if;raise notice 'PASS: %',label;end$$;
create function pg_temp.err(statement text,expected text,label text) returns void language plpgsql as $$begin begin execute statement;exception when others then if sqlstate=expected or sqlerrm=expected then raise notice 'PASS: %',label;return;end if;raise;end;raise exception 'FAIL no rejection: %',label;end$$;
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select public.create_project_v2(gen_random_uuid(),'SYNTHETIC research core','') as project \gset
select public.create_paper(:'project',gen_random_uuid(),'SYNTHETIC research paper','',2026,'','') as paper \gset
select gen_random_uuid() as case_id \gset
select public.save_research_case(:'project',:'paper',:'case_id',0,:'payload'::jsonb,'SYNTHETIC draft') as version \gset
select pg_temp.ok((select confirmation='draft' and review_state='unreviewed' from public.research_case_versions where id=:'version'),'missing provenance persists as unconfirmed human draft');
select pg_temp.ok((select count(*)=2 from public.reaction_participants where case_version_id=:'version'),'participants remain separate pinned compound versions');
select pg_temp.ok((select count(*)=1 from public.claims where case_version_id=:'version'),'claim separate from evidence');
select pg_temp.err(format('select public.save_research_case(%L,%L,%L,1,jsonb_set(%L::jsonb,''{evidence,source_anchor_id}'',to_jsonb(gen_random_uuid()::text)),''missing source'')',:'project',:'paper',:'case_id',:'payload'),'KG_SOURCE','missing anchor cannot be claimed as valid provenance');
select pg_temp.err('insert into public.compounds default values','42501','direct scientific writes denied');
select pg_temp.err('update public.research_case_versions set confirmation=''confirmed''','42501','client cannot assert confirmation');
select pg_temp.err(format('select public.save_research_case(%L,%L,%L,0,%L::jsonb,''stale'')',:'project',:'paper',:'case_id',:'payload'),'KG_CONFLICT','stale edit rejected');
select pg_temp.err(format('select public.save_research_case(%L,%L,%L,1,jsonb_set(%L::jsonb,''{claim,scope}'',''"elementary_mechanism"''),''scope bypass'')',:'project',:'paper',:'case_id',:'payload'),'KG_SCOPE','net conversion cannot become elementary mechanism');
select pg_temp.err(format('select public.save_research_case(%L,%L,%L,1,jsonb_set(%L::jsonb,''{evidence,review_state}'',''"human_reviewed"''),''forgery'')',:'project',:'paper',:'case_id',:'payload'),'KG_INVALID','SQL strict schema rejects forged review field');
select pg_temp.err(format('select public.save_research_case(%L,%L,%L,1,jsonb_set(%L::jsonb,''{experiment,conditions,0,upper}'',''120''),''unknown bypass'')',:'project',:'paper',:'case_id',:'payload'),'KG_CONDITIONS','unknown condition cannot gain numeric value');
select public.save_research_case(:'project',:'paper',:'case_id',1,jsonb_set(:'payload'::jsonb,'{evidence,stance}','"refutes"'),'SYNTHETIC correction') as next_version \gset
select pg_temp.ok((select count(*)=2 from public.research_case_versions where case_id=:'case_id'),'old support and new refutation both retained');
select pg_temp.ok((select supersedes_id=:'version' and review_state='human_corrected' from public.research_case_versions where id=:'next_version'),'correction ancestry preserved');
select public.review_research_case(:'project',:'case_id',2,'SYNTHETIC review') as review_version \gset
select pg_temp.ok((select confirmation='draft' and review_state='human_reviewed' from public.research_case_versions where id=:'review_version'),'human review does not confirm missing source');
select jsonb_build_object('schema_version','research-case/0.1','project_id',:'project','paper_id',:'paper','case_id',:'case_id','expected_revision',3,'analysis_run',jsonb_build_object('id','SYNTHETIC run','adapter','dot_manual_json','protocol_version','test/1'),'payload',:'payload'::jsonb)::text as import_json \gset
select gen_random_uuid() as request \gset
select public.stage_research_import(:'project',:'request',:'import_json') as batch \gset
select pg_temp.ok(public.stage_research_import(:'project',:'request',:'import_json')=:'batch','stage idempotency replays same batch');
select pg_temp.err(format('select public.stage_research_import(%L,%L,%L)',:'project',:'request',:'import_json'||' '),'KG_CONFLICT','same import key with different bytes conflicts');
select pg_temp.err(format('select public.apply_research_import(%L,%L)',:'project',:'batch'),'KG_HUMAN_PROTECTED','AI cannot overwrite human correction or review');
select pg_temp.ok((select status='staged' from public.case_import_batches where id=:'batch'),'failed apply retains staged proposal');
select pg_temp.ok((select revision=3 from public.research_cases where id=:'case_id'),'rejected import leaves case and history unchanged');
select public.archive_research_case(:'project',:'case_id',3,true);
select pg_temp.err(format('select public.save_research_case(%L,%L,%L,4,%L::jsonb,''archived'')',:'project',:'paper',:'case_id',:'payload'),'KG_ARCHIVED','archived scientific case rejects edits');
select public.archive_research_case(:'project',:'case_id',4,false);
select gen_random_uuid() as ai_case \gset
select jsonb_set(jsonb_set(jsonb_set(:'import_json'::jsonb,'{case_id}',to_jsonb(:'ai_case'::text)),'{expected_revision}','0'),'{payload}',replace(:'payload','40000000','50000000')::jsonb)::text as ai_json \gset
select public.stage_research_import(:'project',gen_random_uuid(),:'ai_json') as ai_batch \gset
select public.apply_research_import(:'project',:'ai_batch') as ai_version \gset
select pg_temp.ok(public.apply_research_import(:'project',:'ai_batch')=:'ai_version','atomic import apply replays original version');
select pg_temp.ok((select author_kind='ai' and review_state='ai_generated' and confirmation='draft' from public.research_case_versions where id=:'ai_version'),'JSON import never claims human review or confirmation');
select pg_temp.ok((select count(*)=1 from public.research_case_versions where case_id=:'ai_case'),'idempotent apply creates one scientific revision');
select pg_temp.err(format('select public.save_research_case(%L,%L,gen_random_uuid(),0,%L::jsonb,''cross-case identity collision'')',:'project',:'paper',:'payload'),'KG_CONFLICT','stable compound ID cannot be reassigned across cases');
select pg_temp.ok((select count(*)=2 from public.research_cases where project_id=:'project'),'failed aggregate save rolls back newly inserted case');
select pg_temp.ok((select count(*)=4 from public.research_case_versions where project_id=:'project'),'failed aggregate save rolls back scientific history');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
select pg_temp.ok((select count(*)=0 from public.research_cases),'cross-user scientific data hidden');
select pg_temp.err(format('select public.apply_research_import(%L,%L)',:'project',:'batch'),'KG_FORBIDDEN','cross-user apply denied');
reset role;
select id as reaction_version from public.reaction_versions where case_version_id=:'version' \gset
select id as ai_compound_version from public.compound_versions where case_version_id=:'ai_version' limit 1 \gset
select pg_temp.err(format('insert into public.reaction_participants(project_id,case_version_id,reaction_version_id,compound_version_id,position,role,coefficient,primary_for_display) values(%L,%L,%L,%L,99,''product'',null,false)',:'project',:'version',:'reaction_version',:'ai_compound_version'),'23503','participant FK cannot cross case snapshot');
select pg_temp.err(format('insert into public.compound_versions(project_id,case_id,stable_id,case_version_id,version_no,supersedes_id,data) values(%L,%L,''40000000-0000-4000-8000-000000000001'',%L,99,%L,''{}'')',:'project',:'case_id',:'version',:'ai_compound_version'),'23503','version ancestry cannot cross stable compound');
select pg_temp.ok(not exists(select from pg_class where relowner='kg_research_writer'::regrole),'scientific writer owns no tables');
set role kg_research_writer;
select pg_temp.ok((select count(*)=0 from public.research_cases),'writer itself obeys owner tenant RLS');
reset role;
select pg_temp.ok(not has_schema_privilege('kg_research_writer','auth','USAGE') and not has_schema_privilege('kg_research_writer','public','CREATE') and not pg_has_role('postgres','kg_research_writer','SET'),'writer needs no Auth grants and leaves no ownership bridge');
select pg_temp.ok(not pg_has_role('authenticated','kg_research_writer','MEMBER'),'client cannot assume scientific writer');
select pg_temp.err(format('update public.research_case_versions set change_reason=''mutated'' where id=%L',:'version'),'23514','even administrator update hits immutable scientific trigger');
rollback;
