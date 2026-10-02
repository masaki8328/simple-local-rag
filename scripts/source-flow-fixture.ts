import {syntheticCase} from '../tests/fixtures/research-case';
const payload=JSON.stringify(syntheticCase()).replaceAll("'","''");
process.stdout.write(`\\set ON_ERROR_STOP on
begin;
create function pg_temp.ok(ok boolean,label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL %',label;end if;raise notice 'PASS: %',label;end$$;
create function pg_temp.denied(statement text,expected text,label text) returns void language plpgsql as $$begin begin execute statement;exception when others then if sqlerrm=expected or sqlstate=expected then raise notice 'PASS: %',label;return;end if;raise;end;raise exception 'FAIL %',label;end$$;
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select public.create_project_v2(gen_random_uuid(),'SYNTHETIC source graph','') as project \\gset
select public.create_paper(:'project',gen_random_uuid(),'SYNTHETIC source paper','',2026,'','') as paper \\gset
reset role;
set role kg_drive_worker;
select kg_private.bind_drive(gen_random_uuid(),:'project','SYNTHETIC account','SYNTHETIC folder') as binding \\gset
select kg_private.begin_drive(gen_random_uuid(),:'project',:'paper',:'binding','SYNTHETIC source file','{"filename":"SYNTHETIC.pdf","size":9,"edition":"Original","source":"SYNTHETIC","accessBasis":"synthetic fixture"}') as intent \\gset
select kg_private.finish_drive(:'intent','SYNTHETIC-r1',repeat('a',64),9) as receipt \\gset
reset role;
set role authenticated;
select id as document from public.paper_documents where project_id=:'project' and document_receipt_id=:'receipt' \\gset
select gen_random_uuid() as anchor \\gset
select public.create_draft_source_anchor(:'project',:'paper',:'anchor',:'document',2,3,'S2–S3','SYNTHETIC passage only','SYNTHETIC section','SYNTHETIC table',null);
select pg_temp.ok(public.create_draft_source_anchor(:'project',:'paper',:'anchor',:'document',2,3,'S2–S3','SYNTHETIC passage only','SYNTHETIC section','SYNTHETIC table',null)=:'anchor','anchor identical retry retains identity');
select pg_temp.ok((select anchor_verified_at is null and passage_hash=encode(sha256(convert_to(verbatim_passage,'UTF8')),'hex') from public.source_anchors where id=:'anchor'),'draft source passage hashed but never verified');
select pg_temp.denied(format('select public.create_draft_source_anchor(%L,%L,%L,%L,2,3,%L,%L,%L,%L,null)',:'project',:'paper',:'anchor',:'document','S2–S3','CHANGED','SYNTHETIC section','SYNTHETIC table'),'KG_CONFLICT','anchor replay cannot rewrite passage');
select public.create_draft_source_anchor(:'project',:'paper',gen_random_uuid(),:'document',2,3,'S2–S3','SYNTHETIC corrected passage','SYNTHETIC section','SYNTHETIC table',:'anchor') as corrected \\gset
select pg_temp.ok((select supersedes_anchor_id=:'anchor' from public.source_anchors where id=:'corrected'),'correction appends and links old anchor');
select gen_random_uuid() as case_id \\gset
select public.stage_research_import(:'project',gen_random_uuid(),jsonb_build_object('schema_version','research-case/0.1','project_id',:'project','paper_id',:'paper','case_id',:'case_id','expected_revision',0,'analysis_run',jsonb_build_object('id','SYNTHETIC run','adapter','dot_manual_json','protocol_version','SYNTHETIC'),'payload',jsonb_set('${payload}'::jsonb,'{evidence,source_anchor_id}',to_jsonb(:'anchor'::text)))::text) as batch \\gset
select public.apply_research_import(:'project',:'batch') as version \\gset
select pg_temp.ok((select source_anchor_id=:'anchor' and confirmation='draft' and review_state='ai_generated' from public.research_case_versions where id=:'version'),'structured import links exact source but remains AI draft');
select pg_temp.ok(public.apply_research_import(:'project',:'batch')=:'version','source-linked import replays original revision');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select pg_temp.denied(format('select public.create_draft_source_anchor(%L,%L,gen_random_uuid(),%L,1,1,%L,%L,%L,%L,null)',:'project',:'paper',:'document','','SYNTHETIC','',''),'KG_FORBIDDEN','other owner cannot create source anchor');
select pg_temp.ok((select count(*)=0 from public.source_anchors where id=:'anchor'),'other owner cannot read private passage');
rollback;
`);
