-- Additive human mapping/review records. Existing cases, source anchors and draft flags are never rewritten.
begin;
create role kg_review_writer nologin nosuperuser nobypassrls noinherit;
grant usage on schema public,kg_private to kg_review_writer;
grant execute on function kg_private.caller_uid(),kg_private.has_role(uuid,text[]),kg_private.require_owner(uuid,boolean) to kg_review_writer;
do $$declare t text;begin foreach t in array array['projects','papers','research_cases','research_case_versions','source_anchors','paper_documents','document_receipts'] loop
 execute format('grant select on public.%I to kg_review_writer',t);
 execute format('create policy review_read on public.%I for select to kg_review_writer using(kg_private.has_role(%s,array[''owner'']))',t,case when t='projects' then 'id' else 'project_id' end);
 end loop;end$$;
create table public.project_reaction_identities(id uuid primary key,project_id uuid not null references public.projects(id),label text not null check(length(btrim(label)) between 1 and 200),seed_version_id uuid not null,definition jsonb not null,reason text not null,created_by uuid not null,created_at timestamptz not null default now(),unique(project_id,id),foreign key(project_id,seed_version_id) references public.research_case_versions(project_id,id));
create table public.reaction_identity_mappings(id uuid primary key,project_id uuid not null,identity_id uuid not null,case_version_id uuid not null,revision integer not null,decision text not null check(decision in ('include','exclude')),mapping jsonb not null,reason text not null,created_by uuid not null,created_at timestamptz not null default now(),unique(project_id,id),unique(project_id,case_version_id,revision),foreign key(project_id,identity_id) references public.project_reaction_identities(project_id,id),foreign key(project_id,case_version_id) references public.research_case_versions(project_id,id));
create table public.source_attestations(id uuid primary key,project_id uuid not null,anchor_id uuid not null,receipt_id uuid not null,receipt_sha256 text not null,passage_hash text not null,revision integer not null,decision text not null check(decision in ('attested','withdrawn')),reason text not null,created_by uuid not null,created_at timestamptz not null default now(),unique(project_id,id),unique(project_id,anchor_id,revision),foreign key(project_id,anchor_id) references public.source_anchors(project_id,id),foreign key(project_id,receipt_id) references public.document_receipts(project_id,id));
create table public.scientific_evidence_reviews(id uuid primary key,project_id uuid not null,case_version_id uuid not null,revision integer not null,decision text not null check(decision in ('accepted','needs_revision','withdrawn')),source_attestation_id uuid,reason text not null,created_by uuid not null,created_at timestamptz not null default now(),unique(project_id,id),unique(project_id,case_version_id,revision),foreign key(project_id,case_version_id) references public.research_case_versions(project_id,id),foreign key(project_id,source_attestation_id) references public.source_attestations(project_id,id));
do $$declare t text;begin foreach t in array array['project_reaction_identities','reaction_identity_mappings','source_attestations','scientific_evidence_reviews'] loop
 execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);execute format('grant select on public.%I to authenticated,kg_review_writer',t);execute format('grant insert on public.%I to kg_review_writer',t);
 execute format('create policy owner_read on public.%I for select to authenticated,kg_review_writer using(kg_private.has_role(project_id,array[''owner'']))',t);
 execute format('create policy reviewer_insert on public.%I for insert to kg_review_writer with check(created_by=kg_private.caller_uid() and kg_private.has_role(project_id,array[''owner'']))',t);
 execute format('create trigger immutable_record before update or delete on public.%I for each row execute function kg_private.reject_mutation()',t);
 execute format('create trigger audit_change after insert on public.%I for each row execute function kg_private.capture_audit()',t);
 end loop;end$$;
create function kg_private.review_payload(p_project uuid,p_version uuid) returns jsonb language plpgsql set search_path='' as $$declare payload jsonb;begin
 perform kg_private.require_owner(p_project,true);
 select v.payload into payload from public.research_case_versions v join public.research_cases c on c.project_id=v.project_id and c.id=v.case_id join public.papers p on p.project_id=c.project_id and p.id=c.paper_id where v.project_id=p_project and v.id=p_version and c.current_version_id=v.id and c.archived_at is null and p.archived_at is null;
 if not found then raise exception 'KG_FORBIDDEN';end if;return payload;
