\set ON_ERROR_STOP on
begin;
create function pg_temp.ok(ok boolean,label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL %',label;end if;raise notice 'PASS: %',label;end$$;
create function pg_temp.err(statement text,expected text,label text) returns void language plpgsql as $$begin begin execute statement;exception when others then if sqlerrm=expected or sqlstate=expected then raise notice 'PASS: %',label;return;end if;raise;end;raise exception 'FAIL %',label;end$$;
select pg_temp.ok(not pg_has_role('postgres','kg_literature_writer','SET'),'migration writer SET bridge closed');
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select public.create_project_v2(gen_random_uuid(),'SYNTHETIC expansion','') as project \gset
select public.create_paper(:'project',gen_random_uuid(),'SYNTHETIC seed','',null,'','') as seed \gset
select gen_random_uuid() as search,gen_random_uuid() as repeated,gen_random_uuid() as rejection,gen_random_uuid() as reopened \gset
\set payload '{"providers":[],"candidates":[{"title":"SYNTHETIC child","authors":"SYNTHETIC Provider","journal":"","year":null,"doi":"10.1234/child","semanticId":"SYNTHETIC-child","url":"https://example.invalid/child","abstract":"SYNTHETIC abstract, not fulltext","sources":["semantic_scholar"]}]}'
select public.record_literature_expansion(:'project',:'search',:'seed','references',null,null,:'payload');
select public.decide_literature_candidate(:'project',:'rejection',:'search',0,null,'rejected','SYNTHETIC outside scope');
select pg_temp.ok(public.decide_literature_candidate(:'project',:'rejection',:'search',0,null,'rejected','SYNTHETIC outside scope')=:'rejection','decision retries idempotently');
select public.record_literature_expansion(:'project',:'repeated',:'seed','references',null,null,replace(:'payload','10.1234/child','10.1234/CHILD')::jsonb);
select pg_temp.err(format('select public.select_literature_candidate(%L,gen_random_uuid(),%L,0,%L,1)',:'project',:'repeated','SYNTHETIC adoption'),'KG_REJECTED','repeated search cannot bypass rejection');
select pg_temp.err(format('select public.decide_literature_candidate(%L,gen_random_uuid(),%L,0,null,%L,%L)',:'project',:'repeated','reopened','SYNTHETIC stale'),'KG_CONFLICT','stale reconsideration refused');
select pg_temp.err(format('select public.decide_literature_candidate(%L,gen_random_uuid(),%L,0,%L,%L,%L)',:'project',:'repeated',:'rejection','reopened',''),'KG_INVALID','reconsideration needs reason');
select public.decide_literature_candidate(:'project',:'reopened',:'repeated',0,:'rejection','reopened','SYNTHETIC changed scope');
select (public.select_literature_candidate(:'project',gen_random_uuid(),:'repeated',0,'SYNTHETIC adoption',1)->>'paper_id') as child \gset
select pg_temp.ok((select source_paper_id=:'seed' and target_paper_id=:'child' and relation='cites' and providers='["semantic_scholar"]'::jsonb from public.paper_relations where search_id=:'repeated'),'reference direction and provider provenance saved');
select pg_temp.ok((select count(*)=2 from public.candidate_decisions where project_id=:'project'),'all rejection and reopening reasons retained');
select revision as revision from public.papers where id=:'child' \gset
select public.edit_paper_details(:'project',:'child',:'revision','SYNTHETIC Human Author','SYNTHETIC corrected abstract','https://example.invalid/human','SYNTHETIC human relevance');
select pg_temp.err(format('select public.edit_paper_details(%L,%L,%s,%L,%L,%L,%L)',:'project',:'child',:'revision','','','',''),'KG_CONFLICT','stale metadata cannot overwrite human edit');
select public.select_literature_candidate(:'project',gen_random_uuid(),:'repeated',0,'SYNTHETIC repeated adoption',2);
select pg_temp.ok((select authors='SYNTHETIC Human Author' and abstract='SYNTHETIC corrected abstract' and canonical_url='https://example.invalid/human' and relevance='SYNTHETIC human relevance' and analysis_status='not_requested' and acquisition_status='missing' from public.papers where id=:'child'),'reselection preserves human fields and no fulltext/analysis promotion');
select pg_temp.ok((select count(*)>0 from public.audit_events where entity_id=:'child' and action='UPDATE'),'metadata revisions audited');
select gen_random_uuid() as citations,gen_random_uuid() as related,gen_random_uuid() as childsearch \gset
select public.record_literature_expansion(:'project',:'citations',:'seed','citations',null,null,:'payload');
select public.select_literature_candidate(:'project',gen_random_uuid(),:'citations',0,'SYNTHETIC citation adoption',1);
select pg_temp.ok((select source_paper_id=:'child' and target_paper_id=:'seed' and relation='cites' from public.paper_relations where search_id=:'citations'),'citing-paper direction is reversed');
select public.record_literature_expansion(:'project',:'related',:'seed','related',null,null,:'payload');
select public.select_literature_candidate(:'project',gen_random_uuid(),:'related',0,'SYNTHETIC related adoption',1);
select pg_temp.ok((select relation='related_to' from public.paper_relations where search_id=:'related'),'recommendation does not assert citation');
select public.record_literature_expansion(:'project',:'childsearch',:'child','references',:'repeated',null,'{"providers":[],"candidates":[]}');
select pg_temp.ok((select depth=2 from public.literature_expansions where search_id=:'childsearch'),'explicit selected-paper followup depth two');
select pg_temp.err(format('select public.record_literature_expansion(%L,gen_random_uuid(),%L,%L,%L,null,%L)',:'project',:'child','references',:'childsearch',:'payload'),'KG_INVALID','depth three rejected');
select pg_temp.err(format('select public.record_literature_expansion(%L,gen_random_uuid(),%L,%L,%L,null,%L)',:'project',:'seed','references',:'repeated',:'payload'),'KG_INVALID','unselected followup seed rejected');
select pg_temp.err('update public.candidate_decisions set reason=''FORGED''','42501','direct decision edits denied');
select pg_temp.err('delete from public.paper_relations','42501','direct relation deletion denied');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select pg_temp.ok((select count(*)=0 from public.candidate_decisions where project_id=:'project'),'other owner sees no decisions');
select pg_temp.ok((select count(*)=0 from public.paper_relations where project_id=:'project'),'other owner sees no relations');
select pg_temp.err(format('select public.record_literature_expansion(%L,gen_random_uuid(),%L,%L,null,null,%L)',:'project',:'seed','references',:'payload'),'KG_FORBIDDEN','cross-owner expansion denied');
select pg_temp.err(format('select public.decide_literature_candidate(%L,gen_random_uuid(),%L,0,null,%L,%L)',:'project',:'search','rejected','SYNTHETIC forged'),'KG_FORBIDDEN','cross-owner decision denied');
select pg_temp.err(format('select public.edit_paper_details(%L,%L,3,%L,%L,%L,%L)',:'project',:'child','','','',''),'KG_FORBIDDEN','cross-owner metadata edit denied');
select pg_temp.err(format('select public.record_literature_expansion(%L,gen_random_uuid(),%L,%L,null,null,%L)',:'project',:'seed','references',jsonb_build_object('providers',jsonb_build_array(jsonb_build_object('items',(select jsonb_agg('{}'::jsonb) from generate_series(1,11)))),'candidates','[]'::jsonb)::text),'KG_FORBIDDEN','caps cannot bypass ownership');
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select pg_temp.err(format('select public.record_literature_expansion(%L,gen_random_uuid(),%L,%L,null,null,%L)',:'project',:'seed','references',jsonb_build_object('providers',jsonb_build_array(jsonb_build_object('items',(select jsonb_agg('{}'::jsonb) from generate_series(1,11)))),'candidates','[]'::jsonb)::text),'KG_INVALID','provider result cap enforced in RPC');
set role anon;
select pg_temp.err(format('select public.record_literature_expansion(%L,gen_random_uuid(),%L,%L,null,null,%L)',:'project',:'seed','references',:'payload'),'42501','anonymous RPC denied');
rollback;
