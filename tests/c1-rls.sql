\set ON_ERROR_STOP on
begin;
create function pg_temp.assert_true(ok boolean, label text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; raise notice 'PASS: %',label; end $$;
create function pg_temp.expect_error(statement text, expected text, label text) returns void language plpgsql as $$
begin
 begin execute statement; exception when others then
  if sqlstate=expected then raise notice 'PASS: %',label; return; end if;
  raise exception 'FAIL: % expected %, got %: %',label,expected,sqlstate,sqlerrm;
 end;
 raise exception 'FAIL: % did not reject',label;
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select public.create_project('SYNTHETIC Project A') as pa \gset
insert into public.papers(id,project_id,title,normalized_title) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',:'pa','SYNTHETIC Paper A','synthetic paper a');
insert into public.document_assets(id,project_id,storage_bucket,storage_path,sha256,byte_size,mime,original_filename) values('dddddddd-dddd-4ddd-8ddd-dddddddddddd',:'pa','research-originals',:'pa'||'/dddddddd-dddd-4ddd-8ddd-dddddddddddd/original.pdf',repeat('a',64),123,'application/pdf','SYNTHETIC-NO-FILE.pdf');
insert into public.paper_documents(id,project_id,paper_id,document_asset_id,role,edition_label,acquired_at,acquired_from,access_basis) values('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',:'pa','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','dddddddd-dddd-4ddd-8ddd-dddddddddddd','main_text','SYNTHETIC v1',now(),'synthetic fixture','synthetic');
insert into public.source_anchors(id,project_id,paper_document_id,physical_page_start,physical_page_end,verbatim_passage,passage_hash) values('ffffffff-ffff-4fff-8fff-ffffffffffff',:'pa','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',1,1,'SYNTHETIC passage',encode(sha256(convert_to('SYNTHETIC passage','UTF8')),'hex'));
select pg_temp.assert_true((select count(*)=1 from public.source_anchors),'owner can traverse paper/document/anchor');
insert into public.document_assets(id,project_id,storage_bucket,storage_path,sha256,byte_size,mime,original_filename) values('cccccccc-cccc-4ccc-8ccc-cccccccccccc',:'pa','research-originals',:'pa'||'/cccccccc-cccc-4ccc-8ccc-cccccccccccc/original.pdf',repeat('c',64),124,'application/pdf','SYNTHETIC-V2-NO-FILE.pdf');
insert into public.paper_documents(id,project_id,paper_id,document_asset_id,role,edition_label,acquired_at,acquired_from,access_basis) values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',:'pa','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cccccccc-cccc-4ccc-8ccc-cccccccccccc','main_text','SYNTHETIC v2',now(),'synthetic fixture','synthetic');
select pg_temp.assert_true((select a.sha256=repeat('a',64) from public.source_anchors s join public.paper_documents d on (d.project_id,d.id)=(s.project_id,s.paper_document_id) join public.document_assets a on (a.project_id,a.id)=(d.project_id,d.document_asset_id) where s.id='ffffffff-ffff-4fff-8fff-ffffffffffff'),'new PDF edition preserves old anchor hash');
select pg_temp.expect_error(format('insert into public.source_anchors(project_id,paper_document_id,physical_page_start,physical_page_end,verbatim_passage,passage_hash) values(%L,''eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'',1,1,''synthetic'',repeat(''b'',64))',:'pa'),'23514','passage hash must match exact UTF8 text');

select pg_temp.assert_true((select count(*)=1 from public.project_members where role='owner'),'atomic owner membership bootstrap');
select pg_temp.expect_error(format('insert into public.project_members(project_id,user_id,role) values(%L,%L,''owner'')',:'pa','22222222-2222-4222-8222-222222222222'),'42501','direct membership elevation denied');
select pg_temp.expect_error('insert into public.projects(name,owner_user_id) values(''forged'',''22222222-2222-4222-8222-222222222222'')','42501','direct project creation denied');
select pg_temp.expect_error(format('update public.projects set owner_user_id=''22222222-2222-4222-8222-222222222222'' where id=%L',:'pa'),'23514','owner transfer denied');
select pg_temp.expect_error('update public.papers set title=''lost update''','23514','revision must advance');
update public.papers set title='SYNTHETIC revised', revision=2 where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and revision=1;
select pg_temp.assert_true((select count(*)=1 from public.audit_events where action='UPDATE' and old_data->>'title'='SYNTHETIC Paper A'),'paper history audited');
select pg_temp.expect_error('delete from public.audit_events','42501','audit is append only');
select pg_temp.expect_error('update public.document_assets set sha256=repeat(''c'',64)','42501','client cannot replace PDF hash');
select pg_temp.expect_error('update public.source_anchors set physical_page_start=2','42501','client cannot rewrite anchor');
select pg_temp.expect_error('delete from public.source_anchors','42501','client cannot delete source anchor');
select pg_temp.expect_error('update public.paper_documents set document_asset_id=''cccccccc-cccc-4ccc-8ccc-cccccccccccc'' where id=''eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee''','42501','client cannot replace linked PDF');
select pg_temp.expect_error('delete from public.document_assets','42501','client cannot delete PDF asset');
select pg_temp.expect_error('update public.document_assets set storage_path=''substituted.pdf''','42501','client cannot mutate linked PDF object path');
select pg_temp.expect_error(format('insert into public.document_assets(project_id,storage_bucket,storage_path,sha256,byte_size,mime,original_filename) values(%L,''research-originals'',''other-project/file'',repeat(''a'',64),1,''application/pdf'',''synthetic'')',:'pa'),'23514','storage path substitution denied');
select pg_temp.expect_error(format('insert into public.source_anchors(project_id,paper_document_id,physical_page_start,physical_page_end,verbatim_passage,passage_hash,anchor_verified_at) values(%L,''eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'',1,1,''synthetic'',encode(sha256(convert_to(''synthetic'',''UTF8'')),''hex''),now())',:'pa'),'42501','client cannot forge anchor verification');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
select public.create_project('SYNTHETIC Project B') as pb \gset
select pg_temp.expect_error(format('insert into public.project_members(project_id,user_id,role) values(%L,''22222222-2222-4222-8222-222222222222'',''owner'')',:'pa'),'42501','user B cannot self-join project A');
select pg_temp.expect_error('update public.project_members set role=''owner''','42501','members cannot self-promote');
with changed as (update public.projects set owner_user_id='22222222-2222-4222-8222-222222222222' where id=:'pa' returning id) select pg_temp.assert_true((select count(*)=0 from changed),'user B cannot take over project A');
select pg_temp.assert_true(not kg_private.has_role(:'pa',array['owner','editor','reviewer','viewer']),'membership helper is bound to caller identity');
select pg_temp.assert_true((select count(*)=0 from public.papers),'other tenant cannot read papers');
select pg_temp.assert_true((select count(*)=0 from public.document_assets),'other tenant cannot read PDF metadata');
select pg_temp.assert_true((select count(*)=0 from public.source_anchors),'other tenant cannot read passages');
select pg_temp.expect_error(format('insert into public.papers(project_id,title,normalized_title) values(%L,''forged'',''forged'')',:'pa'),'42501','cross-tenant insertion denied by RLS');
select pg_temp.expect_error(format('insert into public.paper_identifiers(project_id,paper_id,provider,raw_value,normalized_value,source,retrieved_at) values(%L,''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'',''synthetic'',''x'',''x'',''synthetic'',now())',:'pb'),'23503','cross-tenant FK denied');
select pg_temp.expect_error(format('insert into public.paper_documents(project_id,paper_id,document_asset_id,role,edition_label,acquired_at,acquired_from,access_basis) values(%L,''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'',''dddddddd-dddd-4ddd-8ddd-dddddddddddd'',''main_text'',''fake'',now(),''synthetic'',''synthetic'')',:'pb'),'23503','cross-tenant document link denied');
select pg_temp.expect_error(format('insert into public.source_anchors(project_id,paper_document_id,physical_page_start,physical_page_end,verbatim_passage,passage_hash) values(%L,''eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'',1,1,''synthetic'',encode(sha256(convert_to(''synthetic'',''UTF8'')),''hex''))',:'pb'),'23503','cross-tenant anchor FK denied');
reset role;
insert into public.project_members(project_id,user_id,role,created_by) values(:'pa','33333333-3333-4333-8333-333333333333','viewer','11111111-1111-4111-8111-111111111111');
select pg_temp.expect_error('update public.document_assets set sha256=repeat(''c'',64)','23514','immutable provenance trigger also protects privileged updates');
select pg_temp.expect_error('delete from public.source_anchors','23514','immutable anchor trigger protects privileged deletes');
select pg_temp.expect_error('update public.source_anchors set verbatim_passage=''rewrite''','23514','immutable anchor trigger protects privileged updates');
select pg_temp.expect_error('update public.paper_documents set document_asset_id=''cccccccc-cccc-4ccc-8ccc-cccccccccccc'' where id=''eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee''','23514','linked PDF cannot be retargeted even by privileged update');
select pg_temp.expect_error('delete from public.document_assets','23514','immutable asset trigger rejects privileged deletes');
select pg_temp.assert_true((select bool_and(proconfig @> array['search_path=""']) from pg_proc where oid in ('kg_private.has_role(uuid,text[])'::regprocedure,'public.create_project(text)'::regprocedure,'kg_private.capture_audit()'::regprocedure)),'SECURITY DEFINER search paths are fixed empty');
select pg_temp.assert_true(not has_table_privilege('authenticated','public.project_members','INSERT') and not has_table_privilege('authenticated','public.project_members','UPDATE'),'membership mutation grants absent');
select pg_temp.assert_true(not has_function_privilege('anon','public.create_project(text)','EXECUTE') and not has_function_privilege('anon','kg_private.has_role(uuid,text[])','EXECUTE'),'anonymous helper and bootstrap execution denied');
select pg_temp.assert_true(not has_function_privilege('authenticated','kg_private.capture_audit()','EXECUTE') and not has_function_privilege('authenticated','kg_private.guard_update()','EXECUTE') and not has_function_privilege('anon','kg_private.reject_mutation()','EXECUTE'),'trigger function direct execute grants removed despite inherited defaults');
select pg_temp.expect_error(format('delete from public.projects where id=%L',:'pa'),'23503','project cannot cascade-delete scientific history');
select pg_temp.assert_true((select count(*)=8 from pg_tables where schemaname='public' and rowsecurity),'all eight C1 tables have RLS');
set role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
select pg_temp.assert_true((select count(*)=1 from public.papers),'viewer can read member project');
select pg_temp.expect_error(format('insert into public.papers(project_id,title,normalized_title) values(%L,''forged'',''forged'')',:'pa'),'42501','viewer cannot insert');
with changed as (update public.papers set title='forged',revision=3 returning id) select pg_temp.assert_true((select count(*)=0 from changed),'viewer update sees no writable rows');
reset role;
set role anon;
select pg_temp.expect_error('select * from public.papers','42501','anon cannot read');
select pg_temp.expect_error('select public.create_project(''forged'')','42501','anon cannot call bootstrap');
reset role;
rollback;
