-- Task 2: owner-scoped metadata workflow; no Storage, service-role CRUD or C2 tables.
begin;
alter table public.projects add column revision integer not null default 1 check(revision>0), add column creation_request_id uuid, add column creation_request_hash text;
alter table public.papers add column creation_request_id uuid, add column creation_request_hash text;
alter table public.projects add constraint projects_request_pair check((creation_request_id is null)=(creation_request_hash is null));
alter table public.papers add constraint papers_request_pair check((creation_request_id is null)=(creation_request_hash is null));
create unique index projects_create_request on public.projects(owner_user_id,creation_request_id) where creation_request_id is not null;
create unique index papers_create_request on public.papers(project_id,creation_request_id) where creation_request_id is not null;

create or replace function kg_private.guard_update() returns trigger language plpgsql set search_path='' as $$
begin
 if new.id<>old.id or new.created_by<>old.created_by or new.created_at<>old.created_at or new.creation_request_id is distinct from old.creation_request_id or new.creation_request_hash is distinct from old.creation_request_hash then raise exception 'Immutable identity' using errcode='23514'; end if;
 if tg_table_name='projects' then
  if new.owner_user_id<>old.owner_user_id then raise exception 'Owner transfer requires reviewed procedure' using errcode='23514'; end if;
 else
  if new.project_id<>old.project_id then raise exception 'Tenant reassignment prohibited' using errcode='23514'; end if;
 end if;
 if new.revision<>old.revision+1 then raise exception 'Revision must advance exactly once' using errcode='23514'; end if;
 new.updated_at=now(); return new;
end; $$;

create function kg_private.normalized_title(value text) returns text language sql immutable set search_path='' as $$ select lower(btrim(regexp_replace(value,'\s+',' ','g'))) $$;
create function kg_private.validate_paper(p_title text,p_journal text,p_year integer,p_notes text) returns void language plpgsql set search_path='' as $$
begin
 if p_title is null or kg_private.normalized_title(p_title)='' or length(p_title)>500 or p_journal is null or length(p_journal)>500 or p_notes is null or length(p_notes)>10000 or (p_year is not null and (p_year<1000 or p_year>extract(year from now())+1)) then raise exception 'KG_INVALID'; end if;
end; $$;
create function kg_private.require_owner(p_project_id uuid,p_active boolean) returns void language plpgsql security invoker set search_path='' as $$
declare archived timestamptz;
begin
 if auth.uid() is null or not kg_private.has_role(p_project_id,array['owner']) then raise exception 'KG_FORBIDDEN'; end if;
 select archived_at into archived from public.projects where id=p_project_id and owner_user_id=auth.uid();
 if not found then raise exception 'KG_FORBIDDEN'; end if;
 if p_active and archived is not null then raise exception 'KG_ARCHIVED'; end if;
end; $$;

-- Bootstrap needs narrowly scoped definer rights because direct project/member INSERT is forbidden.
create function public.create_project_v2(p_request_id uuid,p_name text,p_description text) returns uuid language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid(); existing public.projects; content_hash text; result uuid;
begin
 if caller is null then raise exception 'KG_FORBIDDEN'; end if;
 if p_request_id is null or p_name is null or kg_private.normalized_title(p_name)='' or length(p_name)>200 or p_description is null or length(p_description)>4000 then raise exception 'KG_INVALID'; end if;
 content_hash=encode(sha256(convert_to(jsonb_build_array(p_name,p_description)::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended(caller::text||p_request_id::text,0));
 select * into existing from public.projects where owner_user_id=caller and creation_request_id=p_request_id;
 if found then
  if existing.creation_request_hash<>content_hash then raise exception 'KG_CONFLICT'; end if;
  return existing.id;
 end if;
 insert into public.projects(owner_user_id,name,description,created_by,creation_request_id,creation_request_hash) values(caller,p_name,p_description,caller,p_request_id,content_hash) returning id into result;
 insert into public.project_members(project_id,user_id,role,created_by) values(result,caller,'owner',caller);
 return result;
end; $$;
create function public.edit_project(p_project_id uuid,p_revision integer,p_name text,p_description text) returns uuid language plpgsql security invoker set search_path='' as $$
declare result uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_project_id::text,0));
 perform kg_private.require_owner(p_project_id,true);
 if p_name is null or kg_private.normalized_title(p_name)='' or length(p_name)>200 or p_description is null or length(p_description)>4000 then raise exception 'KG_INVALID'; end if;
 update public.projects set name=p_name,description=p_description,revision=revision+1 where id=p_project_id and revision=p_revision returning id into result;
 if result is null then raise exception 'KG_CONFLICT'; end if;
 return result;
