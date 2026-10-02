-- Local review proposal only; no automatic or hosted migration application.
begin;
create table public.literature_expansions(search_id uuid primary key,project_id uuid not null,seed_paper_id uuid not null,kind text not null check(kind in ('references','citations','related')),depth integer not null check(depth between 1 and 2),parent_search_id uuid,created_by uuid not null,created_at timestamptz not null default now(),unique(project_id,search_id),foreign key(project_id,search_id) references public.literature_searches(project_id,id),foreign key(project_id,seed_paper_id) references public.papers(project_id,id),foreign key(project_id,parent_search_id) references public.literature_expansions(project_id,search_id),id uuid generated always as(search_id) stored);
create table public.candidate_decisions(id uuid primary key,project_id uuid not null,search_id uuid not null,candidate_index integer not null,doi text not null,semantic_id text not null,decision text not null check(decision in ('rejected','reopened')),reason text not null check(length(btrim(reason)) between 1 and 2000),revision integer not null,created_by uuid not null,created_at timestamptz not null default now(),unique(project_id,revision),foreign key(project_id,search_id) references public.literature_searches(project_id,id));
create table public.paper_relations(id uuid primary key,project_id uuid not null,source_paper_id uuid not null,target_paper_id uuid not null,relation text not null check(relation in ('cites','related_to')),search_id uuid not null,candidate_index integer not null,providers jsonb not null,created_by uuid not null,created_at timestamptz not null default now(),foreign key(project_id,source_paper_id) references public.papers(project_id,id),foreign key(project_id,target_paper_id) references public.papers(project_id,id),foreign key(project_id,search_id) references public.literature_searches(project_id,id),check(source_paper_id<>target_paper_id));
do $$declare t text;begin foreach t in array array['literature_expansions','candidate_decisions','paper_relations'] loop
 execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);execute format('grant select on public.%I to authenticated,kg_literature_writer',t);execute format('grant insert on public.%I to kg_literature_writer',t);
 execute format('create policy owner_read on public.%I for select to authenticated,kg_literature_writer using(kg_private.has_role(project_id,array[''owner'']))',t);
 execute format('create policy owner_insert on public.%I for insert to kg_literature_writer with check(created_by=kg_private.caller_uid() and kg_private.has_role(project_id,array[''owner'']))',t);
 execute format('create trigger immutable_record before update or delete on public.%I for each row execute function kg_private.reject_mutation()',t);execute format('create trigger audit_change after insert on public.%I for each row execute function kg_private.capture_audit()',t);
