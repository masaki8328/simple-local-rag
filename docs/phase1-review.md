# Phase 1 critical review — 2026-10-02

Independent reviewer: delegated `phase1_review` agent, read-only review and adversarial domain repro. Parent: implementation review, fixes and test reruns. No hosted credentials or services were used. Phase 2 has not started. Independent follow-up verified all reported domain fixes and independently ran 43 passing tests; parent additionally tested inherited SQL grants.

## Substantive findings and corrections

| Finding | Impact before correction | Resolution |
|---|---|---|
| Inherited explicit function grants survived PUBLIC-only revoke | Database defaults could leave unintended callable-function ACLs | Reproduced a failing catalog assertion under adversarial defaults; migration now revokes PUBLIC/anon/authenticated before narrow regrants. Identity guard already rejected unauthenticated project creation |
| Same original experiment assigned multiple independence groups | Repeated reports could count as independent experiments | Import rejects inconsistent non-null groups across experiment records; classifier treats conflicting groups for one original ID as unresolved instead of double counting |
| Adopted citation invented a distinct original experiment | A citation could resolve to a dependency yet count as a new independent experiment | Confirmed adoption now requires matching original experiment/group in resolved dependency; classifier marks unmatched origin unknown |
| Self/circular evidence dependency | Adoption could cite itself or circular records as provenance | Import topological validation rejects cycles; separate self and two-record regressions |
| Unresolved study asserted as confirmed evidence origin | Unknown original-study identity could inflate confirmed counts | Import requires resolved study and group before confirmed origin |
| Malformed condition representation accepted by direct classifier | Reversed intervals or mixed numeric/categorical fields could produce false matches | Shared conditionIssue rejects import and yields unknown for direct matching |
| Unknown-condition AI evidence lacked unreviewed badge | Unknown display could conceal pending human review | Badge now includes unknown evidence independently of line style |

No authenticated C1 privilege-escalation path was found in the independent code review. SQL function ACL revokes were hardened against explicit inherited defaults and challenged with additional real PostgreSQL tests. These adversarial defaults are a local test condition, not a claim about a hosted configuration. Administrators able to disable triggers/change roles remain outside these protections. This does not certify hosted Supabase Auth/JWT/API or Storage access.

## Adversarial evidence

43 domain tests and 45 PostgreSQL assertions pass. An independent follow-up review caught the adopted-citation variant and it was fixed with both rejection and valid-adoption regression tests. Explicit adversarial coverage includes: owner_user_id change by the owner; takeover by a nonmember; self-joining another project; self-promoting membership; grants and empty definer search paths; both forged human review states and extra nested review/verification fields; source-anchor update/delete; asset hash/path/delete and linked-PDF retargeting; privileged immutable-trigger checks; cross-tenant FK checks; exact UTF-8 passage hash; original PDF edition preserved after a new edition. Build/typecheck/two production HTTP checks pass. See verification.md for commands and limits.

## 1. Identity-bound RLS helper and atomic project bootstrap (exact SQL)

```sql
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
```

Owner and tenant identity guard (exact SQL):

```sql
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
```

Table privileges and policies (exact SQL). Direct project/member inserts and member updates receive no grants; only create_project can bootstrap owner membership:

```sql
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
```

## 2. Tenant references and immutable provenance (exact SQL fragments)

```sql
 foreign key(project_id,paper_id) references public.papers(project_id,id)
 check(storage_path=project_id::text || '/' || id::text || '/original.pdf'),
 foreign key(project_id,paper_id) references public.papers(project_id,id),
 foreign key(project_id,document_asset_id) references public.document_assets(project_id,id)
 check(passage_hash=encode(sha256(convert_to(verbatim_passage,'UTF8')),'hex')),
 foreign key(project_id,paper_document_id) references public.paper_documents(project_id,id),
 foreign key(project_id,supersedes_anchor_id) references public.source_anchors(project_id,id)
```

Every referenced research parent has UNIQUE(project_id,id). No scientific FK has CASCADE DELETE. Immutable triggers use this function (exact SQL):

```sql
create function kg_private.reject_mutation() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Immutable provenance: append a new record' using errcode='23514'; end; $$;
```

The immutable trigger loop above covers document_assets, paper_documents and source_anchors. Thus a new PDF edition adds a new link; it cannot retarget an old anchor. These are metadata guards; actual private object bytes and signed URLs are unimplemented.

## 3. Same-bundle filtering, claim/stance and line style (exact TypeScript)

