-- Task 5 additive receipt bridge. No OAuth secrets, Storage dependency, analysis or confirmation.
begin;
create role kg_drive_owner nologin nosuperuser nobypassrls noinherit;
create role kg_drive_worker nologin nosuperuser nobypassrls noinherit;
grant usage on schema kg_private,public to kg_drive_owner;
grant usage on schema kg_private to kg_drive_worker;
grant execute on function kg_private.has_role(uuid,text[]),kg_private.caller_uid() to kg_drive_owner;
create table public.drive_bindings(id uuid primary key,project_id uuid not null references public.projects(id),account_id text not null check(length(account_id) between 1 and 255),folder_id text not null check(length(folder_id) between 1 and 255),created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),unique(project_id,id));
create table public.drive_intents(id uuid primary key,project_id uuid not null,paper_id uuid not null,binding_id uuid not null,file_id text not null unique check(length(file_id) between 1 and 255),input jsonb not null,expected_size bigint not null check(expected_size between 1 and 100000000),created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '24 hours',unique(project_id,id),unique(project_id,id,paper_id,file_id),foreign key(project_id,paper_id) references public.papers(project_id,id),foreign key(project_id,binding_id) references public.drive_bindings(project_id,id));
create table public.document_receipts(id uuid primary key default gen_random_uuid(),project_id uuid not null,paper_id uuid not null,intent_id uuid not null unique,provider text not null default 'google_drive' check(provider='google_drive'),external_file_id text not null,content_revision text not null check(length(content_revision) between 1 and 255),sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),byte_size bigint not null check(byte_size between 1 and 100000000),state text not null default 'stored_unparsed' check(state='stored_unparsed'),imported_at timestamptz not null default now(),created_by uuid not null references auth.users(id),unique(project_id,id),unique(project_id,paper_id,id),foreign key(project_id,intent_id,paper_id,external_file_id) references public.drive_intents(project_id,id,paper_id,file_id));
create table public.document_provider_events(id uuid primary key default gen_random_uuid(),project_id uuid not null,intent_id uuid not null,state text not null check(state in ('stored_unparsed','unavailable','replaced','retryable','invalid_bytes','checked','cancelled')),created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),foreign key(project_id,intent_id) references public.drive_intents(project_id,id));
-- Preserve existing paper_document and source_anchor IDs and all legacy rows.
alter table public.paper_documents alter column document_asset_id drop not null;
alter table public.paper_documents add column document_receipt_id uuid;
alter table public.paper_documents add constraint one_document_source check(num_nonnulls(document_asset_id,document_receipt_id)=1);
alter table public.paper_documents add foreign key(project_id,paper_id,document_receipt_id) references public.document_receipts(project_id,paper_id,id);
create unique index one_receipt_link on public.paper_documents(document_receipt_id) where document_receipt_id is not null;
-- No source-anchor insert or verification grant is added.
do $$declare t text;begin
 foreach t in array array['drive_bindings','drive_intents','document_receipts','document_provider_events'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role,kg_drive_worker',t);
  execute format('grant select on public.%I to authenticated,kg_drive_owner',t);
  execute format('grant insert on public.%I to kg_drive_owner',t);
  execute format('create policy owner_read on public.%I for select to authenticated,kg_drive_owner using(kg_private.has_role(project_id,array[''owner'']))',t);
  execute format('create policy writer_insert on public.%I for insert to kg_drive_owner with check(created_by=kg_private.caller_uid() and kg_private.has_role(project_id,array[''owner'']))',t);
  execute format('create trigger immutable_record before update or delete on public.%I for each row execute function kg_private.reject_mutation()',t);
 end loop;
end$$;
grant select on public.projects,public.papers to kg_drive_owner;
create policy drive_owner_read on public.projects for select to kg_drive_owner using(kg_private.has_role(id,array['owner']));
create policy drive_owner_read on public.papers for select to kg_drive_owner using(kg_private.has_role(project_id,array['owner']));
grant select,insert on public.paper_documents to kg_drive_owner;
create policy drive_link_read on public.paper_documents for select to kg_drive_owner using(kg_private.has_role(project_id,array['owner']));
create policy drive_link_insert on public.paper_documents for insert to kg_drive_owner with check(created_by=kg_private.caller_uid() and document_asset_id is null and document_receipt_id is not null and kg_private.has_role(project_id,array['owner']));
create function kg_private.drive_authorize(p_project uuid,p_paper uuid default null) returns void language plpgsql set search_path='' as $$begin
 if not kg_private.has_role(p_project,array['owner']) or not exists(select 1 from public.projects where id=p_project and archived_at is null) or (p_paper is not null and not exists(select 1 from public.papers where id=p_paper and project_id=p_project and archived_at is null)) then raise exception 'KG_FORBIDDEN';end if;
end$$;
create function kg_private.bind_drive(p_id uuid,p_project uuid,p_account text,p_folder text) returns uuid language plpgsql set search_path='' as $$declare b public.drive_bindings;begin
 perform kg_private.drive_authorize(p_project);insert into public.drive_bindings(id,project_id,account_id,folder_id,created_by) values(p_id,p_project,p_account,p_folder,kg_private.caller_uid()) on conflict(id) do nothing;
 select * into b from public.drive_bindings where id=p_id;if not found or b.project_id<>p_project or b.account_id<>p_account or b.folder_id<>p_folder then raise exception 'KG_CONFLICT';end if;return b.id;
end$$;
create function kg_private.begin_drive(p_id uuid,p_project uuid,p_paper uuid,p_binding uuid,p_file text,p_input jsonb) returns uuid language plpgsql set search_path='' as $$declare i public.drive_intents;begin
 perform kg_private.drive_authorize(p_project,p_paper);
 if jsonb_typeof(p_input)<>'object' or not p_input ?& array['filename','size','edition','source','accessBasis'] or exists(select 1 from jsonb_object_keys(p_input) k where k not in ('filename','size','edition','source','accessBasis')) or jsonb_typeof(p_input->'size')<>'number' or (p_input->>'size')::numeric<>trunc((p_input->>'size')::numeric) or exists(select 1 from jsonb_each(p_input) x where x.key<>'size' and (jsonb_typeof(x.value)<>'string' or length(btrim(x.value #>> '{}'))=0)) or length(p_input->>'filename')>255 or length(p_input->>'edition')>200 or length(p_input->>'source')>2000 or length(p_input->>'accessBasis')>500 then raise exception 'KG_INVALID';end if;
 insert into public.drive_intents(id,project_id,paper_id,binding_id,file_id,input,expected_size,created_by) values(p_id,p_project,p_paper,p_binding,p_file,p_input,(p_input->>'size')::bigint,kg_private.caller_uid()) on conflict(id) do nothing;
 select * into i from public.drive_intents where id=p_id;if not found or i.project_id<>p_project or i.paper_id<>p_paper or i.binding_id<>p_binding or i.input<>p_input then raise exception 'KG_CONFLICT';end if;return i.id;
end$$;
create function kg_private.drive_event(p_intent uuid,p_state text) returns void language plpgsql set search_path='' as $$declare i public.drive_intents;begin
 select * into i from public.drive_intents where id=p_intent;if not found then raise exception 'KG_FORBIDDEN';end if;perform kg_private.drive_authorize(i.project_id,i.paper_id);
 if p_state not in ('unavailable','replaced','retryable','invalid_bytes','checked','cancelled') or p_state is null then raise exception 'KG_INVALID';end if;
 if p_state='cancelled' then perform pg_advisory_xact_lock(hashtextextended(p_intent::text,5));if exists(select 1 from public.document_receipts where intent_id=p_intent) then raise exception 'KG_CONFLICT';end if;end if;
 insert into public.document_provider_events(project_id,intent_id,state,created_by) values(i.project_id,i.id,p_state,kg_private.caller_uid());
end$$;
create function kg_private.finish_drive(p_intent uuid,p_revision text,p_hash text,p_size bigint) returns uuid language plpgsql set search_path='' as $$declare i public.drive_intents;r public.document_receipts;begin
 perform pg_advisory_xact_lock(hashtextextended(p_intent::text,5));select * into i from public.drive_intents where id=p_intent;if not found then raise exception 'KG_FORBIDDEN';end if;perform kg_private.drive_authorize(i.project_id,i.paper_id);
 select * into r from public.document_receipts where intent_id=p_intent;if found then if r.content_revision is distinct from p_revision or r.sha256 is distinct from p_hash or r.byte_size is distinct from p_size then raise exception 'KG_CONFLICT';end if;return r.id;end if;
 if i.expires_at<=now() or exists(select 1 from public.document_provider_events where intent_id=p_intent and state='cancelled') then raise exception 'KG_EXPIRED';end if;
 if p_size is distinct from i.expected_size then raise exception 'KG_CONFLICT';end if;
 insert into public.document_receipts(project_id,paper_id,intent_id,external_file_id,content_revision,sha256,byte_size,created_by) values(i.project_id,i.paper_id,i.id,i.file_id,p_revision,p_hash,p_size,kg_private.caller_uid()) returning * into r;
 insert into public.paper_documents(project_id,paper_id,document_receipt_id,role,edition_label,acquired_at,acquired_from,access_basis,created_by) values(i.project_id,i.paper_id,r.id,'main_text',i.input->>'edition',now(),i.input->>'source',i.input->>'accessBasis',kg_private.caller_uid());
 insert into public.document_provider_events(project_id,intent_id,state,created_by) values(i.project_id,i.id,'stored_unparsed',kg_private.caller_uid());return r.id;
end$$;
-- Restricted owner has no LOGIN/table ownership/bypass; worker has EXECUTE only.
-- Future connection must verify user JWT itself, set a transaction-local caller and reset it.
-- No connection login or membership is provisioned here.
grant kg_drive_owner to current_user with inherit false;
grant kg_drive_owner to current_user with set true;
grant create on schema kg_private to kg_drive_owner;
do $$declare f regprocedure;begin
 for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='kg_private' and p.proname in ('drive_authorize','bind_drive','begin_drive','drive_event','finish_drive') loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',f);
  if f::text not like '%drive_authorize%' then execute format('grant execute on function %s to kg_drive_worker',f);end if;
  execute format('alter function %s security definer',f);execute format('alter function %s owner to kg_drive_owner',f);
 end loop;
end$$;
revoke create on schema kg_private from kg_drive_owner;
grant kg_drive_owner to current_user with set false;
do $$begin if has_schema_privilege('kg_drive_owner','auth','USAGE') or has_schema_privilege('kg_drive_owner','kg_private','CREATE') or pg_has_role(current_user,'kg_drive_owner','SET') or pg_has_role('kg_drive_worker','kg_drive_owner','MEMBER') then raise exception 'Unsafe Drive capability';end if;end$$;
commit;
