import { z } from 'zod';
const id = z.string().min(1);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const scope = z.enum(['product_presence','net_conversion','intermediate_presence','elementary_mechanism','pathway','order_of_steps']);
export const compoundSchema = z.strictObject({id, name:z.string(), node_type:z.enum(['discrete_molecule','intermediate','polymer','polymer_site','mixture','class']), structure_scope:z.string(), epistemic_status:z.enum(['observed','hypothetical','unspecified'])});
export const reactionSchema = z.strictObject({id, representation_scope:z.enum(['net_conversion','elementary_step','pathway_segment']), equation_balance_status:z.enum(['checked','unchecked','not_applicable','unknown']), product_inventory_status:z.enum(['complete','partial','unknown']), participants:z.array(z.strictObject({compound_version_id:id, role:z.enum(['reactant','product','formal_auxiliary']), coefficient:z.number().positive().nullable(), primary_for_display:z.boolean()})).min(2)});
export const claimSchema = z.strictObject({id, reaction_version_id:id, scope, proposition:z.string().min(1)});
export const conditionSchema = z.strictObject({
  key:id, dimension:id, basis:id, unit:z.string(), value_state:z.enum(['reported','not_reported','unknown','not_applicable','ambiguous']),
  kind:z.enum(['interval','controlled_term','composition']), lower:z.number().finite().nullable(), upper:z.number().finite().nullable(), lower_inclusive:z.boolean(), upper_inclusive:z.boolean(),
  terms:z.array(z.string()), inventory_complete:z.boolean(), raw_value_text:z.string(), raw_unit:z.string(), derivation:z.enum(['reported','calculated']), calculation:z.string().nullable()
});
export const bundleSchema = z.strictObject({id, experiment_version_id:id.nullable(), stage:z.enum(['reaction','pretreatment','workup','analysis']), basis:z.enum(['experiment','reported_applicability']), values:z.array(conditionSchema)});
export const evidenceSchema = z.strictObject({
  id, claim_id:id, reporting_paper_id:id, condition_bundle_id:id.nullable(), original_experiment_id:id.nullable(), independence_group_id:id.nullable(), origin_resolution_status:z.enum(['confirmed','unresolved']),
  stance:z.enum(['supports','refutes','inconclusive']), evidence_type:z.enum(['directly_observed','strongly_supported','proposed','adopted_from_prior_literature','speculative']),
  strength_assessment:z.enum(['high','medium','low','unassessed']), current_assertion_status:z.enum(['active','superseded','withdrawn']), measured_scope:scope.nullable(), strength_rationale:z.string().min(1), review_state:z.enum(['ai_generated','human_reviewed','human_corrected']),
  epistemic_origin:z.enum(['experiment_report','authors_interpretation','cited_interpretation','analyst_inference']), source_access:z.enum(['fulltext','abstract_only','secondary_only','unavailable']), extraction_confidence:z.number().min(0).max(1).nullable(),
  source_anchor_ids:z.array(id).min(1), dependency_ids:z.array(id), alternatives_tested:z.array(z.string()), limitations:z.array(z.string())
});
export const analysisSchema = z.strictObject({
  schema_version:z.literal('0.1.0'), project_id:z.uuid(), paper_id:z.uuid(), input_document_sha256:hash,
  analysis_run:z.strictObject({id, adapter:z.literal('dot_manual_json'), protocol_version:id, created_at:z.iso.datetime()}),
  studies:z.array(z.strictObject({id, origin_paper_id:z.uuid().nullable(), independence_group_id:id.nullable(), source_status:z.enum(['original','secondary_report','unresolved'])})),
  experiments:z.array(z.strictObject({id, study_id:id, original_experiment_id:id, source_anchor_id:id})),
  compounds:z.array(compoundSchema), reactions:z.array(reactionSchema), claims:z.array(claimSchema), condition_bundles:z.array(bundleSchema),
  anchors:z.array(z.strictObject({id, paper_document_id:z.uuid(), document_sha256:hash, physical_page_start:z.number().int().positive(), physical_page_end:z.number().int().positive(), passage:z.string().min(1), passage_hash:hash})),
  evidence:z.array(evidenceSchema.extend({review_state:z.literal('ai_generated')})),
  uncertainties:z.array(z.string()), research_question_candidates:z.array(z.string())
});
export type Reaction = z.infer<typeof reactionSchema>;
export type Claim = z.infer<typeof claimSchema>;
export type Condition = z.infer<typeof conditionSchema>;
export type Bundle = z.infer<typeof bundleSchema>;
export type Evidence = z.infer<typeof evidenceSchema>;
export type Analysis = z.infer<typeof analysisSchema>;
export function publishable(reaction:Reaction) { return reaction.participants.some(p=>p.role==='reactant') && reaction.participants.some(p=>p.role==='product'); }
export function sameSpecies(a:z.infer<typeof compoundSchema>, b:z.infer<typeof compoundSchema>) { return a.id===b.id && a.node_type===b.node_type && a.structure_scope===b.structure_scope; }

// Shared semantic guard: callers cannot turn malformed condition shapes into matches.
export function conditionIssue(c:Condition):string|undefined {
  if(c.value_state!=='reported') {
    if(c.lower!==null || c.upper!==null || c.terms.length) return 'Unknown condition contains asserted value';
    return;
  }
  if(c.kind==='interval') {
    if(c.terms.length || (c.lower===null && c.upper===null)) return 'Invalid interval shape';
    if(c.lower!==null && c.upper!==null && (c.lower>c.upper || (c.lower===c.upper && (!c.lower_inclusive || !c.upper_inclusive)))) return 'Invalid interval';
  } else if(c.lower!==null || c.upper!==null || !c.terms.length) return 'Invalid categorical condition shape';
  if(c.derivation==='calculated' && !c.calculation?.trim()) return 'Missing calculation provenance';
}
