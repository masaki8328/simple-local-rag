import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {z} from 'zod';
import {analysisSchema,publishable,sameSpecies} from '../src/domain/contracts';
import {classifyGraph,matchBundle} from '../src/domain/graph';
import {digest,planImport,validateAnalysis,parseAnalysisJson} from '../src/domain/import';
import {fixture,target,lowTemperature,temperature,bundle,evidence} from './fixtures/synthetic';
const input=()=>{const a=fixture();return {reaction:a.reactions[0],claim:a.claims[0],evidence:a.evidence,bundles:a.condition_bundles,filters:[lowTemperature]};};
test('valid synthetic analysis and generated JSON contract agree',()=>{assert.equal(validateAnalysis(fixture(),target).schema_version,'0.1.0');assert.deepEqual(JSON.parse(readFileSync('contracts/analysis-v0.1.schema.json','utf8')),z.toJSONSchema(analysisSchema));});
test('multiple reactants/products and unknown coefficients survive graph projection',()=>{const r=classifyGraph(input());assert.equal(r.participants.length,4);assert.equal(r.participants[3].coefficient,null);assert.ok(publishable(input().reaction));});
test('missing products cannot publish',()=>{const x=input();x.reaction.participants=x.reaction.participants.filter(p=>p.role==='reactant');assert.equal(classifyGraph(x).line_style,'hidden');});
test('150C strong plus 100C proposed is dashed at <=120C and solid unfiltered',()=>{assert.equal(classifyGraph(input()).line_style,'dashed');assert.equal(classifyGraph({...input(),filters:[]}).line_style,'solid');});
test('no low temperature evidence disappears, never becomes proposed',()=>{const x=input();x.evidence=x.evidence.slice(0,1);assert.equal(classifyGraph(x).line_style,'hidden');});
test('net conversion observation cannot prove elementary mechanism',()=>{const a=fixture();a.claims[0].scope='elementary_mechanism';a.evidence[0].evidence_type='directly_observed';assert.throws(()=>validateAnalysis(a,target),/another claim scope/);const x=input();x.claim.scope='elementary_mechanism';x.evidence=[{...x.evidence[0],evidence_type:'directly_observed'}];assert.equal(classifyGraph({...x,filters:[]}).line_style,'hidden');});
test('different claim IDs do not contribute even with same reaction',()=>{const x=input();x.claim={...x.claim,id:'other-claim'};assert.equal(classifyGraph(x).line_style,'hidden');});
for(const [name,c,expected] of [['inclusive 120',temperature(120),'matched'],['100–150',temperature(100,150),'excluded'],['unknown',temperature(null),'unknown'],['just over',temperature(120.001),'excluded']] as const) test(`range ${name}`,()=>assert.equal(matchBundle({...bundle('x',1),values:[c]},'reaction',[lowTemperature]),expected));
test('strict < boundary distinguishes open/closed endpoint',()=>{const b=bundle('x',120);assert.equal(matchBundle(b,'reaction',[{...lowTemperature,max_inclusive:false}]),'excluded');b.values[0].upper_inclusive=false;b.values[0].lower=100;assert.equal(matchBundle(b,'reaction',[{...lowTemperature,max_inclusive:false}]),'matched');});
test('all filters must match same experiment/stage',()=>{const x=input();const atmosphere={...temperature(1),key:'atmosphere',dimension:'composition',basis:'gas',unit:'',kind:'controlled_term' as const,terms:['oxygen_free'],lower:null,upper:null};x.bundles[0].values.push(atmosphere);const f={key:'atmosphere',dimension:'composition',basis:'gas',unit:'',terms:['oxygen_free']};assert.equal(classifyGraph({...x,filters:[lowTemperature,f]}).line_style,'hidden');x.bundles[1].stage='pretreatment';assert.equal(classifyGraph(x).line_style,'hidden');});
test('unknown atmosphere is not oxygen-free',()=>{const b=bundle('x',100);b.values=[{...temperature(null),key:'atmosphere',dimension:'composition',basis:'gas',unit:'',kind:'controlled_term'}];assert.equal(matchBundle(b,'reaction',[{key:'atmosphere',dimension:'composition',basis:'gas',unit:'',terms:['oxygen_free']}]),'unknown');});
test('pH is not NaOH molarity; incompatible units never numerically compare',()=>{const b=bundle('x',100);b.values=[{...temperature(13),key:'pH',dimension:'acidity',unit:'',basis:'aqueous'}];assert.equal(matchBundle(b,'reaction',[{key:'alkali_concentration',dimension:'concentration',basis:'solution',unit:'mol/L',max:1}]),'unknown');assert.equal(matchBundle(bundle('x',100),'reaction',[{...lowTemperature,unit:'K'}]),'unknown');});
test('incomplete NaOH composition is unknown; solid concentration is not applicable',()=>{const b=bundle('x',100);b.values=[{...temperature(1),key:'alkali_species',dimension:'composition',basis:'inventory',unit:'',kind:'composition',lower:null,upper:null,terms:['NaOH']}];const f={key:'alkali_species',dimension:'composition',basis:'inventory',unit:'',terms:['NaOH'],only:true};assert.equal(matchBundle(b,'reaction',[f]),'unknown');b.values[0].inventory_complete=true;assert.equal(matchBundle(b,'reaction',[f]),'matched');b.values[0].value_state='not_applicable';b.values[0].terms=[];assert.equal(matchBundle(b,'reaction',[f]),'excluded');});
test('free species and polymer-bound species remain different',()=>{const a=fixture().compounds[0];assert.equal(sameSpecies(a,{...a,node_type:'polymer_site',structure_scope:'polymer_bound'}),false);});
test('direct refutation never creates positive solid edge',()=>{const x=input();x.filters=[];x.evidence=[{...x.evidence[0],stance:'refutes'}];assert.equal(classifyGraph(x).line_style,'hidden');assert.equal(classifyGraph({...x,showRefutations:true}).line_style,'refuted');});
test('conflicting support and refutation remain visible',()=>{const x=input();x.filters=[];x.evidence.push({...x.evidence[0],id:'refutation',stance:'refutes'});const g=classifyGraph(x);assert.equal(g.line_style,'solid');assert.ok(g.conflict);assert.deepEqual(g.refute_evidence_ids,['refutation']);});
test('citations of same original experiment do not add independent groups',()=>{const x=input();x.filters=[];x.evidence=[x.evidence[0],{...x.evidence[0],id:'review-citation',evidence_type:'adopted_from_prior_literature'}];assert.equal(classifyGraph(x).confirmed_independent_groups,1);x.evidence.push({...x.evidence[0],id:'unresolved',origin_resolution_status:'unresolved',independence_group_id:null});assert.ok(classifyGraph(x).independence_unknown);assert.equal(classifyGraph(x).confirmed_independent_groups,1);});
test('unknown is separately displayed, never solid',()=>{const x=input();x.evidence=x.evidence.slice(0,1);x.bundles[0].values=[temperature(null)];assert.equal(classifyGraph(x).line_style,'hidden');assert.equal(classifyGraph({...x,includeUnknown:true}).line_style,'unknown');});
test('human review is independent of strength and cannot be forged by JSON',()=>{const a=fixture();assert.throws(()=>validateAnalysis({...a,evidence:[{...a.evidence[0],review_state:'human_corrected'}]},target));assert.equal(classifyGraph({...input(),reviewedOnly:true}).line_style,'hidden');});
test('applicability without experiment never yields experimental solid support',()=>{const x=input();x.filters=[];x.evidence=x.evidence.slice(0,1);x.bundles[0].basis='reported_applicability';x.bundles[0].experiment_version_id=null;assert.equal(classifyGraph(x).line_style,'hidden');});
test('version, target, PDF hash and anchor cannot be substituted',()=>{const a=fixture();assert.throws(()=>validateAnalysis({...a,schema_version:'2'},target));assert.throws(()=>validateAnalysis(a,{...target,project_id:'other'}));assert.throws(()=>validateAnalysis(a,{...target,document_sha256:'b'.repeat(64)}));a.anchors[0].passage='tampered';assert.throws(()=>validateAnalysis(a,target),/provenance/);});
test('duplicate IDs, unresolved references and invalid ranges fail',()=>{const a=fixture();a.compounds.push(a.compounds[0]);assert.throws(()=>validateAnalysis(a,target),/Duplicate/);const b=fixture();b.reactions[0].participants[0].compound_version_id='absent';assert.throws(()=>validateAnalysis(b,target),/Unresolved/);const c=fixture();c.condition_bundles[0].values[0].lower=200;assert.throws(()=>validateAnalysis(c,target),/interval/);});
test('same key/content replays; same key/different content fails',()=>{const content=JSON.stringify(fixture());assert.equal(planImport({key:'k',content,prior:{key:'k',hash:digest(content)}}).action,'replay');assert.throws(()=>planImport({key:'k',content,prior:{key:'k',hash:'different'}}),/409/);});
test('AI reanalysis only proposes revisions to human corrections',()=>{assert.deepEqual(planImport({key:'new',content:'synthetic',humanCorrectedIds:['e1']}).conflicts,[{id:'e1',action:'propose_revision',overwrite:false}]);});
test('original experiment and independence group cannot be reassigned in an import',()=>{const a=fixture();a.evidence[0].original_experiment_id='another-experiment';assert.throws(()=>validateAnalysis(a,target),/identity mismatch/);const b=fixture();b.evidence[0].independence_group_id='invented-independent-group';assert.throws(()=>validateAnalysis(b,target),/identity mismatch/);});
test('withdrawn evidence does not support the graph',()=>{const x=input();x.filters=[];x.evidence=x.evidence.map(e=>({...e,current_assertion_status:'withdrawn'}));assert.equal(classifyGraph(x).line_style,'hidden');});
test('strong support cannot be inferred from AI confidence or abstract only',()=>{const x=input();x.filters=[];x.evidence=[{...x.evidence[0],extraction_confidence:1,source_access:'abstract_only'}];assert.equal(classifyGraph(x).line_style,'hidden');const a=fixture();a.evidence[0].alternatives_tested=[];assert.throws(()=>validateAnalysis(a,target),/alternatives/);});
test('extra fields cannot smuggle human verification into analysis JSON',()=>{assert.throws(()=>validateAnalysis({...fixture(),human_reviewed:true},target));});

