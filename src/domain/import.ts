import {createHash} from 'node:crypto';
import {analysisSchema, type Analysis, publishable, conditionIssue} from './contracts';
export function digest(text:string) {return createHash('sha256').update(text).digest('hex');}
export function validateAnalysis(raw:unknown, target:{project_id:string;paper_id:string;document_sha256:string;paper_document_id:string}):Analysis {
  const a=analysisSchema.parse(raw);
  if(a.project_id!==target.project_id || a.paper_id!==target.paper_id || a.input_document_sha256!==target.document_sha256) throw Error('Analysis target mismatch');
  const ids=new Set<string>();
  for(const item of [...a.studies,...a.experiments,...a.compounds,...a.reactions,...a.claims,...a.condition_bundles,...a.anchors,...a.evidence]) {if(ids.has(item.id)) throw Error('Duplicate local ID'); ids.add(item.id);}
  for(const r of a.reactions) {
    if(!publishable(r)) throw Error('Missing reaction participants');
    for(const p of r.participants) if(!a.compounds.some(c=>c.id===p.compound_version_id)) throw Error('Unresolved compound');
  }
  for(const c of a.claims) if(!a.reactions.some(r=>r.id===c.reaction_version_id)) throw Error('Unresolved reaction');
  for(const e of a.experiments) if(!a.studies.some(s=>s.id===e.study_id)||!a.anchors.some(x=>x.id===e.source_anchor_id)) throw Error('Unresolved experiment provenance');
  const originalGroups=new Map<string,string>();
  for(const experiment of a.experiments) {
    const group=a.studies.find(s=>s.id===experiment.study_id)!.independence_group_id;
    if(group) {
      const previous=originalGroups.get(experiment.original_experiment_id);
      if(previous && previous!==group) throw Error('One original experiment cannot have conflicting independence groups');
      originalGroups.set(experiment.original_experiment_id,group);
    }
  }
  for(const b of a.condition_bundles) {
    if(b.experiment_version_id&&!a.experiments.some(e=>e.id===b.experiment_version_id)) throw Error('Unresolved experiment');
    if((b.basis==='experiment')!==(b.experiment_version_id!==null)) throw Error('Experiment/applicability mismatch');
    for(const c of b.values) {
      const issue=conditionIssue(c);
      if(issue) throw Error(issue);
    }
  }
  for(const anchor of a.anchors) if(anchor.document_sha256!==target.document_sha256 || anchor.paper_document_id!==target.paper_document_id || anchor.physical_page_end<anchor.physical_page_start || digest(anchor.passage)!==anchor.passage_hash) throw Error('Invalid anchor provenance');
  for(const e of a.evidence) {
    const claim=a.claims.find(c=>c.id===e.claim_id);
    if(!claim || e.reporting_paper_id!==a.paper_id || e.source_anchor_ids.some(id=>!a.anchors.some(x=>x.id===id)) || (e.condition_bundle_id&&!a.condition_bundles.some(b=>b.id===e.condition_bundle_id)) || e.dependency_ids.some(id=>!a.evidence.some(x=>x.id===id))) throw Error('Unresolved evidence reference');
    const bundle=a.condition_bundles.find(b=>b.id===e.condition_bundle_id);
    const experiment=a.experiments.find(x=>x.id===bundle?.experiment_version_id);
    const study=a.studies.find(s=>s.id===experiment?.study_id);
    if(experiment && (e.original_experiment_id!==experiment.original_experiment_id || e.independence_group_id!==study?.independence_group_id)) throw Error('Evidence experiment identity mismatch');
    if(!experiment && e.original_experiment_id) throw Error('Unresolved original experiment');
    if(e.origin_resolution_status==='confirmed' && (!study || study.source_status==='unresolved' || !study.independence_group_id)) throw Error('Unresolved study cannot assert confirmed origin');
    if(e.evidence_type==='directly_observed' && e.measured_scope!==claim.scope) throw Error('Observation cannot prove another claim scope');
    if(e.evidence_type==='strongly_supported' && (!e.alternatives_tested.length||!e.limitations.length)) throw Error('Strong support requires alternatives and limitations');
    if(e.evidence_type==='adopted_from_prior_literature' && e.origin_resolution_status==='confirmed') {
      const resolvedParent=a.evidence.some(parent=>e.dependency_ids.includes(parent.id) && parent.origin_resolution_status==='confirmed' && parent.original_experiment_id===e.original_experiment_id && parent.independence_group_id===e.independence_group_id);
      if(!resolvedParent) throw Error('Resolved adoption requires dependency with matching original experiment and independence group');
    }
  }
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
  return a;
}
// Pure staging plan only. No database writes or automatic application of corrections.
export function planImport(input:{key:string; content:string; prior?:{key:string;hash:string}; humanCorrectedIds?:string[]}) {
  const hash=digest(input.content);
  if(input.prior?.key===input.key) {
    if(input.prior.hash!==hash) throw Error('409: idempotency key reused with different content');
    return {action:'replay',hash,conflicts:[]};
  }
  return {action:'stage',hash,conflicts:(input.humanCorrectedIds??[]).map(id=>({id,action:'propose_revision',overwrite:false}))};
}
export function parseAnalysisJson(text:string,target:Parameters<typeof validateAnalysis>[1]):Analysis {
  if(Buffer.byteLength(text,'utf8')>1_048_576) throw Error('Analysis JSON exceeds Phase 1 limit of 1 MiB');
  return validateAnalysis(JSON.parse(text),target);
}
