import {syntheticCase} from '../tests/fixtures/research-case';
function payload(n:number){const p=syntheticCase();const prefix=n===1?'80000000':'90000000';const id=(i:number)=>`${prefix}-0000-4000-8000-${String(i).padStart(12,'0')}`;p.compounds.forEach((c,i)=>c.id=id(i+1));p.reaction.id=id(3);p.reaction.participants.forEach((x,i)=>x.compound_id=id(i+1));p.experiment.id=id(4);p.evidence.id=id(5);p.evidence.source_access='fulltext';p.evidence.evidence_type='directly_observed';p.evidence.measured_scope='net_conversion';p.evidence.epistemic_origin='experiment_report';p.experiment.original_experiment_id='SYNTHETIC original '+n;p.experiment.independence_group_id='SYNTHETIC group '+n;p.experiment.origin_resolution_status='confirmed';Object.assign(p.experiment.conditions[0],{value_state:'reported',lower:n===1?80:120,upper:n===1?80:120});return p;}
let sql=`\\set ON_ERROR_STOP on
begin;
create function pg_temp.ok(ok boolean,label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL %',label;end if;raise notice 'PASS: %',label;end$$;
create function pg_temp.err(statement text,expected text,label text) returns void language plpgsql as $$begin begin execute statement;exception when others then if sqlerrm=expected or sqlstate=expected then raise notice 'PASS: %',label;return;end if;raise;end;raise exception 'FAIL %',label;end$$;
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select public.create_project_v2(gen_random_uuid(),'SYNTHETIC aggregate review','') as project \\gset
`;
for(const n of [1,2]){const p=JSON.stringify(payload(n)).replaceAll("'","''");sql+=`select public.create_paper(:'project',gen_random_uuid(),'SYNTHETIC review paper ${n}','',2026,'','') as paper${n} \\gset
reset role;set role kg_drive_worker;
select kg_private.bind_drive(gen_random_uuid(),:'project','SYNTHETIC account ${n}','SYNTHETIC folder ${n}') as binding${n} \\gset
select kg_private.begin_drive(gen_random_uuid(),:'project',:'paper${n}',:'binding${n}','SYNTHETIC review file ${n}','{"filename":"SYNTHETIC.pdf","size":9,"edition":"Original","source":"SYNTHETIC","accessBasis":"synthetic fixture"}') as intent${n} \\gset
select kg_private.finish_drive(:'intent${n}','SYNTHETIC-r${n}',repeat('${n}',64),9) as receipt${n} \\gset
reset role;set role authenticated;
select id as document${n} from public.paper_documents where project_id=:'project' and document_receipt_id=:'receipt${n}' \\gset
select public.create_draft_source_anchor(:'project',:'paper${n}',gen_random_uuid(),:'document${n}',1,1,'1','SYNTHETIC passage ${n}','','',null) as anchor${n} \\gset
select gen_random_uuid() as case${n} \\gset
select public.save_research_case(:'project',:'paper${n}',:'case${n}',0,jsonb_set('${p}'::jsonb,'{evidence,source_anchor_id}',to_jsonb(:'anchor${n}'::text)),'SYNTHETIC initial human edit') as version${n} \\gset
select pg_temp.err(format('select public.review_scientific_evidence(%L,gen_random_uuid(),%L,0,%L,%L,true)',:'project',:'version${n}','accepted','SYNTHETIC'),'KG_SOURCE','science adoption requires separate human source attestation ${n}');
select public.attest_source_locator(:'project',gen_random_uuid(),:'anchor${n}',0,'attested','SYNTHETIC human checked stored receipt',true) as attestation${n} \\gset
select public.review_scientific_evidence(:'project',gen_random_uuid(),:'version${n}',0,'accepted','SYNTHETIC science review',true) as review${n} \\gset
`;}sql+=`select public.create_reaction_identity(:'project',gen_random_uuid(),:'version1','SYNTHETIC shared reaction','SYNTHETIC reviewed identity',true) as identity \\gset
`;
for(const n of [1,2]){const map=JSON.stringify(payload(n).compounds.map((c,i)=>({source:c.id,target:payload(1).compounds[i].id})));sql+=`select public.map_reaction_identity(:'project',gen_random_uuid(),:'identity',:'version${n}',0,'include','${map}','SYNTHETIC explicit species-role-stoichiometry correspondence',true) as mapping${n} \\gset
`;}
sql+=`select pg_temp.ok((select count(*)=2 from public.reaction_identity_mappings where project_id=:'project' and identity_id=:'identity'),'two independent case evidences share reviewed reaction identity');
select pg_temp.ok((select count(distinct payload#>>'{experiment,original_experiment_id}')=2 from public.research_case_versions where project_id=:'project'),'original experiment identities retained separately');
select pg_temp.ok((select count(*)=2 from public.scientific_evidence_reviews where project_id=:'project' and decision='accepted'),'independent human science reviews retained');
select pg_temp.ok((select bool_and(confirmation='draft') from public.research_case_versions where project_id=:'project'),'original immutable case flags preserved');
select pg_temp.ok((select anchor_verified_at is null from public.source_anchors where id=:'anchor1'),'human attestation does not pretend automated anchor verification');
select pg_temp.ok((select receipt_sha256=repeat('1',64) from public.source_attestations where id=:'attestation1'),'attestation binds exact stored receipt hash');
select pg_temp.err(format('select public.map_reaction_identity(%L,gen_random_uuid(),%L,%L,1,%L,%L,%L,true)',:'project',:'identity',:'version1','include','[]','SYNTHETIC'),'KG_MAPPING','incomplete participant mapping refused');
select public.attest_source_locator(:'project',gen_random_uuid(),:'anchor1',1,'withdrawn','SYNTHETIC source correction needed',true);
select pg_temp.ok((select count(*)=2 from public.source_attestations where anchor_id=:'anchor1'),'source withdrawal appends without removing original attestation');
select pg_temp.ok((select count(*)=2 from public.scientific_evidence_reviews where project_id=:'project'),'source withdrawal does not rewrite science review history');
select pg_temp.err(format('select public.review_scientific_evidence(%L,gen_random_uuid(),%L,1,%L,%L,true)',:'project',:'version1','accepted','SYNTHETIC'),'KG_SOURCE','withdrawn source cannot authorize new science adoption');
select public.create_draft_source_anchor(:'project',:'paper2',gen_random_uuid(),:'document2',1,1,'1','SYNTHETIC corrected passage','','',:'anchor2') as corrected \\gset
select pg_temp.err(format('select public.attest_source_locator(%L,gen_random_uuid(),%L,1,%L,%L,true)',:'project',:'anchor2','attested','SYNTHETIC'),'KG_CONFLICT','superseded locator cannot be newly attested');
select public.save_research_case(:'project',:'paper2',:'case2',1,jsonb_set((select payload from public.research_case_versions where id=:'version2'),'{reaction,participants,0,coefficient}','2'::jsonb),'SYNTHETIC stoichiometry correction') as revised \\gset
select pg_temp.err(format('select public.map_reaction_identity(%L,gen_random_uuid(),%L,%L,0,%L,%L,%L,true)',:'project',:'identity',:'revised','include','${JSON.stringify(payload(2).compounds.map((c,i)=>({source:c.id,target:payload(1).compounds[i].id})))}','SYNTHETIC'),'KG_MAPPING','stoichiometry change requires a different identity');
select pg_temp.ok((select count(*)=0 from public.scientific_evidence_reviews where case_version_id=:'revised'),'new case revision does not inherit scientific approval');
select pg_temp.err('insert into public.scientific_evidence_reviews default values','42501','client cannot insert forged review records directly');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select pg_temp.ok((select count(*)=0 from public.project_reaction_identities where id=:'identity'),'project reaction identities are owner scoped');
select pg_temp.err(format('select public.attest_source_locator(%L,gen_random_uuid(),%L,2,%L,%L,true)',:'project',:'anchor1','attested','SYNTHETIC'),'KG_FORBIDDEN','other owner cannot attest source');
rollback;
`;process.stdout.write(sql);