```ts
function conditionMatches(c:Condition, f:Filter):Match {
  if(conditionIssue(c)) return 'unknown';
  if(c.value_state==='not_applicable') return 'excluded';
  if(c.value_state!=='reported') return 'unknown';
  if(c.dimension!==f.dimension || c.basis!==f.basis || c.unit!==f.unit) return 'unknown';
  if(f.max!==undefined) {
    if(c.kind!=='interval' || c.upper===null) return 'unknown';
    return c.upper<f.max || (c.upper===f.max && (f.max_inclusive!==false || !c.upper_inclusive)) ? 'matched':'excluded';
  }
  if(f.terms) {
    if(c.kind==='interval') return 'unknown';
    if(f.only && !c.inventory_complete) return 'unknown';
    return f.terms.every(t=>c.terms.includes(t)) && (!f.only || c.terms.every(t=>f.terms!.includes(t))) ? 'matched':'excluded';
  }
  return 'unknown';
}
export function matchBundle(bundle:Bundle|undefined, stage:Bundle['stage'], filters:Filter[]):Match {
  if(!filters.length) return 'matched';
  if(!bundle || bundle.stage!==stage) return 'unknown';
  const results=filters.map(f=>{
    const values=bundle.values.filter(c=>c.key===f.key);
    // Repeated unresolved values must not silently become a favorable match.
    return values.length===1 ? conditionMatches(values[0],f) : 'unknown';
  });
  return results.includes('excluded')?'excluded':results.includes('unknown')?'unknown':'matched';
}
export function classifyGraph(input:{reaction:Reaction; claim:Claim; evidence:Evidence[]; bundles:Bundle[]; filters:Filter[]; stage?:Bundle['stage']; reviewedOnly?:boolean; includeUnknown?:boolean; showRefutations?:boolean}) {
  const {reaction,claim,filters}=input;
  const support:Evidence[]=[], refute:Evidence[]=[], unknown:Evidence[]=[];
  let excluded=0;
  for(const e of input.evidence) {
    if(e.current_assertion_status!=='active' || e.claim_id!==claim.id || (input.reviewedOnly && e.review_state==='ai_generated')) { excluded++; continue; }
    const match=matchBundle(input.bundles.find(b=>b.id===e.condition_bundle_id),input.stage??'reaction',filters);
    if(match==='unknown') {unknown.push(e);continue;}
    if(match==='excluded') {excluded++;continue;}
    if(e.stance==='supports') support.push(e);
    if(e.stance==='refutes') refute.push(e);
  }
  const strong=support.some(e=>{
    const bundle=input.bundles.find(b=>b.id===e.condition_bundle_id);
    return e.source_access==='fulltext' && e.original_experiment_id!==null && bundle?.basis==='experiment' && bundle.experiment_version_id!==null &&
      e.epistemic_origin!=='analyst_inference' &&
      ((e.evidence_type==='directly_observed' && e.measured_scope===claim.scope) ||
       (e.evidence_type==='strongly_supported' && e.alternatives_tested.length>0 && e.limitations.length>0));
  });
  const weak=support.some(e=>['proposed','adopted_from_prior_literature','speculative'].includes(e.evidence_type));
  const valid=publishable(reaction) && claim.reaction_version_id===reaction.id;
  const style=!valid?'hidden':strong?'solid':weak?'dashed':refute.length&&input.showRefutations?'refuted':unknown.length&&input.includeUnknown?'unknown':'hidden';
```

The strong-support branch iterates only supports. Refutation never yields a positive solid edge. Evidence must match the exact claim ID, and direct observations additionally match its scope. All requested filters operate on one evidence-linked bundle and requested stage. A reported interval must fit entirely under the temperature ceiling; mismatched/unknown units, basis or missing values are not matches. Empty filter lists intentionally impose no condition restriction.

## 4. AI review boundary (exact TypeScript fragments)

```ts
export const analysisSchema = z.strictObject({
  evidence:z.array(evidenceSchema.extend({review_state:z.literal('ai_generated')})),
```

These are two separate source fragments: analysisSchema and all nested schemas use strict objects. The general domain evidence type permits human states, while analysis JSON overrides that field with the literal ai_generated. Semantic validation begins with the strict parser:

```ts
  const a=analysisSchema.parse(raw);
```

Original-study and circular-provenance corrections (exact TypeScript):

```ts
  const originalGroups=new Map<string,string>();
  for(const experiment of a.experiments) {
    const group=a.studies.find(s=>s.id===experiment.study_id)!.independence_group_id;
    if(group) {
      const previous=originalGroups.get(experiment.original_experiment_id);
      if(previous && previous!==group) throw Error('One original experiment cannot have conflicting independence groups');
      originalGroups.set(experiment.original_experiment_id,group);
    }
  }
    if(e.origin_resolution_status==='confirmed' && (!study || study.source_status==='unresolved' || !study.independence_group_id)) throw Error('Unresolved study cannot assert confirmed origin');
  // Acyclic provenance: existence alone would allow self-citation or mutual citation.
  const pending=new Map(a.evidence.map(e=>[e.id,e.dependency_ids.length]));
  const dependents=new Map<string,string[]>();
  for(const e of a.evidence) for(const parent of e.dependency_ids) {
    const children=dependents.get(parent)??[];
    children.push(e.id); dependents.set(parent,children);
  }
  const ready=a.evidence.filter(e=>!e.dependency_ids.length).map(e=>e.id);
  let visited=0;
  while(ready.length) {
    const id=ready.pop()!; visited++;
    for(const child of dependents.get(id)??[]) {
      const remaining=pending.get(child)!-1; pending.set(child,remaining);
      if(remaining===0) ready.push(child);
    }
  }
  if(visited!==a.evidence.length) throw Error('Cyclic evidence dependency');
```

Resolved adoption identity guard (exact TypeScript):

```ts
    if(e.evidence_type==='adopted_from_prior_literature' && e.origin_resolution_status==='confirmed') {
      const resolvedParent=a.evidence.some(parent=>e.dependency_ids.includes(parent.id) && parent.origin_resolution_status==='confirmed' && parent.original_experiment_id===e.original_experiment_id && parent.independence_group_id===e.independence_group_id);
      if(!resolvedParent) throw Error('Resolved adoption requires dependency with matching original experiment and independence group');
    }
```

## 5. Recovery proof and local milestone

Recovery source: `71809f49637f5a43bd666ef9a17db962d1ad316b`. `python scripts/verify-recovery.py` extracted each of the seven removed/replaced blobs into an automatically removed temporary directory and verified `git hash-object` equals the historical blob ID. All seven passed, including the original README and nutrition PDF. Nothing was restored over the new application.

Exact recovery command for a chosen original path (overwrites that path; do not run over wanted new work):

```sh
git restore --source=71809f49637f5a43bd666ef9a17db962d1ad316b -- <exact-original-path>
```

The local milestone commit is reported with its actual hash only after commit succeeds and git status is checked. No push, PR, hosted migration, credentials or deployment occurred. Wait for PM review before the user-scoped DAL/project-paper phase.
