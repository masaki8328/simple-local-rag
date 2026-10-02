\set ON_ERROR_STOP on
begin;
create function pg_temp.ok(ok boolean,label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL %',label;end if;raise notice 'PASS: %',label;end$$;
create function pg_temp.err(statement text,expected text,label text) returns void language plpgsql as $$begin begin execute statement;exception when others then if sqlstate=expected or sqlerrm=expected then raise notice 'PASS: %',label;return;end if;raise;end;raise exception 'FAIL no rejection: %',label;end$$;
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select public.create_project_v2(gen_random_uuid(),'SYNTHETIC PDF project','') as project \gset
select public.create_paper(:'project',gen_random_uuid(),'SYNTHETIC PDF paper','',2026,'','') as paper \gset
select gen_random_uuid() as intent \gset
select public.begin_pdf_upload(:'intent',:'project',:'paper','synthetic.pdf',100,repeat('a',64),'edition A','synthetic','test') as created \gset
select pg_temp.ok(public.begin_pdf_upload(:'intent',:'project',:'paper','synthetic.pdf',100,repeat('a',64),'edition A','synthetic','test')=:'intent','intent creation is idempotent');
select pg_temp.err(format('select public.begin_pdf_upload(%L,%L,%L,''different.pdf'',100,repeat(''a'',64),''edition A'',''synthetic'',''test'')',:'intent',:'project',:'paper'),'KG_CONFLICT','intent payload conflict rejected');
select pg_temp.err('insert into public.upload_intents default values','42501','direct intent insertion refused');
select pg_temp.err(format('select kg_private.finalize_pdf(%L,repeat(''a'',64),100,2)',:'intent'),'42501','client cannot certify PDF');
insert into storage.objects(bucket_id,name) values('research-originals',:'project'||'/'||:'intent'||'/original.pdf');
select pg_temp.ok((select count(*)=1 from storage.objects where bucket_id='research-originals'),'authorized exact intent path accepts upload metadata');
select pg_temp.err(format('insert into storage.objects(bucket_id,name) values(''research-originals'',%L)',:'project'||'/wrong/original.pdf'),'42501','arbitrary storage path rejected');
select pg_temp.err(format('insert into storage.objects(bucket_id,name) values(''research-originals'',%L)',:'project'||'/'||:'intent'||'/original.pdf'),'23505','same original path cannot be inserted twice');
update storage.objects set name='overwritten' where bucket_id='research-originals';
delete from storage.objects where bucket_id='research-originals';
select pg_temp.ok((select count(*)=1 from storage.objects where name=:'project'||'/'||:'intent'||'/original.pdf'),'overwrite and deletion affect no research objects');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
select pg_temp.ok((select count(*)=0 from public.upload_intents),'cross-user intents hidden');
select pg_temp.ok((select count(*)=0 from storage.objects where bucket_id='research-originals'),'cross-user storage hidden despite broad policy');
select pg_temp.err(format('select public.mark_pdf_upload(%L,''cancelled'')',:'intent'),'KG_FORBIDDEN','cross-user cancellation rejected');
reset role;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
set role kg_pdf_verifier;
select pg_temp.err(format('select kg_private.finalize_pdf(%L,repeat(''b'',64),100,2)',:'intent'),'KG_MISMATCH','verifier mismatch rejected');
select kg_private.finalize_pdf(:'intent',repeat('a',64),100,2) as finalized \gset
select pg_temp.ok(kg_private.finalize_pdf(:'intent',repeat('a',64),100,2)=:'finalized'::jsonb,'finalize replay returns identical provenance IDs');
select pg_temp.ok((select count(*)=1 from public.document_assets where project_id=:'project'),'one immutable finalized asset');
select pg_temp.ok((select physical_page_count=2 and upload_state='verified' and verifier_version='pdf-lib@1.17.1' from public.document_assets where id=:'intent'),'page count and verifier version retained');
reset role;
set role authenticated;
select gen_random_uuid() as second \gset
select public.begin_pdf_upload(:'second',:'project',:'paper','same.pdf',100,repeat('a',64),'edition B','second source','test');
reset role;
set role kg_pdf_verifier;
select pg_temp.ok((kg_private.finalize_pdf(:'second',repeat('a',64),100,2)->>'assetId')=:'intent','duplicate bytes reuse asset without paper merge');
select pg_temp.ok((select count(*)=1 from public.paper_documents where project_id=:'project'),'same paper and bytes reuse immutable link');
reset role;
set role authenticated;
select gen_random_uuid() as expired \gset
select public.begin_pdf_upload(:'expired',:'project',:'paper','expired.pdf',100,null,'edition','source','test');
reset role;
update public.upload_intents set expires_at=now()-interval '1 second' where id=:'expired';
set role kg_pdf_verifier;
select pg_temp.err(format('select kg_private.finalize_pdf(%L,repeat(''c'',64),100,2)',:'expired'),'KG_EXPIRED','expired finalize rejected');
reset role;
set role authenticated;
select gen_random_uuid() as cancelled \gset
select public.begin_pdf_upload(:'cancelled',:'project',:'paper','cancelled.pdf',100,null,'edition','source','test');
select public.mark_pdf_upload(:'cancelled','cancelled');
select public.mark_pdf_upload(:'cancelled','cancelled');
select pg_temp.err(format('insert into storage.objects(bucket_id,name) values(''research-originals'',%L)',:'project'||'/'||:'cancelled'||'/original.pdf'),'42501','cancelled intent cannot upload');
reset role;
set role kg_pdf_verifier;
select pg_temp.err(format('select kg_private.finalize_pdf(%L,repeat(''c'',64),100,2)',:'cancelled'),'KG_CANCELLED','cancelled finalize rejected');
reset role;
select pg_temp.ok(not exists(select from pg_roles where rolname in ('anon','authenticated','authenticator','service_role') and pg_has_role(oid,'kg_pdf_verifier','MEMBER')),'no app membership in verifier role');
select pg_temp.ok((select not rolcanlogin and not rolbypassrls from pg_roles where rolname='kg_pdf_verifier') and not has_schema_privilege('kg_pdf_verifier','auth','USAGE'),'verifier has no login, bypass or auth usage');
select pg_temp.ok(not exists(select from pg_class where relowner='kg_pdf_verifier'::regrole),'verifier owns no tables');
select pg_temp.ok((select not public from storage.buckets where id='research-originals'),'research bucket private');
select pg_temp.ok((select count(*)=8 from public.audit_events where project_id=:'project' and entity_type='upload_intents'),'intent audit cardinality includes synthetic expiry update, no replay noise');
select pg_temp.ok((select count(*)=0 from public.source_anchors where project_id=:'project'),'no anchors or human verification invented');
set role anon;
select pg_temp.ok((select count(*)=0 from storage.objects where bucket_id='research-originals'),'anonymous reads denied even with broad policy');
reset role;
rollback;
