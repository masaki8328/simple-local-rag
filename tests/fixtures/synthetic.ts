// ALL records and passages in this file are fabricated software test data, not chemistry claims.
import type {Analysis, Bundle, Condition, Evidence} from '../../src/domain/contracts';
import {digest} from '../../src/domain/import';
export const project='11111111-1111-4111-8111-111111111111';
export const paper='22222222-2222-4222-8222-222222222222';
export const document='33333333-3333-4333-8333-333333333333';
export const pdfHash='a'.repeat(64);
export const temperature=(lower:number|null,upper=lower):Condition=>({key:'temperature',dimension:'temperature',basis:'reaction_bulk',unit:'degC',value_state:lower===null?'unknown':'reported',kind:'interval',lower,upper,lower_inclusive:true,upper_inclusive:true,terms:[],inventory_complete:false,raw_value_text:lower===null?'SYNTHETIC unknown':`SYNTHETIC ${lower}–${upper}`,raw_unit:'degC',derivation:'reported',calculation:null});
export const bundle=(id:string,temp:number):Bundle=>({id,experiment_version_id:`experiment-${id}`,stage:'reaction',basis:'experiment',values:[temperature(temp)]});
export const evidence=(id:string,bundleId:string,type:Evidence['evidence_type']='proposed'):Evidence=>({id,claim_id:'claim-net',reporting_paper_id:paper,condition_bundle_id:bundleId,original_experiment_id:`original-${bundleId}`,independence_group_id:`group-${bundleId}`,origin_resolution_status:'confirmed',stance:'supports',evidence_type:type,strength_assessment:'unassessed',current_assertion_status:'active',measured_scope:'net_conversion',strength_rationale:'SYNTHETIC test rationale',review_state:'ai_generated',epistemic_origin:'experiment_report',source_access:'fulltext',extraction_confidence:0.9,source_anchor_ids:['anchor-1'],dependency_ids:[],alternatives_tested:['SYNTHETIC alternative'],limitations:['SYNTHETIC method limit']});
const passage='SYNTHETIC TEST PASSAGE. No real research finding.';
export function fixture():Analysis { return {
 schema_version:'0.1.0',project_id:project,paper_id:paper,input_document_sha256:pdfHash,
 analysis_run:{id:'run-1',adapter:'dot_manual_json',protocol_version:'synthetic-0.1',created_at:'2026-10-02T00:00:00Z'},
 studies:['hot','cool'].map(id=>({id:`study-${id}`,origin_paper_id:paper,independence_group_id:`group-${id}`,source_status:'original'})),
 experiments:['hot','cool'].map(id=>({id:`experiment-${id}`,study_id:`study-${id}`,original_experiment_id:`original-${id}`,source_anchor_id:'anchor-1'})),
 compounds:['feed-a','feed-b','product-a','coproduct-h2'].map(id=>({id,name:`SYNTHETIC ${id}`,node_type:'discrete_molecule',structure_scope:'free_species',epistemic_status:'unspecified'})),
 reactions:[{id:'reaction-1',representation_scope:'net_conversion',equation_balance_status:'unchecked',product_inventory_status:'partial',participants:['feed-a','feed-b','product-a','coproduct-h2'].map((id,i)=>({compound_version_id:id,role:i<2?'reactant':'product',coefficient:null,primary_for_display:i===0||i===2}))}],
 claims:[{id:'claim-net',reaction_version_id:'reaction-1',scope:'net_conversion',proposition:'SYNTHETIC net conversion only'}],
 condition_bundles:[bundle('hot',150),bundle('cool',100)],
 anchors:[{id:'anchor-1',paper_document_id:document,document_sha256:pdfHash,physical_page_start:1,physical_page_end:1,passage,passage_hash:digest(passage)}],
 evidence:[evidence('strong-hot','hot','strongly_supported'),evidence('proposal-cool','cool')].map(e=>({...e,review_state:'ai_generated'})),uncertainties:['SYNTHETIC data only'],research_question_candidates:[]
}; }
export const target={project_id:project,paper_id:paper,document_sha256:pdfHash,paper_document_id:document};
export const lowTemperature={key:'temperature',dimension:'temperature',basis:'reaction_bulk',unit:'degC',max:120};
