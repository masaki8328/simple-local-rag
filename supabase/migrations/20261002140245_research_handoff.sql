begin;
-- Append-only RQ revisions and bounded research handoffs; no additional login role.
create table public.question_revisions(id uuid primary key,project_id uuid not null,question_id uuid not null,revision integer not null check(revision>0),data jsonb not null,created_by uuid not null,created_at timestamptz not null default now(),unique(project_id,id),unique(project_id,question_id,revision),foreign key(project_id,question_id) references public.research_questions(project_id,id));
create table public.research_requests(id uuid primary key,project_id uuid not null,question_id uuid not null,paper_id uuid not null,case_id uuid not null,snapshot jsonb not null,content_hash text not null,created_by uuid not null,created_at timestamptz not null default now(),unique(project_id,id),foreign key(project_id,question_id) references public.research_questions(project_id,id),foreign key(project_id,paper_id) references public.papers(project_id,id),foreign key(project_id,case_id) references public.research_cases(project_id,id),check(content_hash=encode(sha256(convert_to(snapshot::text,'UTF8')),'hex')));
create table public.research_results(id uuid primary key,project_id uuid not null,request_id uuid not null,batch_id uuid not null,raw_content text not null,content_hash text not null,created_by uuid not null,created_at timestamptz not null default now(),unique(project_id,id),foreign key(project_id,request_id) references public.research_requests(project_id,id),foreign key(project_id,batch_id) references public.case_import_batches(project_id,id),check(content_hash=encode(sha256(convert_to(raw_content,'UTF8')),'hex')));
do $$declare t text;begin foreach t in array array['document_receipts','source_attestations','scientific_evidence_reviews'] loop
 execute format('grant select on public.%I to kg_research_writer',t);
 execute format('create policy handoff_read on public.%I for select to kg_research_writer using(kg_private.has_role(project_id,array[''owner'']))',t);
 end loop;end$$;
