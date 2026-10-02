import type {Bundle, Claim, Condition, Evidence, Reaction} from './contracts';
import {publishable,conditionIssue} from './contracts';
export type Filter = {key:string; dimension:string; basis:string; unit:string; min?:number; min_inclusive?:boolean; max?:number; max_inclusive?:boolean; terms?:string[]; only?:boolean};
export type Match = 'matched'|'excluded'|'unknown';
function conditionMatches(c:Condition, f:Filter):Match {
  if(conditionIssue(c)) return 'unknown';
  if(c.value_state==='not_applicable') return 'excluded';
  if(c.value_state!=='reported') return 'unknown';
  if(c.dimension!==f.dimension || c.basis!==f.basis || c.unit!==f.unit) return 'unknown';
  if(f.min!==undefined || f.max!==undefined) {
    if(c.kind!=='interval' || (f.min!==undefined&&c.lower===null) || (f.max!==undefined&&c.upper===null)) return 'unknown';
    const lower=f.min===undefined || c.lower!>f.min || (c.lower===f.min&&(f.min_inclusive!==false||!c.lower_inclusive));
    const upper=f.max===undefined || c.upper!<f.max || (c.upper===f.max&&(f.max_inclusive!==false||!c.upper_inclusive));
    return lower&&upper?'matched':'excluded';
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
  const originalGroups=new Map<string,Set<string>>();
  let independenceUnknown=false;
  for(const e of support) {
    if(e.origin_resolution_status!=='confirmed' || !e.independence_group_id || !e.original_experiment_id) { independenceUnknown=true; continue; }
    if(e.evidence_type==='adopted_from_prior_literature' && !input.evidence.some(parent=>e.dependency_ids.includes(parent.id) && parent.origin_resolution_status==='confirmed' && parent.original_experiment_id===e.original_experiment_id && parent.independence_group_id===e.independence_group_id)) { independenceUnknown=true; continue; }
    const set=originalGroups.get(e.original_experiment_id)??new Set<string>();
    set.add(e.independence_group_id); originalGroups.set(e.original_experiment_id,set);
  }
  const groups=new Set<string>();
  for(const set of originalGroups.values()) {
    if(set.size!==1) independenceUnknown=true;
    else groups.add([...set][0]);
  }
  return {line_style:style,support_evidence_ids:support.map(e=>e.id),refute_evidence_ids:refute.map(e=>e.id),unknown_evidence_ids:unknown.map(e=>e.id),excluded_count:excluded,unknown_count:unknown.length,conflict:support.length>0&&refute.length>0,unreviewed:[...support,...refute,...unknown].some(e=>e.review_state==='ai_generated'),confirmed_independent_groups:groups.size,independence_unknown:independenceUnknown,reason:!valid?'Reaction/claim is not publishable':`${style}: ${support.length} matching supports; ${refute.length} matching refutations; ${unknown.length} unknown`,filters,claim_scope:claim.scope,reaction_version_id:reaction.id,graph_data_version:'synthetic-contract-v0.1',participants:reaction.participants};
}
