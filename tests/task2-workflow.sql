\set ON_ERROR_STOP on
begin;
create function pg_temp.assert_true(ok boolean,label text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; raise notice 'PASS: %',label; end $$;
create function pg_temp.expect_error(statement text,expected text,label text) returns void language plpgsql as $$
begin
 begin execute statement; exception when others then
  if sqlerrm=expected or sqlstate=expected then raise notice 'PASS: %',label; return; end if;
  raise exception 'FAIL: % expected %, got %: %',label,expected,sqlstate,sqlerrm;
 end;
 raise exception 'FAIL: % did not reject',label;
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select public.create_project_v2('10000000-0000-4000-8000-000000000001','SYNTHETIC task2','synthetic') as project \gset
select pg_temp.assert_true(public.create_project_v2('10000000-0000-4000-8000-000000000001','SYNTHETIC task2','synthetic')=:'project','project retry replays original ID');
select pg_temp.expect_error('select public.create_project_v2(''10000000-0000-4000-8000-000000000001'',''changed'',''synthetic'')','KG_CONFLICT','project key reuse with different payload rejected');
select pg_temp.expect_error('select public.create_project(''legacy bypass'')','42501','legacy creation RPC disabled');
select public.create_paper(:'project','20000000-0000-4000-8000-000000000001','SYNTHETIC Paper','','2026','',' https://doi.org/10.1234/SYNTHETIC ') as paper \gset
select pg_temp.assert_true(public.create_paper(:'project','20000000-0000-4000-8000-000000000001','SYNTHETIC Paper','','2026','','10.1234/synthetic')=:'paper','paper retry replays original ID');
select pg_temp.assert_true((select count(*)=1 from public.papers),'retry creates one paper');
select pg_temp.assert_true((select count(*)=1 from public.paper_identifiers where paper_id=:'paper' and normalized_value='10.1234/synthetic'),'DOI normalized and saved atomically');
select pg_temp.expect_error(format('select public.create_paper(%L,''20000000-0000-4000-8000-000000000001'',''changed'','''',2026,'''','''')',:'project'),'KG_CONFLICT','paper key reuse with changed content rejected');
select pg_temp.expect_error(format('select public.create_paper(%L,gen_random_uuid(),''SYNTHETIC different title'','''',2026,'''',''10.1234/synthetic'')',:'project'),'KG_DUPLICATE_DOI','duplicate DOI blocked without merge');
select pg_temp.expect_error(format('select public.create_paper(%L,gen_random_uuid(),''  SYNTHETIC   PAPER  '','''',2026,'''','''')',:'project'),'KG_DUPLICATE_TITLE','normalized title duplicate blocked without merge');
select pg_temp.expect_error(format('select public.create_paper(%L,gen_random_uuid(),''  '','''',2026,'''','''')',:'project'),'KG_INVALID','blank title rejected by SQL');
select pg_temp.expect_error(format('select public.create_paper(%L,gen_random_uuid(),''SYNTHETIC other'','''',9999,'''','''')',:'project'),'KG_INVALID','invalid year rejected by SQL');
select pg_temp.expect_error(format('select public.create_paper(%L,gen_random_uuid(),''SYNTHETIC other'','''',2026,'''',''bad DOI'')',:'project'),'KG_INVALID','invalid DOI rejected by SQL');
select public.edit_paper(:'project',:'paper',1,'SYNTHETIC revised','SYNTHETIC journal',2025,'synthetic note');
select pg_temp.expect_error(format('select public.edit_paper(%L,%L,1,''stale'','''',2026,'''')',:'project',:'paper'),'KG_CONFLICT','stale paper edit rejected');
select pg_temp.assert_true((select revision=2 and title='SYNTHETIC revised' from public.papers where id=:'paper'),'successful paper revision retained');
select public.archive_paper(:'project',:'paper',2,true);
select pg_temp.expect_error(format('select public.edit_paper(%L,%L,3,''archived edit'','''',2026,'''')',:'project',:'paper'),'KG_ARCHIVED','archived paper cannot edit');
select public.archive_paper(:'project',:'paper',3,false);
select pg_temp.assert_true((select archived_at is null and revision=4 from public.papers where id=:'paper'),'paper restore retains record');
select public.edit_project(:'project',1,'SYNTHETIC revised project','');
select pg_temp.expect_error(format('select public.edit_project(%L,1,''stale'','''')',:'project'),'KG_CONFLICT','stale project edit rejected');
select public.archive_project(:'project',2,true);
select pg_temp.expect_error(format('select public.create_paper(%L,gen_random_uuid(),''SYNTHETIC archived'','''',2026,'''','''')',:'project'),'KG_ARCHIVED','archived project rejects paper creation');
select public.archive_project(:'project',3,false);
select pg_temp.assert_true((select archived_at is null and revision=4 from public.projects where id=:'project'),'project restore retains record');
select pg_temp.expect_error(format('insert into public.papers(project_id,title,normalized_title,analysis_status) values(%L,''bypass'',''forged'',''analyzed'')',:'project'),'42501','direct paper insert cannot bypass validation');
select pg_temp.expect_error('update public.papers set title=''bypass'',revision=revision+1','42501','direct paper update cannot bypass workflow');
select pg_temp.expect_error('update public.projects set name=''bypass'',revision=revision+1','42501','direct project update cannot bypass workflow');
select pg_temp.expect_error(format('insert into public.paper_identifiers(project_id,paper_id,provider,raw_value,normalized_value,source,retrieved_at) values(%L,%L,''doi'',''bad'',''bad'',''forged'',now())',:'project',:'paper'),'42501','direct identifier insert forbidden');
select pg_temp.expect_error('delete from public.papers','42501','permanent paper delete forbidden');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
select pg_temp.assert_true((select count(*)=0 from public.projects),'cross-user project read hidden by RLS');
select pg_temp.assert_true((select count(*)=0 from public.papers),'cross-user paper read hidden by RLS');
select pg_temp.expect_error(format('select public.edit_paper(%L,%L,4,''forged'','''',2026,'''')',:'project',:'paper'),'KG_FORBIDDEN','cross-project paper edit rejected');
select pg_temp.expect_error(format('select public.archive_project(%L,4,true)',:'project'),'KG_FORBIDDEN','cross-project project archive rejected');
select pg_temp.expect_error(format('select public.create_paper(%L,gen_random_uuid(),''forged'','''',2026,'''','''')',:'project'),'KG_FORBIDDEN','cross-project create rejected');
select public.create_project_v2('10000000-0000-4000-8000-000000000002','SYNTHETIC B','') as other \gset
select pg_temp.expect_error(format('select public.archive_paper(%L,%L,4,true)',:'other',:'paper'),'KG_FORBIDDEN','own project ID with other paper ID rejected');
reset role;
select pg_temp.assert_true((select not rolcanlogin and not rolbypassrls from pg_roles where rolname='kg_metadata_writer'),'workflow role has no login and no RLS bypass');
select pg_temp.assert_true(not pg_has_role('authenticated','kg_metadata_writer','MEMBER'),'authenticated cannot assume workflow role');
select pg_temp.assert_true((select count(*)=5 from pg_proc p join pg_roles r on r.oid=p.proowner where r.rolname='kg_metadata_writer' and p.prosecdef and p.proconfig @> array['search_path=""']),'five RPCs have restricted owner and empty search path');
-- Exercise writer RLS directly as the test admin, with user B JWT still active.
set role kg_metadata_writer;
select pg_temp.assert_true((select count(*)=0 from public.papers),'workflow role itself remains constrained by tenant RLS');
reset role;
set role anon;
select pg_temp.expect_error('select public.create_project_v2(gen_random_uuid(),''forged'','''')','42501','anonymous bootstrap forbidden');
select pg_temp.expect_error(format('select public.archive_project(%L,4,true)',:'project'),'42501','anonymous mutation RPC forbidden');
reset role;
rollback;