grant select on public.research_questions to kg_research_writer;
create policy handoff_read on public.research_questions for select to kg_research_writer using(kg_private.has_role(project_id,array['owner']));
do $$declare t text;begin foreach t in array array['question_revisions','research_requests','research_results'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
 execute format('grant select on public.%I to authenticated,kg_research_writer',t);
 execute format('grant insert on public.%I to kg_research_writer',t);
 execute format('create policy owner_read on public.%I for select to authenticated,kg_research_writer using(kg_private.has_role(project_id,array[''owner'']))',t);
 execute format('create policy owner_insert on public.%I for insert to kg_research_writer with check(created_by=kg_private.caller_uid() and kg_private.has_role(project_id,array[''owner'']))',t);
 execute format('create trigger immutable_record before update or delete on public.%I for each row execute function kg_private.reject_mutation()',t);
 execute format('create trigger audit_change after insert on public.%I for each row execute function kg_private.capture_audit()',t);
 end loop;end$$;
create function public.revise_research_question(p_project uuid,p_question uuid,p_id uuid,p_expected integer,p_data jsonb) returns uuid language plpgsql security definer set search_path='' as $$declare old public.question_revisions;latest integer;v uuid;begin
 perform kg_private.require_owner(p_project,true);perform pg_advisory_xact_lock(hashtextextended(p_project::text,0));
 if p_data is null or octet_length(p_data::text)>65536 or not p_data ?& array['question','importance','priority','status','conclusion','review_state','evidence_versions','reason','result_id'] or exists(select from jsonb_object_keys(p_data) k where k not in ('question','importance','priority','status','conclusion','review_state','evidence_versions','reason','result_id')) or exists(select from jsonb_each(p_data) x where x.key not in ('priority','evidence_versions','result_id') and jsonb_typeof(x.value)<>'string') or length(btrim(p_data->>'question')) not between 1 and 2000 or length(p_data->>'importance')>4000 or length(p_data->>'conclusion')>8000 or length(btrim(p_data->>'reason')) not between 1 and 2000 or (p_data->'priority') not in ('1'::jsonb,'2'::jsonb,'3'::jsonb,'4'::jsonb) or p_data->>'status' not in ('open','searching','waiting_for_pdf','analyzing','answered','unresolved','rejected','low_priority') or p_data->>'review_state' not in ('unreviewed','human_reviewed','human_corrected') or jsonb_typeof(p_data->'evidence_versions') is distinct from 'array' or jsonb_array_length(p_data->'evidence_versions')>20 then raise exception 'KG_INVALID';end if;
 if (select count(distinct value) from jsonb_array_elements_text(p_data->'evidence_versions'))<>jsonb_array_length(p_data->'evidence_versions') then raise exception 'KG_INVALID';end if;
 if p_data->>'status'='answered' and (length(btrim(p_data->>'conclusion'))=0 or p_data->>'review_state'='unreviewed' or jsonb_array_length(p_data->'evidence_versions')=0) then raise exception 'KG_INVALID';end if;
 if p_data->>'result_id' is not null and not exists(select from public.research_results rr join public.research_requests rq on rq.project_id=rr.project_id and rq.id=rr.request_id where rr.project_id=p_project and rr.id=(p_data->>'result_id')::uuid and rq.question_id=p_question) then raise exception 'KG_FORBIDDEN';end if;
 select * into old from public.question_revisions where id=p_id;
 if found then if old.project_id<>p_project or old.question_id<>p_question or old.revision<>p_expected+1 or old.data<>p_data then raise exception 'KG_CONFLICT';end if;return old.id;end if;
 if not exists(select from public.research_questions where project_id=p_project and id=p_question) then raise exception 'KG_FORBIDDEN';end if;
 select coalesce(max(revision),0) into latest from public.question_revisions where project_id=p_project and question_id=p_question;
 if p_expected is null or latest<>p_expected then raise exception 'KG_CONFLICT';end if;
 for v in select value::uuid from jsonb_array_elements_text(p_data->'evidence_versions') loop
 if not exists(select from public.research_case_versions cv join public.research_cases c on c.project_id=cv.project_id and c.id=cv.case_id join public.papers paper on paper.project_id=c.project_id and paper.id=c.paper_id where paper.archived_at is null and cv.project_id=p_project and cv.id=v and c.archived_at is null and (p_data->>'status'<>'answered' or (c.current_version_id=cv.id and (select decision from public.scientific_evidence_reviews where project_id=p_project and case_version_id=cv.id order by revision desc limit 1)='accepted' and (select decision from public.source_attestations where project_id=p_project and anchor_id=cv.source_anchor_id order by revision desc limit 1)='attested' and (select source_attestation_id from public.scientific_evidence_reviews where project_id=p_project and case_version_id=cv.id order by revision desc limit 1)=(select id from public.source_attestations where project_id=p_project and anchor_id=cv.source_anchor_id order by revision desc limit 1) and not exists(select from public.source_anchors where project_id=p_project and supersedes_anchor_id=cv.source_anchor_id)))) then raise exception 'KG_SOURCE';end if;
 end loop;
 insert into public.question_revisions values(p_id,p_project,p_question,latest+1,p_data,kg_private.caller_uid(),now());return p_id;
end$$;
create function public.create_research_request(p_project uuid,p_id uuid,p_question uuid,p_paper uuid,p_case uuid) returns uuid language plpgsql security definer set search_path='' as $$declare old public.research_requests;c public.research_cases;v public.research_case_versions;q jsonb;s jsonb;begin
 perform kg_private.require_owner(p_project,true);perform pg_advisory_xact_lock(hashtextextended(p_project::text,0));
 select * into old from public.research_requests where id=p_id;if found then if old.project_id<>p_project or old.question_id<>p_question or old.paper_id<>p_paper or old.case_id<>p_case then raise exception 'KG_CONFLICT';end if;return p_id;end if;
 select * into c from public.research_cases where project_id=p_project and id=p_case and paper_id=p_paper and archived_at is null;
 if not found or not exists(select from public.papers where project_id=p_project and id=p_paper and archived_at is null) then raise exception 'KG_FORBIDDEN';end if;
 select * into v from public.research_case_versions where project_id=p_project and id=c.current_version_id;
 select jsonb_build_object('id',r.id,'question',coalesce(qr.data->>'question',r.question),'revision',coalesce(qr.revision,0),'details',qr.data) into q from public.research_questions r left join lateral(select * from public.question_revisions where project_id=p_project and question_id=r.id order by revision desc limit 1) qr on true where r.project_id=p_project and r.id=p_question;
 if q is null or v.id is null then raise exception 'KG_FORBIDDEN';end if;
 s=jsonb_build_object('schema_version','research-request/0.1','project_id',p_project,'question',q,'paper', (select jsonb_build_object('id',id,'title',title,'authors',authors,'year',year) from public.papers where project_id=p_project and id=p_paper),'case_version_id',v.id,'case_import',jsonb_build_object('schema_version','research-case/0.1','project_id',p_project,'paper_id',p_paper,'case_id',p_case,'expected_revision',c.revision,'analysis_run',jsonb_build_object('id',p_id::text,'adapter','dot_manual_json','protocol_version','research-result/0.1'),'payload',v.payload),'sources',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'paper_document_id',a.paper_document_id,'physical_page_start',a.physical_page_start,'physical_page_end',a.physical_page_end,'verbatim_passage',a.verbatim_passage,'passage_hash',a.passage_hash,'receipt_id',d.document_receipt_id,'pdf_sha256',receipt.sha256,'content_revision',receipt.content_revision)) from public.source_anchors a join public.paper_documents d on d.project_id=a.project_id and d.id=a.paper_document_id left join public.document_receipts receipt on receipt.project_id=d.project_id and receipt.id=d.document_receipt_id where a.project_id=p_project and d.paper_id=p_paper and a.id=v.source_anchor_id),'[]'::jsonb));
 insert into public.research_requests values(p_id,p_project,p_question,p_paper,p_case,s,encode(sha256(convert_to(s::text,'UTF8')),'hex'),kg_private.caller_uid(),now());return p_id;
