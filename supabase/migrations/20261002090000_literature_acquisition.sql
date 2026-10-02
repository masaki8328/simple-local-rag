-- Local candidate: bibliographic search and acquisition planning, never scientific evidence.
begin;
alter table public.papers add column authors text not null default '';
create role kg_literature_writer nologin nosuperuser nobypassrls noinherit;
grant usage on schema public,kg_private to kg_literature_writer;
grant execute on function kg_private.caller_uid(),kg_private.has_role(uuid,text[]),kg_private.require_owner(uuid,boolean),kg_private.validate_paper(text,text,integer,text),kg_private.normalized_title(text) to kg_literature_writer;
-- Existing metadata function has a different restricted owner; grant as that owner.
grant kg_metadata_writer to current_user with set true;
set local role kg_metadata_writer;
grant execute on function public.create_paper(uuid,uuid,text,text,integer,text,text) to kg_literature_writer;
reset role;
grant kg_metadata_writer to current_user with set false;
grant select on public.projects,public.papers,public.paper_identifiers to kg_literature_writer;
grant update(authors,abstract,canonical_url,publication_status,revision) on public.papers to kg_literature_writer;
grant insert on public.paper_identifiers to kg_literature_writer;
create policy literature_projects on public.projects for select to kg_literature_writer using(kg_private.has_role(id,array['owner']));
create policy literature_papers on public.papers for select to kg_literature_writer using(kg_private.has_role(project_id,array['owner']));
create policy literature_identifiers on public.paper_identifiers for select to kg_literature_writer using(kg_private.has_role(project_id,array['owner']));
create policy literature_paper_update on public.papers for update to kg_literature_writer using(kg_private.has_role(project_id,array['owner'])) with check(kg_private.has_role(project_id,array['owner']));
create policy literature_identifier_insert on public.paper_identifiers for insert to kg_literature_writer with check(created_by=kg_private.caller_uid() and kg_private.has_role(project_id,array['owner']));
create table public.research_questions(id uuid primary key,project_id uuid not null references public.projects(id),question text not null check(length(btrim(question)) between 1 and 2000),created_by uuid not null,created_at timestamptz not null default now(),unique(project_id,id));
create table public.literature_searches(id uuid primary key,project_id uuid not null references public.projects(id),question_id uuid,query text not null check(length(btrim(query)) between 2 and 500),payload jsonb not null,created_by uuid not null,created_at timestamptz not null default now(),unique(project_id,id),foreign key(project_id,question_id) references public.research_questions(project_id,id));
create table public.acquisition_tasks(id uuid primary key,project_id uuid not null,paper_id uuid not null,question_id uuid,priority integer not null check(priority between 1 and 3),status text not null check(status in ('needed','requested','blocked','deferred')),reason text not null check(length(btrim(reason)) between 1 and 2000),revision integer not null default 1,created_by uuid not null,created_at timestamptz not null default now(),unique(project_id,id),unique nulls not distinct(project_id,paper_id,question_id),foreign key(project_id,paper_id) references public.papers(project_id,id),foreign key(project_id,question_id) references public.research_questions(project_id,id));
create table public.literature_selections(id uuid primary key,project_id uuid not null,search_id uuid not null,candidate_index integer not null,reason text not null,priority integer not null,paper_id uuid not null,task_id uuid not null,created_by uuid not null,created_at timestamptz not null default now(),foreign key(project_id,search_id) references public.literature_searches(project_id,id),foreign key(project_id,paper_id) references public.papers(project_id,id),foreign key(project_id,task_id) references public.acquisition_tasks(project_id,id));
do $$declare t text;begin foreach t in array array['research_questions','literature_searches','acquisition_tasks','literature_selections'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
 execute format('grant select on public.%I to authenticated,kg_literature_writer',t);
 execute format('grant insert on public.%I to kg_literature_writer',t);
 execute format('create policy owner_read on public.%I for select to authenticated,kg_literature_writer using(kg_private.has_role(project_id,array[''owner'']))',t);
 execute format('create policy owner_insert on public.%I for insert to kg_literature_writer with check(created_by=kg_private.caller_uid() and kg_private.has_role(project_id,array[''owner'']))',t);
 execute format('create trigger audit_change after insert or update on public.%I for each row execute function kg_private.capture_audit()',t);
 if t<>'acquisition_tasks' then execute format('create trigger immutable_record before update or delete on public.%I for each row execute function kg_private.reject_mutation()',t);end if;
 end loop;end$$;
grant update(priority,status,reason,revision) on public.acquisition_tasks to kg_literature_writer;
create policy task_update on public.acquisition_tasks for update to kg_literature_writer using(kg_private.has_role(project_id,array['owner'])) with check(kg_private.has_role(project_id,array['owner']));
create function public.create_research_question(p_project uuid,p_id uuid,p_question text) returns uuid language plpgsql security definer set search_path='' as $$declare old public.research_questions;begin
 perform kg_private.require_owner(p_project,true);insert into public.research_questions values(p_id,p_project,p_question,kg_private.caller_uid(),now()) on conflict(id) do nothing;select * into old from public.research_questions where id=p_id;if not found or old.project_id<>p_project or old.question<>p_question then raise exception 'KG_CONFLICT';end if;return old.id;
end$$;
create function public.record_literature_search(p_project uuid,p_id uuid,p_query text,p_question uuid,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$declare c jsonb;old public.literature_searches;begin
 perform kg_private.require_owner(p_project,true);perform pg_advisory_xact_lock(hashtextextended(p_project::text,0));
 if p_payload is null or octet_length(p_payload::text)>524288 or jsonb_typeof(p_payload->'candidates') is distinct from 'array' or jsonb_typeof(p_payload->'providers') is distinct from 'array' or jsonb_array_length(p_payload->'candidates')>20 or jsonb_array_length(p_payload->'providers')>2 then raise exception 'KG_INVALID';end if;
 for c in select value from jsonb_array_elements(p_payload->'candidates') loop
  if not c ?& array['title','authors','journal','year','doi','semanticId','url','abstract','sources'] or exists(select 1 from jsonb_object_keys(c) k where k not in ('title','authors','journal','year','doi','semanticId','url','abstract','sources')) or exists(select 1 from jsonb_each(c) x where x.key not in ('year','sources') and jsonb_typeof(x.value)<>'string') or length(c->>'authors')>1000 or length(c->>'abstract')>2000 or length(c->>'doi')>1000 or length(c->>'semanticId')>255 or length(c->>'url')>2000 or (c->>'doi'='' and c->>'semanticId'='') or (c->>'doi'<>'' and c->>'doi' !~ '^10\.[0-9]{4,9}/[^[:space:]<>]+$') then raise exception 'KG_INVALID';end if;
  perform kg_private.validate_paper(c->>'title',c->>'journal',(c->>'year')::integer,'');
 end loop;
 insert into public.literature_searches values(p_id,p_project,p_question,p_query,p_payload,kg_private.caller_uid(),now()) on conflict(id) do nothing;
 select * into old from public.literature_searches where id=p_id;if not found or old.project_id<>p_project or old.query<>p_query or old.question_id is distinct from p_question then raise exception 'KG_CONFLICT';end if;return jsonb_build_object('id',old.id,'query',old.query,'question_id',old.question_id,'created_at',old.created_at,'payload',old.payload);
end$$;
create function public.set_acquisition_task(p_project uuid,p_id uuid,p_paper uuid,p_question uuid,p_expected integer,p_priority integer,p_status text,p_reason text) returns uuid language plpgsql security definer set search_path='' as $$declare old public.acquisition_tasks;begin
 perform pg_advisory_xact_lock(hashtextextended(p_project::text,0));perform kg_private.require_owner(p_project,true);
 if not exists(select 1 from public.papers where project_id=p_project and id=p_paper and archived_at is null) then raise exception 'KG_FORBIDDEN';end if;
 if p_expected=0 then
  insert into public.acquisition_tasks(id,project_id,paper_id,question_id,priority,status,reason,created_by) values(p_id,p_project,p_paper,p_question,p_priority,p_status,p_reason,kg_private.caller_uid()) on conflict do nothing;
  select * into old from public.acquisition_tasks where id=p_id;if not found or old.project_id<>p_project or old.paper_id<>p_paper or old.question_id is distinct from p_question or old.priority<>p_priority or old.status<>p_status or old.reason<>p_reason then raise exception 'KG_CONFLICT';end if;
 else
  update public.acquisition_tasks set priority=p_priority,status=p_status,reason=p_reason,revision=revision+1 where project_id=p_project and id=p_id and paper_id=p_paper and question_id is not distinct from p_question and revision=p_expected returning * into old;if not found then raise exception 'KG_CONFLICT';end if;
 end if;return old.id;
end$$;
create function public.select_literature_candidate(p_project uuid,p_id uuid,p_search uuid,p_index integer,p_reason text,p_priority integer) returns jsonb language plpgsql security definer set search_path='' as $$declare s public.literature_searches;old public.literature_selections;c jsonb;paper uuid;task uuid;linked uuid;identifier text;v_provider text;begin
 perform pg_advisory_xact_lock(hashtextextended(p_project::text,0));perform kg_private.require_owner(p_project,true);
 if p_index is null or p_index<0 or p_reason is null or length(btrim(p_reason)) not between 1 and 2000 or p_priority is null or p_priority not between 1 and 3 then raise exception 'KG_INVALID';end if;
 select * into old from public.literature_selections where id=p_id;if found then if old.project_id<>p_project or old.search_id<>p_search or old.candidate_index<>p_index or old.reason<>p_reason or old.priority<>p_priority then raise exception 'KG_CONFLICT';end if;return jsonb_build_object('paper_id',old.paper_id,'task_id',old.task_id);end if;
 select * into s from public.literature_searches where project_id=p_project and id=p_search;if not found or p_index>=jsonb_array_length(s.payload->'candidates') then raise exception 'KG_FORBIDDEN';end if;c=s.payload->'candidates'->p_index;
 foreach v_provider in array array['doi','semantic_scholar'] loop
  identifier=case when v_provider='doi' then lower(c->>'doi') else c->>'semanticId' end;if identifier<>'' then select paper_id into linked from public.paper_identifiers where project_id=p_project and paper_identifiers.provider=v_provider and normalized_value=identifier;if linked is not null then if paper is not null and paper<>linked then raise exception 'KG_CONFLICT';end if;paper=linked;end if;end if;
 end loop;
 if paper is not null and c->>'doi'<>'' and exists(select 1 from public.paper_identifiers where project_id=p_project and paper_id=paper and provider='doi' and normalized_value<>lower(c->>'doi')) then raise exception 'KG_CONFLICT';end if;
 if paper is null then
  paper=public.create_paper(p_project,p_id,c->>'title',c->>'journal',(c->>'year')::integer,'','');
  update public.papers set authors=c->>'authors',abstract=nullif(c->>'abstract',''),canonical_url=nullif(c->>'url',''),publication_status='unknown',revision=revision+1 where id=paper and project_id=p_project;
 elsif exists(select 1 from public.papers where id=paper and project_id=p_project and archived_at is not null) then raise exception 'KG_ARCHIVED';end if;
 foreach v_provider in array array['doi','semantic_scholar'] loop
  identifier=case when v_provider='doi' then lower(c->>'doi') else c->>'semanticId' end;if identifier<>'' then insert into public.paper_identifiers(project_id,paper_id,provider,raw_value,normalized_value,source,retrieved_at,created_by) values(p_project,paper,v_provider,identifier,identifier,'literature_search_unverified',s.created_at,kg_private.caller_uid()) on conflict(project_id,provider,normalized_value) do nothing;end if;
 end loop;
 select id into task from public.acquisition_tasks where project_id=p_project and paper_id=paper and question_id is not distinct from s.question_id;
 if task is null then task=public.set_acquisition_task(p_project,gen_random_uuid(),paper,s.question_id,0,p_priority,'needed',p_reason);end if;
 insert into public.literature_selections values(p_id,p_project,p_search,p_index,p_reason,p_priority,paper,task,kg_private.caller_uid(),now());return jsonb_build_object('paper_id',paper,'task_id',task);
end$$;
grant kg_literature_writer to current_user with inherit false,set true;
grant create on schema public to kg_literature_writer;
do $$declare f regprocedure;begin for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('create_research_question','record_literature_search','set_acquisition_task','select_literature_candidate') loop
 execute format('revoke all on function %s from public,anon,authenticated,service_role',f);execute format('grant execute on function %s to authenticated,kg_literature_writer',f);execute format('alter function %s owner to kg_literature_writer',f);end loop;end$$;
revoke create on schema public from kg_literature_writer;
grant kg_literature_writer to current_user with set false;
commit;
