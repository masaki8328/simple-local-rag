import {execFileSync} from 'node:child_process';
const setup=execFileSync(process.execPath,['--import','tsx','scripts/project-review-fixture.ts'],{encoding:'utf8'}).split('select public.create_reaction_identity')[0];
console.log(setup+String.raw`
select payload as old_payload from public.research_case_versions where id=:'version1' \gset
select jsonb_set(jsonb_set(:'old_payload'::jsonb,'{compounds,0,structure}',jsonb_build_object('schema_version','chemical-structure/0.1','smiles','N[C@@H](C)C(=O)[O-]','inchi',null,'cas','50-99-7','representation','transition_state','source_anchor_id',:'anchor1','attribution','analyst')),'{reaction,description}',jsonb_build_object('schema_version','reaction-description/0.1','reaction_type','SYNTHETIC conversion','reversibility','unknown','description','SYNTHETIC proposed mechanism','source_anchor_id',:'anchor1','attribution','authors')) as extended \gset
select public.save_research_case(:'project',:'paper1',:'case1',1,:'extended','SYNTHETIC chemical fields') as extended_version \gset
select pg_temp.ok((select payload=:'old_payload'::jsonb from public.research_case_versions where id=:'version1'),'chemical fields do not rewrite immutable old payload');
select pg_temp.ok((select payload#>>'{compounds,0,structure,smiles}'='N[C@@H](C)C(=O)[O-]' and payload#>>'{reaction,description,reversibility}'='unknown' from public.research_case_versions where id=:'extended_version'),'explicit stereo charged structure and unknown reversibility retained');
select pg_temp.err(format('select public.save_research_case(%L,%L,%L,2,%L,%L)',:'project',:'paper1',:'case1',jsonb_set(:'extended'::jsonb,'{compounds,0,structure,source_anchor_id}',to_jsonb(:'anchor2'::text)),'SYNTHETIC wrong paper'),'KG_SOURCE','structure anchor must belong to same paper');
select pg_temp.err(format('select public.save_research_case(%L,%L,%L,2,%L,%L)',:'project',:'paper1',:'case1',jsonb_set(:'extended'::jsonb,'{reaction,description,source_anchor_id}',to_jsonb(:'anchor2'::text)),'SYNTHETIC wrong paper'),'KG_SOURCE','mechanism anchor must belong to same paper');
select pg_temp.err(format('select public.save_research_case(%L,%L,%L,2,%L,%L)',:'project',:'paper1',:'case1',jsonb_set(:'extended'::jsonb,'{compounds,0,structure,cas}','"50-99-8"'),'SYNTHETIC bad CAS'),'KG_INVALID','SQL CAS checksum gate');
select pg_temp.err(format('select public.save_research_case(%L,%L,%L,2,%L,%L)',:'project',:'paper1',:'case1',jsonb_set(:'extended'::jsonb,'{compounds,0,structure,human_reviewed}','true'),'SYNTHETIC forged review'),'KG_INVALID','chemical extension cannot forge review state');
select gen_random_uuid() as chemical_case \gset
select jsonb_build_object('schema_version','research-case/0.1','project_id',:'project','paper_id',:'paper1','case_id',:'chemical_case','expected_revision',0,'analysis_run',jsonb_build_object('id','SYNTHETIC chemical import','adapter','dot_manual_json','protocol_version','0.1'),'payload',replace(:'extended','80000000','94000000')::jsonb)::text as proposal \gset
select public.stage_research_import(:'project',gen_random_uuid(),:'proposal') as chemical_batch \gset
select public.apply_research_import(:'project',:'chemical_batch') as chemical_version \gset
select pg_temp.ok((select payload#>>'{compounds,0,structure,cas}'='50-99-7' and review_state='ai_generated' from public.research_case_versions where id=:'chemical_version'),'extended import remains versioned AI data with no review upgrade');
select public.save_research_case(:'project',:'paper1',:'case1',2,:'old_payload','SYNTHETIC explicit legacy-compatible edit');
select pg_temp.ok((select count(*)=3 from public.research_case_versions where case_id=:'case1'),'legacy payload edit accepted and all historical versions retained');
reset role;
select pg_temp.ok(not pg_has_role('postgres','kg_research_writer','SET') and not has_schema_privilege('kg_research_writer','public','CREATE'),'proposal restores restricted writer boundaries');
select pg_temp.ok((select prosecdef from pg_proc where oid='public.stage_research_import(uuid,uuid,text)'::regprocedure),'updated import preserves security-definer boundary');
rollback;
`);