end$$;
create function public.stage_research_result(p_project uuid,p_id uuid,p_raw text) returns uuid language plpgsql security definer set search_path='' as $$declare p jsonb;r public.research_requests;old public.research_results;b uuid;h text;begin
 perform kg_private.require_owner(p_project,true);perform pg_advisory_xact_lock(hashtextextended(p_project::text,0));
 if p_raw is null or octet_length(p_raw)>196608 then raise exception 'KG_INVALID';end if;p=p_raw::jsonb;
 if not p ?& array['schema_version','request_id','request_hash','case_import','conclusion','uncertainties'] or exists(select from jsonb_object_keys(p) k where k not in ('schema_version','request_id','request_hash','case_import','conclusion','uncertainties')) or p->>'schema_version' is distinct from 'research-result/0.1' or jsonb_typeof(p->'conclusion') is distinct from 'string' or length(btrim(p->>'conclusion')) not between 1 and 8000 or jsonb_typeof(p->'uncertainties') is distinct from 'array' or jsonb_array_length(p->'uncertainties')>20 or exists(select from jsonb_array_elements(p->'uncertainties') u where jsonb_typeof(u)<>'string' or length(btrim(u#>>'{}')) not between 1 and 2000) then raise exception 'KG_INVALID';end if;
 select * into r from public.research_requests where project_id=p_project and id=(p->>'request_id')::uuid;
 if not found then raise exception 'KG_FORBIDDEN';end if;
 if p->>'request_hash' is distinct from r.content_hash or (p->'case_import')-array['payload','analysis_run'] is distinct from (r.snapshot->'case_import')-array['payload','analysis_run'] then raise exception 'KG_CONFLICT';end if;
 h=encode(sha256(convert_to(p_raw,'UTF8')),'hex');select * into old from public.research_results where id=p_id;
 if found then if old.project_id<>p_project or old.request_id<>r.id or old.content_hash<>h then raise exception 'KG_CONFLICT';end if;return old.batch_id;end if;
 b=public.stage_research_import(p_project,p_id,(p->'case_import')::text);
 insert into public.research_results values(p_id,p_project,r.id,b,p_raw,h,kg_private.caller_uid(),now());return b;
end$$;
grant kg_research_writer to current_user with inherit false,set true;
grant create on schema public to kg_research_writer;
do $$declare f regprocedure;begin for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('revise_research_question','create_research_request','stage_research_result') loop
 execute format('revoke all on function %s from public,anon,authenticated,service_role',f);execute format('grant execute on function %s to authenticated,kg_research_writer',f);execute format('alter function %s owner to kg_research_writer',f);end loop;end$$;
revoke create on schema public from kg_research_writer;
grant kg_research_writer to current_user with set false;
commit;
