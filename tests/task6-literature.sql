\set ON_ERROR_STOP on
begin;
create function pg_temp.ok(ok boolean,label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL %',label;end if;raise notice 'PASS: %',label;end$$;
create function pg_temp.err(statement text,expected text,label text) returns void language plpgsql as $$begin begin execute statement;exception when others then if sqlerrm=expected or sqlstate=expected then raise notice 'PASS: %',label;return;end if;raise;end;raise exception 'FAIL %',label;end$$;
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select public.create_project_v2(gen_random_uuid(),'SYNTHETIC literature','') as project \gset
select public.create_research_question(:'project',gen_random_uuid(),'SYNTHETIC question, no scientific assertion') as question \gset
select gen_random_uuid() as search \gset
select public.record_literature_search(:'project',:'search','SYNTHETIC query',:'question','{"providers":[],"candidates":[{"title":"SYNTHETIC bibliographic paper","authors":"SYNTHETIC Author","journal":"SYNTHETIC Journal","year":2026,"doi":"10.1234/synthetic","semanticId":"SYNTHETIC-s2","url":"https://example.invalid/synthetic","abstract":"SYNTHETIC abstract; not full text","sources":["crossref","semantic_scholar"]}]}');
select gen_random_uuid() as selection \gset
select public.select_literature_candidate(:'project',:'selection',:'search',0,'SYNTHETIC selection reason',1) as selected \gset
select (:'selected'::jsonb->>'paper_id') as paper,(:'selected'::jsonb->>'task_id') as task \gset
select pg_temp.ok((select analysis_status='not_requested' and acquisition_status='missing' and publication_status='unknown' and authors='SYNTHETIC Author' from public.papers where id=:'paper'),'saved bibliography remains unconfirmed and PDF-needed');
select pg_temp.ok((select question_id=:'question' and priority=1 and status='needed' from public.acquisition_tasks where id=:'task'),'candidate selection links RQ and prioritized PDF task');
select pg_temp.ok(public.select_literature_candidate(:'project',:'selection',:'search',0,'SYNTHETIC selection reason',1)=:'selected'::jsonb,'candidate save retries idempotently');
select pg_temp.ok((public.select_literature_candidate(:'project',gen_random_uuid(),:'search',0,'SYNTHETIC second reason',2)->>'paper_id')=:'paper','same DOI/provider identity deduplicates to existing paper');
select pg_temp.ok((select count(*)=1 from public.papers where project_id=:'project'),'deduplicated save creates only one paper');
select pg_temp.ok((select count(*)=2 from public.literature_selections where project_id=:'project'),'selection reasons retained separately');
select public.set_acquisition_task(:'project',:'task',:'paper',:'question',1,2,'requested','SYNTHETIC requested PDF');
select pg_temp.ok((select status='requested' and revision=2 from public.acquisition_tasks where id=:'task'),'queue status updates with optimistic revision');
select pg_temp.err(format('select public.set_acquisition_task(%L,%L,%L,%L,1,1,%L,%L)',:'project',:'task',:'paper',:'question','needed','STALE'),'KG_CONFLICT','stale queue update refused');
select pg_temp.ok((select count(*)>0 from public.audit_events where entity_id=:'task' and action='UPDATE'),'queue changes retain audit history');
select public.edit_paper(:'project',:'paper',2,'SYNTHETIC human correction','SYNTHETIC Journal',2026,'SYNTHETIC human notes');
select public.select_literature_candidate(:'project',gen_random_uuid(),:'search',0,'SYNTHETIC later selection',3);
select pg_temp.ok((select title='SYNTHETIC human correction' and notes='SYNTHETIC human notes' and revision=3 from public.papers where id=:'paper'),'deduplication never overwrites human metadata');
select pg_temp.ok((select status='requested' and revision=2 from public.acquisition_tasks where id=:'task'),'reselection preserves existing acquisition plan');
select pg_temp.err('update public.literature_searches set query=''FORGED''','42501','client cannot rewrite search history');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select pg_temp.ok((select count(*)=0 from public.literature_searches where id=:'search'),'search query history is owner scoped');
select pg_temp.err(format('select public.select_literature_candidate(%L,gen_random_uuid(),%L,0,%L,1)',:'project',:'search','SYNTHETIC'),'KG_FORBIDDEN','other owner cannot select private result');
rollback;
