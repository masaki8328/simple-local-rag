\set ON_ERROR_STOP on
begin;
create function pg_temp.ok(ok boolean,label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL %',label;end if;raise notice 'PASS: %',label;end$$;
create function pg_temp.err(statement text,expected text,label text) returns void language plpgsql as $$begin begin execute statement;exception when others then if sqlstate=expected or sqlerrm=expected then raise notice 'PASS: %',label;return;end if;raise;end;raise exception 'FAIL no rejection: %',label;end$$;
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select public.create_project_v2(gen_random_uuid(),'SYNTHETIC Drive','') as project \gset
select public.create_paper(:'project',gen_random_uuid(),'SYNTHETIC Drive paper','',2026,'','') as paper \gset
select pg_temp.err('select kg_private.finish_drive(gen_random_uuid(),''r'',repeat(''a'',64),8)','42501','client cannot finalize receipt');
select pg_temp.err('insert into public.document_receipts default values','42501','client has no receipt DML');
reset role;
set role kg_drive_worker;
select kg_private.bind_drive(gen_random_uuid(),:'project','SYNTHETIC account','SYNTHETIC folder') as binding \gset
select kg_private.begin_drive(gen_random_uuid(),:'project',:'paper',:'binding','SYNTHETIC file','{"filename":"synthetic.pdf","size":8,"edition":"Original","source":"SYNTHETIC","accessBasis":"synthetic fixture"}') as intent \gset
select pg_temp.err('select * from public.document_receipts','42501','worker cannot read receipt tables');
reset role;
set session authorization kg_drive_worker;
select pg_temp.err('set role kg_drive_owner','42501','worker cannot assume function owner');
reset session authorization;
set role kg_drive_worker;
select kg_private.drive_event(:'intent','retryable');
select kg_private.finish_drive(:'intent','revision-1',repeat('a',64),8) as receipt \gset
select pg_temp.ok(kg_private.finish_drive(:'intent','revision-1',repeat('a',64),8)=:'receipt','finalizer replay returns original receipt');
select pg_temp.err(format('select kg_private.finish_drive(%L,''new-revision'',repeat(''a'',64),8)',:'intent'),'KG_CONFLICT','new bytes/revision cannot replace receipt');
select pg_temp.err(format('select kg_private.drive_event(%L,''cancelled'')',:'intent'),'KG_CONFLICT','completed receipt cannot be cancelled');
select kg_private.drive_event(:'intent','unavailable');
reset role;
set role authenticated;
select pg_temp.ok((select state='stored_unparsed' from public.document_receipts where id=:'receipt'),'receipt stays unparsed after source disappears');
select pg_temp.ok((select document_asset_id is null and document_receipt_id=:'receipt' from public.paper_documents where paper_id=:'paper'),'neutral link uses receipt without legacy bucket asset');
select pg_temp.ok((select count(*)=3 from public.document_provider_events where intent_id=:'intent'),'retry and unavailability retained append-only');
select pg_temp.ok((select count(*)=0 from public.source_anchors a join public.paper_documents d on d.id=a.paper_document_id where d.paper_id=:'paper'),'receipt does not fabricate source anchor');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select pg_temp.ok((select count(*)=0 from public.document_receipts where id=:'receipt'),'other tenant cannot read receipt');
reset role;
set role kg_drive_worker;
select pg_temp.err(format('select kg_private.finish_drive(%L,''revision-1'',repeat(''a'',64),8)',:'intent'),'KG_FORBIDDEN','worker caller remains owner scoped');
reset role;
select pg_temp.err(format('update public.document_receipts set sha256=repeat(''b'',64) where id=%L',:'receipt'),'23514','receipt immutable even for administrator');
select pg_temp.ok(not pg_has_role('kg_drive_worker','kg_drive_owner','MEMBER') and not has_table_privilege('kg_drive_worker','public.document_receipts','INSERT') and not has_table_privilege('kg_drive_worker','public.document_receipts','SELECT'),'worker execute-only boundary');
select pg_temp.ok(not exists(select 1 from pg_class where relowner='kg_drive_owner'::regrole),'finalizer owns no tables');
select pg_temp.ok(not has_schema_privilege('kg_drive_owner','auth','USAGE') and not pg_has_role('postgres','kg_drive_owner','SET'),'no Auth grant or lingering owner SET bridge');
rollback;
