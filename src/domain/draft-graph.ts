import type {CaseVersion} from './research-case';import {matchBundle,type Filter} from './graph';
export function draftProjection(v:CaseVersion,filters:Filter[],stage:'reaction'|'pretreatment'|'workup'|'analysis'='reaction'){
 const p=v.payload;const match=matchBundle({id:v.id,experiment_version_id:p.experiment.id,stage:p.experiment.stage,basis:'experiment',values:p.experiment.conditions},stage,filters);
 // A draft graph is an inventory of assertions, never the confirmed-support projection.
 return {match,line:match!=='matched'?'none' as const:p.evidence.stance==='supports'&&['proposed','adopted_from_prior_literature','speculative'].includes(p.evidence.evidence_type)?'dashed' as const:'dotted' as const,claimScope:p.claim.scope,evidenceType:p.evidence.evidence_type,stance:p.evidence.stance,reviewState:v.review_state,confirmation:v.confirmation};
}