end loop;end$$;
create function public.record_literature_expansion(p_project uuid,p_id uuid,p_seed uuid,p_kind text,p_parent uuid,p_question uuid,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$declare old public.literature_expansions;parent public.literature_expansions;depth integer:=1;r jsonb;provider jsonb;begin
 perform kg_private.require_owner(p_project,true);perform pg_advisory_xact_lock(hashtextextended(p_project::text,0));
 if p_kind is null or p_kind not in ('references','citations','related') then raise exception 'KG_INVALID';end if;
 select * into old from public.literature_expansions where search_id=p_id;
 if found then if old.project_id<>p_project or old.seed_paper_id<>p_seed or old.kind<>p_kind or old.parent_search_id is distinct from p_parent then raise exception 'KG_CONFLICT';end if;
 if (select question_id from public.literature_searches where project_id=p_project and id=p_id) is distinct from p_question then raise exception 'KG_CONFLICT';end if;
 return (select jsonb_build_object('id',id,'query',query,'question_id',question_id,'created_at',created_at,'payload',payload) from public.literature_searches where project_id=p_project and id=p_id);end if;
 if not exists(select from public.papers where project_id=p_project and id=p_seed and archived_at is null) then raise exception 'KG_FORBIDDEN';end if;
 if p_parent is not null then
 select * into parent from public.literature_expansions where project_id=p_project and search_id=p_parent;
 if not found or parent.depth>=2 or not exists(select from public.literature_selections where project_id=p_project and search_id=p_parent and paper_id=p_seed) then raise exception 'KG_INVALID';end if;depth=parent.depth+1;end if;
 if exists(select from public.literature_searches where id=p_id) then raise exception 'KG_CONFLICT';end if;
 r=public.record_literature_search(p_project,p_id,p_kind||':'||p_seed::text,p_question,p_payload);
 for provider in select value from jsonb_array_elements(p_payload->'providers') loop
 if jsonb_typeof(provider->'items') is distinct from 'array' or jsonb_array_length(provider->'items')>10 then raise exception 'KG_INVALID';end if;
 end loop;
 insert into public.literature_expansions values(p_id,p_project,p_seed,p_kind,depth,p_parent,kg_private.caller_uid(),now());return r;
end$$;
create function public.decide_literature_candidate(p_project uuid,p_id uuid,p_search uuid,p_index integer,p_expected uuid,p_decision text,p_reason text) returns uuid language plpgsql security definer set search_path='' as $$declare c jsonb;old public.candidate_decisions;latest public.candidate_decisions;rev integer;begin
 perform kg_private.require_owner(p_project,true);perform pg_advisory_xact_lock(hashtextextended(p_project::text,0));
 if p_decision is null or p_decision not in ('rejected','reopened') or p_reason is null or length(btrim(p_reason)) not between 1 and 2000 or p_index is null or p_index<0 then raise exception 'KG_INVALID';end if;
 select * into old from public.candidate_decisions where id=p_id;if found then if old.project_id<>p_project or old.search_id<>p_search or old.candidate_index<>p_index or old.decision<>p_decision or old.reason<>p_reason then raise exception 'KG_CONFLICT';end if;return old.id;end if;
 select payload->'candidates'->p_index into c from public.literature_searches where project_id=p_project and id=p_search;
 if c is null then raise exception 'KG_FORBIDDEN';end if;
 select * into latest from public.candidate_decisions where project_id=p_project and ((c->>'doi'<>'' and doi=lower(c->>'doi')) or (c->>'semanticId'<>'' and semantic_id=c->>'semanticId' and not(doi<>'' and c->>'doi'<>'' and doi<>lower(c->>'doi')))) order by revision desc limit 1;
 if latest.id is distinct from p_expected then raise exception 'KG_CONFLICT';end if;
 if p_decision='reopened' and latest.decision is distinct from 'rejected' then raise exception 'KG_INVALID';end if;
 select coalesce(max(revision),0)+1 into rev from public.candidate_decisions where project_id=p_project;
 insert into public.candidate_decisions values(p_id,p_project,p_search,p_index,lower(c->>'doi'),c->>'semanticId',p_decision,p_reason,rev,kg_private.caller_uid(),now());return p_id;
end$$;
grant update(relevance) on public.papers to kg_literature_writer;
create function public.edit_paper_details(p_project uuid,p_paper uuid,p_expected integer,p_authors text,p_abstract text,p_url text,p_relevance text) returns uuid language plpgsql security definer set search_path='' as $$begin
 perform kg_private.require_owner(p_project,true);
 if p_authors is null or length(p_authors)>1000 or p_abstract is null or length(p_abstract)>20000 or p_url is null or length(p_url)>2000 or (p_url<>'' and p_url !~ '^https?://[^/@?#[:space:]]+([/?#][^[:space:]]*)?$') or p_relevance is null or length(p_relevance)>4000 then raise exception 'KG_INVALID';end if;
 update public.papers set authors=p_authors,abstract=nullif(p_abstract,''),canonical_url=nullif(p_url,''),relevance=nullif(p_relevance,''),revision=revision+1 where project_id=p_project and id=p_paper and revision=p_expected and archived_at is null;
 if not found then raise exception 'KG_CONFLICT';end if;return p_paper;
end$$;
grant kg_literature_writer to current_user with inherit false,set true;
grant create on schema public to kg_literature_writer;
do $$declare f regprocedure;begin for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('record_literature_expansion','decide_literature_candidate','edit_paper_details') loop
 execute format('revoke all on function %s from public,anon,authenticated,service_role',f);execute format('grant execute on function %s to authenticated,kg_literature_writer',f);execute format('alter function %s owner to kg_literature_writer',f);end loop;end$$;
-- Selection function replacement is generated below; existing grants/owner are retained.
set local role kg_literature_writer;
create or replace function public.select_literature_candidate(p_project uuid,p_id uuid,p_search uuid,p_index integer,p_reason text,p_priority integer) returns jsonb language plpgsql security definer set search_path='' as $$declare s public.literature_searches;old public.literature_selections;c jsonb;paper uuid;task uuid;linked uuid;identifier text;v_provider text;e public.literature_expansions;blocked text;begin
 perform pg_advisory_xact_lock(hashtextextended(p_project::text,0));perform kg_private.require_owner(p_project,true);
 if p_index is null or p_index<0 or p_reason is null or length(btrim(p_reason)) not between 1 and 2000 or p_priority is null or p_priority not between 1 and 3 then raise exception 'KG_INVALID';end if;
 select * into old from public.literature_selections where id=p_id;if found then if old.project_id<>p_project or old.search_id<>p_search or old.candidate_index<>p_index or old.reason<>p_reason or old.priority<>p_priority then raise exception 'KG_CONFLICT';end if;return jsonb_build_object('paper_id',old.paper_id,'task_id',old.task_id);end if;
 select * into s from public.literature_searches where project_id=p_project and id=p_search;if not found or p_index>=jsonb_array_length(s.payload->'candidates') then raise exception 'KG_FORBIDDEN';end if;c=s.payload->'candidates'->p_index;
 select decision into blocked from public.candidate_decisions where project_id=p_project and ((c->>'doi'<>'' and doi=lower(c->>'doi')) or (c->>'semanticId'<>'' and semantic_id=c->>'semanticId' and not(doi<>'' and c->>'doi'<>'' and doi<>lower(c->>'doi')))) order by revision desc limit 1;if blocked='rejected' then raise exception 'KG_REJECTED';end if;
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
 insert into public.literature_selections values(p_id,p_project,p_search,p_index,p_reason,p_priority,paper,task,kg_private.caller_uid(),now());
 select * into e from public.literature_expansions where project_id=p_project and search_id=p_search;if found and e.seed_paper_id<>paper then insert into public.paper_relations values(p_id,p_project,case when e.kind='citations' then paper else e.seed_paper_id end,case when e.kind='citations' then e.seed_paper_id else paper end,case when e.kind='related' then 'related_to' else 'cites' end,p_search,p_index,c->'sources',kg_private.caller_uid(),now());end if;return jsonb_build_object('paper_id',paper,'task_id',task);
end$$;
reset role;
revoke create on schema public from kg_literature_writer;
grant kg_literature_writer to current_user with set false;
commit;
