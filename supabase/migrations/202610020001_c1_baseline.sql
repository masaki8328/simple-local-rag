-- C1 only. Apply to a disposable database for review; never auto-apply in app startup.
begin;
create schema if not exists kg_private;
revoke all on schema kg_private from public;
grant usage on schema kg_private to authenticated;

create table public.projects (
 id uuid primary key default gen_random_uuid(), owner_user_id uuid not null references auth.users(id),
 name text not null check (length(trim(name)) > 0), description text not null default '',
 created_at timestamptz not null default now(), created_by uuid not null default auth.uid() references auth.users(id),
 updated_at timestamptz not null default now(), archived_at timestamptz
);
create table public.project_members (
 project_id uuid not null references public.projects(id), user_id uuid not null references auth.users(id),
 role text not null check (role in ('owner','editor','reviewer','viewer')),
 created_at timestamptz not null default now(), created_by uuid not null default auth.uid() references auth.users(id),
 updated_at timestamptz not null default now(), primary key(project_id,user_id)
);
create unique index one_owner_per_project on public.project_members(project_id) where role='owner';
create index member_user_lookup on public.project_members(user_id,project_id);
create table public.audit_events (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id),
 actor_type text not null check(actor_type in ('user','system','import')), actor_id uuid,
 action text not null, entity_type text not null, entity_id uuid not null,
 old_version_id uuid, new_version_id uuid, reason text not null,
 old_data jsonb, new_data jsonb, created_at timestamptz not null default now(), unique(project_id,id)
);
create table public.papers (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id),
 title text not null check(length(trim(title))>0), normalized_title text not null,
 journal text, year integer check(year between 1000 and 9999), abstract text, canonical_url text, publication_type text,
 publication_status text not null default 'normal' check(publication_status in ('normal','corrected','retracted','unknown')),
 relevance text, priority integer check(priority between 1 and 4), investigation_reason text, notes text,
 acquisition_status text not null default 'missing' check(acquisition_status in ('missing','requested','available','unavailable')),
 analysis_status text not null default 'not_requested' check(analysis_status in ('not_requested','pending','analyzing','analyzed','failed','needs_review')),
 revision integer not null default 1 check(revision>0),
 created_at timestamptz not null default now(), created_by uuid not null default auth.uid() references auth.users(id),
 updated_at timestamptz not null default now(), archived_at timestamptz, unique(project_id,id)
);
create table public.paper_identifiers (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id), paper_id uuid not null,
 provider text not null, raw_value text not null, normalized_value text not null, source text not null, retrieved_at timestamptz not null,
 created_at timestamptz not null default now(), created_by uuid not null default auth.uid() references auth.users(id),
 unique(project_id,id), unique(project_id,provider,normalized_value),
 foreign key(project_id,paper_id) references public.papers(project_id,id)
);
create table public.document_assets (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id),
 storage_bucket text not null check(storage_bucket='research-originals'), storage_path text not null,
 sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'), byte_size bigint not null check(byte_size>0),
 mime text not null check(mime='application/pdf'), original_filename text not null,
 upload_state text not null default 'pending' check(upload_state in ('pending','verified','failed')),
 verified_at timestamptz, created_at timestamptz not null default now(), created_by uuid not null default auth.uid() references auth.users(id),
 unique(project_id,id), unique(storage_bucket,storage_path),
 check(storage_path=project_id::text || '/' || id::text || '/original.pdf'),
 check((upload_state='verified')=(verified_at is not null))
);
create unique index verified_document_hash on public.document_assets(project_id,sha256) where upload_state='verified';
create table public.paper_documents (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id), paper_id uuid not null, document_asset_id uuid not null,
 role text not null check(role in ('main_text','supplement','correction','accepted_manuscript')),
 edition_label text not null, acquired_at timestamptz not null, acquired_from text not null, access_basis text not null,
 created_at timestamptz not null default now(), created_by uuid not null default auth.uid() references auth.users(id), unique(project_id,id),
 unique(project_id,paper_id,document_asset_id,role),
 foreign key(project_id,paper_id) references public.papers(project_id,id),
 foreign key(project_id,document_asset_id) references public.document_assets(project_id,id)
);
create table public.source_anchors (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id), paper_document_id uuid not null,
 physical_page_start integer not null check(physical_page_start>=1), physical_page_end integer not null,
 printed_page_label text, section text, figure_table_scheme text, bounding_boxes jsonb,
 verbatim_passage text not null check(length(verbatim_passage)>0), passage_hash text not null check(passage_hash ~ '^[a-f0-9]{64}$'),
 extraction_run_id text, anchor_verified_at timestamptz, supersedes_anchor_id uuid,
 created_at timestamptz not null default now(), created_by uuid not null default auth.uid() references auth.users(id), unique(project_id,id),
 check(physical_page_end>=physical_page_start), check(supersedes_anchor_id is distinct from id),
 check(passage_hash=encode(sha256(convert_to(verbatim_passage,'UTF8')),'hex')),
 foreign key(project_id,paper_document_id) references public.paper_documents(project_id,id),
 foreign key(project_id,supersedes_anchor_id) references public.source_anchors(project_id,id)
);
create index paper_documents_asset on public.paper_documents(project_id,document_asset_id);
create index anchors_document on public.source_anchors(project_id,paper_document_id);
create index anchors_supersedes on public.source_anchors(project_id,supersedes_anchor_id);
create index identifiers_paper on public.paper_identifiers(project_id,paper_id);
create index audit_project_time on public.audit_events(project_id,created_at);