end; $$;
create function public.archive_project(p_project_id uuid,p_revision integer,p_archived boolean) returns uuid language plpgsql security invoker set search_path='' as $$
declare result uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_project_id::text,0));
 perform kg_private.require_owner(p_project_id,false);
 if p_archived is null then raise exception 'KG_INVALID'; end if;
 update public.projects set archived_at=case when p_archived then now() else null end,revision=revision+1 where id=p_project_id and revision=p_revision returning id into result;
 if result is null then raise exception 'KG_CONFLICT'; end if;
 return result;
end; $$;
create function public.create_paper(p_project_id uuid,p_request_id uuid,p_title text,p_journal text,p_year integer,p_notes text,p_doi text) returns uuid language plpgsql security invoker set search_path='' as $$
declare result uuid; existing public.papers; content_hash text; normalized_doi text;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_project_id::text,0));
 perform kg_private.require_owner(p_project_id,true);
 perform kg_private.validate_paper(p_title,p_journal,p_year,p_notes);
 normalized_doi=lower(btrim(regexp_replace(regexp_replace(btrim(p_doi),'^https?://(dx\.)?doi\.org/','','i'),'^doi:\s*','','i')));
 if p_request_id is null or p_doi is null or length(p_doi)>1000 or (normalized_doi<>'' and normalized_doi!~'^10\.[0-9]{4,9}/[^[:space:]<>]+$') then raise exception 'KG_INVALID'; end if;
 content_hash=encode(sha256(convert_to(jsonb_build_array(p_title,p_journal,p_year,p_notes,normalized_doi)::text,'UTF8')),'hex');
 select * into existing from public.papers where project_id=p_project_id and creation_request_id=p_request_id;
 if found then
  if existing.creation_request_hash<>content_hash then raise exception 'KG_CONFLICT'; end if;
  return existing.id;
 end if;
 if normalized_doi<>'' and exists(select 1 from public.paper_identifiers where project_id=p_project_id and provider='doi' and normalized_value=normalized_doi) then raise exception 'KG_DUPLICATE_DOI'; end if;
 if exists(select 1 from public.papers where project_id=p_project_id and normalized_title=kg_private.normalized_title(p_title)) then raise exception 'KG_DUPLICATE_TITLE'; end if;
 insert into public.papers(project_id,title,normalized_title,journal,year,notes,creation_request_id,creation_request_hash) values(p_project_id,p_title,kg_private.normalized_title(p_title),nullif(p_journal,''),p_year,nullif(p_notes,''),p_request_id,content_hash) returning id into result;
 if normalized_doi<>'' then
  insert into public.paper_identifiers(project_id,paper_id,provider,raw_value,normalized_value,source,retrieved_at) values(p_project_id,result,'doi',p_doi,normalized_doi,'human_entry',now());
 end if;
 return result;
end; $$;
create function public.edit_paper(p_project_id uuid,p_paper_id uuid,p_revision integer,p_title text,p_journal text,p_year integer,p_notes text) returns uuid language plpgsql security invoker set search_path='' as $$
declare result uuid; existing public.papers;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_project_id::text,0));
 perform kg_private.require_owner(p_project_id,true);
 perform kg_private.validate_paper(p_title,p_journal,p_year,p_notes);
 select * into existing from public.papers where project_id=p_project_id and id=p_paper_id;
 if not found then raise exception 'KG_FORBIDDEN'; end if;
 if existing.archived_at is not null then raise exception 'KG_ARCHIVED'; end if;
 if existing.revision<>p_revision then raise exception 'KG_CONFLICT'; end if;
 if exists(select 1 from public.papers where project_id=p_project_id and id<>p_paper_id and normalized_title=kg_private.normalized_title(p_title)) then raise exception 'KG_DUPLICATE_TITLE'; end if;
 update public.papers set title=p_title,normalized_title=kg_private.normalized_title(p_title),journal=nullif(p_journal,''),year=p_year,notes=nullif(p_notes,''),revision=revision+1 where project_id=p_project_id and id=p_paper_id and revision=p_revision returning id into result;
 if result is null then raise exception 'KG_CONFLICT'; end if;
 return result;