end$$;
revoke all on function kg_private.review_payload(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function kg_private.review_payload(uuid,uuid) to kg_review_writer;
create function public.create_reaction_identity(p_project uuid,p_id uuid,p_version uuid,p_label text,p_reason text,p_attested boolean) returns uuid language plpgsql security definer set search_path='' as $$declare payload jsonb;old public.project_reaction_identities;begin
 payload=kg_private.review_payload(p_project,p_version);if p_attested is distinct from true or p_reason is null or length(btrim(p_reason)) not between 1 and 4000 then raise exception 'KG_INVALID';end if;
 insert into public.project_reaction_identities(id,project_id,label,seed_version_id,definition,reason,created_by) values(p_id,p_project,p_label,p_version,payload,p_reason,kg_private.caller_uid()) on conflict(id) do nothing;
 select * into old from public.project_reaction_identities where id=p_id;if not found or old.project_id<>p_project or old.seed_version_id<>p_version or old.label<>p_label or old.reason<>p_reason then raise exception 'KG_CONFLICT';end if;return old.id;
end$$;
create function public.map_reaction_identity(p_project uuid,p_id uuid,p_identity uuid,p_version uuid,p_expected integer,p_decision text,p_mapping jsonb,p_reason text,p_attested boolean) returns uuid language plpgsql security definer set search_path='' as $$declare payload jsonb;definition jsonb;old public.reaction_identity_mappings;current_revision integer;pair jsonb;left_compound jsonb;right_compound jsonb;left_parts jsonb;right_parts jsonb;begin
 payload=kg_private.review_payload(p_project,p_version);perform pg_advisory_xact_lock(hashtextextended(p_project::text||p_version::text,21));
 if p_attested is distinct from true or p_reason is null or length(btrim(p_reason)) not between 1 and 4000 or p_decision not in ('include','exclude') or p_expected is null or p_expected<0 then raise exception 'KG_INVALID';end if;
 select * into old from public.reaction_identity_mappings where id=p_id;if found then if old.project_id<>p_project or old.identity_id<>p_identity or old.case_version_id<>p_version or old.mapping<>p_mapping or old.decision<>p_decision or old.reason<>p_reason then raise exception 'KG_CONFLICT';end if;return old.id;end if;
 select coalesce(max(revision),0) into current_revision from public.reaction_identity_mappings where project_id=p_project and case_version_id=p_version;if current_revision<>p_expected then raise exception 'KG_CONFLICT';end if;
 select i.definition into definition from public.project_reaction_identities i where project_id=p_project and id=p_identity;if not found then raise exception 'KG_FORBIDDEN';end if;
 if payload#>>'{claim,scope}'<>definition#>>'{claim,scope}' or payload#>>'{reaction,representation_scope}'<>definition#>>'{reaction,representation_scope}' or jsonb_typeof(p_mapping) is distinct from 'array' or jsonb_array_length(p_mapping)<>jsonb_array_length(payload->'compounds') or jsonb_array_length(p_mapping)<>jsonb_array_length(definition->'compounds') then raise exception 'KG_MAPPING';end if;
 if (select count(distinct x->>'source') from jsonb_array_elements(p_mapping)x)<>jsonb_array_length(p_mapping) or (select count(distinct x->>'target') from jsonb_array_elements(p_mapping)x)<>jsonb_array_length(p_mapping) then raise exception 'KG_MAPPING';end if;
 for pair in select value from jsonb_array_elements(p_mapping) loop
  select x into left_compound from jsonb_array_elements(payload->'compounds')x where x->>'id'=pair->>'source';select x into right_compound from jsonb_array_elements(definition->'compounds')x where x->>'id'=pair->>'target';
  if left_compound is null or right_compound is null or (left_compound-array['id','name','aliases','epistemic_status'])<>(right_compound-array['id','name','aliases','epistemic_status']) then raise exception 'KG_MAPPING';end if;
 end loop;
 select jsonb_agg(jsonb_build_array(m->>'target',x->>'role',x->'coefficient') order by m->>'target',x->>'role',x->'coefficient') into left_parts from jsonb_array_elements(payload#>'{reaction,participants}')x join jsonb_array_elements(p_mapping)m on m->>'source'=x->>'compound_id';
 select jsonb_agg(jsonb_build_array(x->>'compound_id',x->>'role',x->'coefficient') order by x->>'compound_id',x->>'role',x->'coefficient') into right_parts from jsonb_array_elements(definition#>'{reaction,participants}')x;
 if left_parts is distinct from right_parts then raise exception 'KG_MAPPING';end if;
 insert into public.reaction_identity_mappings values(p_id,p_project,p_identity,p_version,current_revision+1,p_decision,p_mapping,p_reason,kg_private.caller_uid(),now());return p_id;
end$$;
create function public.attest_source_locator(p_project uuid,p_id uuid,p_anchor uuid,p_expected integer,p_decision text,p_reason text,p_attested boolean) returns uuid language plpgsql security definer set search_path='' as $$declare a public.source_anchors;r public.document_receipts;old public.source_attestations;rev integer;begin
 perform kg_private.require_owner(p_project,true);perform pg_advisory_xact_lock(hashtextextended(p_project::text||p_anchor::text,22));
 if p_attested is distinct from true or p_reason is null or length(btrim(p_reason)) not between 1 and 4000 or p_decision not in ('attested','withdrawn') then raise exception 'KG_INVALID';end if;
 select * into a from public.source_anchors where project_id=p_project and id=p_anchor;if not found then raise exception 'KG_FORBIDDEN';end if;
 select receipt.* into r from public.paper_documents d join public.document_receipts receipt on receipt.project_id=d.project_id and receipt.id=d.document_receipt_id join public.papers p on p.project_id=d.project_id and p.id=d.paper_id where d.project_id=p_project and d.id=a.paper_document_id and p.archived_at is null;if not found then raise exception 'KG_FORBIDDEN';end if;
 if p_decision='attested' and exists(select 1 from public.source_anchors where project_id=p_project and supersedes_anchor_id=p_anchor) then raise exception 'KG_CONFLICT';end if;
 select * into old from public.source_attestations where id=p_id;if found then if old.project_id<>p_project or old.anchor_id<>p_anchor or old.decision<>p_decision or old.reason<>p_reason then raise exception 'KG_CONFLICT';end if;return old.id;end if;
 select coalesce(max(revision),0) into rev from public.source_attestations where project_id=p_project and anchor_id=p_anchor;if rev is distinct from p_expected then raise exception 'KG_CONFLICT';end if;
 insert into public.source_attestations values(p_id,p_project,p_anchor,r.id,r.sha256,a.passage_hash,rev+1,p_decision,p_reason,kg_private.caller_uid(),now());return p_id;
end$$;
create function public.review_scientific_evidence(p_project uuid,p_id uuid,p_version uuid,p_expected integer,p_decision text,p_reason text,p_attested boolean) returns uuid language plpgsql security definer set search_path='' as $$declare payload jsonb;old public.scientific_evidence_reviews;source public.source_attestations;rev integer;begin
 payload=kg_private.review_payload(p_project,p_version);perform pg_advisory_xact_lock(hashtextextended(p_project::text||p_version::text,23));
 if p_attested is distinct from true or p_reason is null or length(btrim(p_reason)) not between 1 and 4000 or p_decision not in ('accepted','needs_revision','withdrawn') then raise exception 'KG_INVALID';end if;
 select * into old from public.scientific_evidence_reviews where id=p_id;if found then if old.project_id<>p_project or old.case_version_id<>p_version or old.decision<>p_decision or old.reason<>p_reason then raise exception 'KG_CONFLICT';end if;return old.id;end if;
 select coalesce(max(revision),0) into rev from public.scientific_evidence_reviews where project_id=p_project and case_version_id=p_version;if rev is distinct from p_expected then raise exception 'KG_CONFLICT';end if;
 if p_decision='accepted' then
  select * into source from public.source_attestations where project_id=p_project and anchor_id=(payload#>>'{evidence,source_anchor_id}')::uuid order by revision desc limit 1;
  if not found or source.decision<>'attested' or payload#>>'{evidence,source_access}'<>'fulltext' or exists(select 1 from public.source_anchors where project_id=p_project and supersedes_anchor_id=source.anchor_id) then raise exception 'KG_SOURCE';end if;
 end if;
 insert into public.scientific_evidence_reviews values(p_id,p_project,p_version,rev+1,p_decision,source.id,p_reason,kg_private.caller_uid(),now());return p_id;
end$$;
grant kg_review_writer to current_user with inherit false,set true;
grant create on schema public to kg_review_writer;
do $$declare f regprocedure;begin for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('create_reaction_identity','map_reaction_identity','attest_source_locator','review_scientific_evidence') loop
 execute format('revoke all on function %s from public,anon,authenticated,service_role',f);execute format('grant execute on function %s to authenticated',f);execute format('alter function %s owner to kg_review_writer',f);end loop;end$$;
revoke create on schema public from kg_review_writer;
grant kg_review_writer to current_user with set false;
commit;