-- Helpers take no user ID: identity always comes from the authenticated JWT context.
create function kg_private.has_role(target uuid, allowed text[]) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.project_members m where m.project_id=target and m.user_id=(select auth.uid()) and m.role=any(allowed));
$$;
revoke all on function kg_private.has_role(uuid,text[]) from public, anon, authenticated;
grant execute on function kg_private.has_role(uuid,text[]) to authenticated;

create function public.create_project(project_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare result uuid; caller uuid := auth.uid();
begin
 if caller is null then raise exception 'Authentication required' using errcode='42501'; end if;
 insert into public.projects(name,owner_user_id,created_by) values(project_name,caller,caller) returning id into result;
 insert into public.project_members(project_id,user_id,role,created_by) values(result,caller,'owner',caller);
 return result;
end; $$;
revoke all on function public.create_project(text) from public, anon, authenticated;
grant execute on function public.create_project(text) to authenticated;

create function kg_private.reject_mutation() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Immutable provenance: append a new record' using errcode='23514'; end; $$;
create function kg_private.guard_update() returns trigger language plpgsql set search_path='' as $$
begin
 if new.id<>old.id or new.created_by<>old.created_by or new.created_at<>old.created_at then raise exception 'Immutable identity' using errcode='23514'; end if;
 if tg_table_name='projects' then
  if new.owner_user_id<>old.owner_user_id then raise exception 'Owner transfer requires reviewed procedure' using errcode='23514'; end if;
 else
  if new.project_id<>old.project_id then raise exception 'Tenant reassignment prohibited' using errcode='23514'; end if;
  if new.revision<>old.revision+1 then raise exception 'Revision must advance exactly once' using errcode='23514'; end if;
 end if;
 new.updated_at=now(); return new;
end; $$;
create trigger projects_guard before update on public.projects for each row execute function kg_private.guard_update();
create trigger papers_guard before update on public.papers for each row execute function kg_private.guard_update();

create function kg_private.capture_audit() returns trigger language plpgsql security definer set search_path='' as $$
declare pid uuid;
begin
 if tg_table_name='projects' then pid=new.id; else pid=new.project_id; end if;
 insert into public.audit_events(project_id,actor_type,actor_id,action,entity_type,entity_id,reason,old_data,new_data)
 values(pid,case when auth.uid() is null then 'system' else 'user' end,auth.uid(),tg_op,tg_table_name,new.id,'C1 database change',case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));
 return new;
end; $$;

-- Explicit grants plus RLS. No authenticated delete or direct membership/audit mutation.
do $$
declare t text;
begin
 foreach t in array array['projects','project_members','audit_events','papers','paper_identifiers','document_assets','paper_documents','source_anchors'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public, anon, authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('create policy member_read on public.%I for select to authenticated using (kg_private.has_role(%s, array[''owner'',''editor'',''reviewer'',''viewer'']))',t,case when t='projects' then 'id' else 'project_id' end);
 end loop;
 foreach t in array array['papers','paper_identifiers','document_assets','paper_documents','source_anchors'] loop
  execute format('grant insert on public.%I to authenticated',t);
  execute format('create policy editor_insert on public.%I for insert to authenticated with check (created_by=(select auth.uid()) and kg_private.has_role(project_id,array[''owner'',''editor'']))',t);
 end loop;
 foreach t in array array['paper_identifiers','document_assets','paper_documents','source_anchors','audit_events','project_members'] loop
  execute format('create trigger immutable_record before update or delete on public.%I for each row execute function kg_private.reject_mutation()',t);
 end loop;
 foreach t in array array['projects','papers','paper_identifiers','document_assets','paper_documents','source_anchors'] loop
  execute format('create trigger audit_change after insert or update on public.%I for each row execute function kg_private.capture_audit()',t);
 end loop;
end $$;
grant update on public.projects, public.papers to authenticated;
create policy owner_update on public.projects for update to authenticated using (kg_private.has_role(id,array['owner'])) with check(kg_private.has_role(id,array['owner']));
create policy editor_update on public.papers for update to authenticated using(kg_private.has_role(project_id,array['owner','editor'])) with check(kg_private.has_role(project_id,array['owner','editor']));
-- Verification cannot be asserted by ordinary client inserts; verifier is a later narrow boundary.
create policy pending_assets_only on public.document_assets as restrictive for insert to authenticated with check(upload_state='pending' and verified_at is null);
create policy unverified_anchors_only on public.source_anchors as restrictive for insert to authenticated with check(anchor_verified_at is null);
revoke all on function kg_private.reject_mutation() from public, anon, authenticated;
revoke all on function kg_private.guard_update() from public, anon, authenticated;
revoke all on function kg_private.capture_audit() from public, anon, authenticated;
commit;