test('JSON transport rejects malformed or oversized payloads',()=>{assert.throws(()=>parseAnalysisJson('{bad',target));assert.throws(()=>parseAnalysisJson('x'.repeat(1_048_577),target),/1 MiB/);assert.equal(parseAnalysisJson(JSON.stringify(fixture()),target).analysis_run.adapter,'dot_manual_json');});

test('review adversary: same original experiment cannot acquire two independence groups',()=>{
 const a=fixture();
 a.experiments[1].original_experiment_id=a.experiments[0].original_experiment_id;
 a.evidence[1].original_experiment_id=a.evidence[0].original_experiment_id;
 assert.throws(()=>validateAnalysis(a,target),/conflicting independence groups/);
 const x=input();x.filters=[];x.evidence[1].original_experiment_id=x.evidence[0].original_experiment_id;
 const g=classifyGraph(x);assert.equal(g.confirmed_independent_groups,0);assert.ok(g.independence_unknown);
});
test('review adversary: unresolved study cannot assert confirmed independence',()=>{
 const a=fixture();a.studies[0].source_status='unresolved';
 assert.throws(()=>validateAnalysis(a,target),/Unresolved study/);
 a.evidence[0].origin_resolution_status='unresolved';assert.doesNotThrow(()=>validateAnalysis(a,target));
});
test('review adversary: self-citation cannot establish adoption provenance',()=>{
 const a=fixture();a.evidence[0].evidence_type='adopted_from_prior_literature';a.evidence[0].dependency_ids=[a.evidence[0].id];
 assert.throws(()=>validateAnalysis(a,target),/Cyclic evidence dependency/);
});
test('review adversary: mutual citation cycle is rejected but acyclic adoption is accepted',()=>{
 const a=fixture();a.evidence[0].dependency_ids=[a.evidence[1].id];a.evidence[1].dependency_ids=[a.evidence[0].id];
 assert.throws(()=>validateAnalysis(a,target),/Cyclic evidence dependency/);
 a.evidence[0].dependency_ids=[];assert.doesNotThrow(()=>validateAnalysis(a,target));
});
test('review adversary: malformed interval/categorical values cannot match filters',()=>{
 const a=fixture();a.condition_bundles[1].values[0].lower=150;
 assert.throws(()=>validateAnalysis(a,target),/Invalid interval/);
 assert.equal(matchBundle(a.condition_bundles[1],'reaction',[lowTemperature]),'unknown');
 const b=fixture();b.condition_bundles[0].values[0].terms=['100'];
 assert.throws(()=>validateAnalysis(b,target),/Invalid interval shape/);
 const c=fixture();c.condition_bundles[0].values[0].kind='controlled_term';
 assert.throws(()=>validateAnalysis(c,target),/Invalid categorical/);
});
test('review adversary: unknown-condition AI evidence retains unreviewed badge',()=>{
 const x=input();x.evidence=x.evidence.slice(0,1);x.bundles[0].values=[temperature(null)];
 const g=classifyGraph({...x,includeUnknown:true});assert.equal(g.line_style,'unknown');assert.ok(g.unreviewed);
});
for(const forged of ['human_reviewed','human_corrected']) test(`review adversary: JSON rejects ${forged}`,()=>{
 const a=fixture();const payload={...a,evidence:[{...a.evidence[0],review_state:forged}]};
 assert.throws(()=>parseAnalysisJson(JSON.stringify(payload),target));
});
test('review adversary: nested review/verification fields cannot bypass strict JSON schema',()=>{
 const a=fixture();
 assert.throws(()=>validateAnalysis({...a,anchors:[{...a.anchors[0],anchor_verified_at:'2026-10-02T00:00:00Z'}]},target));
 assert.throws(()=>validateAnalysis({...a,evidence:[{...a.evidence[0],reviewed_by:target.project_id}]},target));
});
test('review adversary: adopted citation cannot invent a different original experiment',()=>{
 const a=fixture();a.evidence[1].evidence_type='adopted_from_prior_literature';a.evidence[1].dependency_ids=[a.evidence[0].id];
 assert.throws(()=>validateAnalysis(a,target),/matching original experiment/);
 const g=classifyGraph({reaction:a.reactions[0],claim:a.claims[0],evidence:a.evidence,bundles:a.condition_bundles,filters:[]});
 assert.equal(g.confirmed_independent_groups,1);assert.ok(g.independence_unknown);
});
test('review: resolved adopted citation preserves the original group without adding an experiment',()=>{
 const a=fixture();const citation={...a.evidence[0],id:'resolved-citation',evidence_type:'adopted_from_prior_literature' as const,dependency_ids:[a.evidence[0].id]};
 a.evidence.push(citation);assert.doesNotThrow(()=>validateAnalysis(a,target));
 const g=classifyGraph({reaction:a.reactions[0],claim:a.claims[0],evidence:[a.evidence[0],citation],bundles:a.condition_bundles,filters:[]});
 assert.equal(g.confirmed_independent_groups,1);assert.equal(g.independence_unknown,false);
});