end; $$;
create function public.archive_paper(p_project_id uuid,p_paper_id uuid,p_revision integer,p_archived boolean) returns uuid language plpgsql security invoker set search_path='' as $$
declare result uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_project_id::text,0));
 perform kg_private.require_owner(p_project_id,true);
 if p_archived is null then raise exception 'KG_INVALID'; end if;
 if not exists(select 1 from public.papers where project_id=p_project_id and id=p_paper_id) then raise exception 'KG_FORBIDDEN'; end if;
 update public.papers set archived_at=case when p_archived then now() else null end,revision=revision+1 where project_id=p_project_id and id=p_paper_id and revision=p_revision returning id into result;
 if result is null then raise exception 'KG_CONFLICT'; end if;
 return result;
end; $$;
-- No legacy non-idempotent project creation path through the app API.
revoke all on function public.create_project(text) from public,anon,authenticated;
revoke all on function kg_private.guard_update() from public,anon,authenticated;
do $$
declare signature text;
begin
 foreach signature in array array['kg_private.normalized_title(text)','kg_private.validate_paper(text,text,integer,text)','kg_private.require_owner(uuid,boolean)','public.create_project_v2(uuid,text,text)','public.edit_project(uuid,integer,text,text)','public.archive_project(uuid,integer,boolean)','public.create_paper(uuid,uuid,text,text,integer,text,text)','public.edit_paper(uuid,uuid,integer,text,text,integer,text)','public.archive_paper(uuid,uuid,integer,boolean)'] loop
  execute 'revoke all on function '||signature||' from public,anon,authenticated';
  execute 'grant execute on function '||signature||' to authenticated';
 end loop;
end $$;
-- Metadata mutations run as a non-login, non-table-owner role that remains subject to RLS.
-- No service-role client and no direct authenticated metadata writes.
create role kg_metadata_writer nologin noinherit nobypassrls;
grant usage on schema public,kg_private,auth to kg_metadata_writer;
grant execute on function auth.uid(),kg_private.has_role(uuid,text[]),kg_private.normalized_title(text),kg_private.validate_paper(text,text,integer,text),kg_private.require_owner(uuid,boolean) to kg_metadata_writer;
grant select on public.projects,public.papers,public.paper_identifiers to kg_metadata_writer;
grant insert on public.papers,public.paper_identifiers to kg_metadata_writer;
grant update on public.projects,public.papers to kg_metadata_writer;
revoke insert,update on public.projects,public.papers,public.paper_identifiers from authenticated;
alter policy member_read on public.projects to authenticated,kg_metadata_writer;
alter policy member_read on public.papers to authenticated,kg_metadata_writer;
alter policy member_read on public.paper_identifiers to authenticated,kg_metadata_writer;
alter policy owner_update on public.projects to authenticated,kg_metadata_writer;
alter policy editor_update on public.papers to authenticated,kg_metadata_writer;
alter policy editor_insert on public.papers to authenticated,kg_metadata_writer;
alter policy editor_insert on public.paper_identifiers to authenticated,kg_metadata_writer;
do $$
declare signature text;
begin
 foreach signature in array array['public.edit_project(uuid,integer,text,text)','public.archive_project(uuid,integer,boolean)','public.create_paper(uuid,uuid,text,text,integer,text,text)','public.edit_paper(uuid,uuid,integer,text,text,integer,text)','public.archive_paper(uuid,uuid,integer,boolean)'] loop
  execute 'alter function '||signature||' security definer';
  execute 'alter function '||signature||' owner to kg_metadata_writer';
 end loop;
end $$;
commit;
