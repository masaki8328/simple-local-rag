// Local review proposal only. Never creates a migration or contacts a database.
import {readFileSync,writeFileSync} from 'node:fs';
import {z} from 'zod';
import {caseSchema,caseImportSchema} from '../src/domain/research-case';
const base=readFileSync('supabase/migrations/20261002045414_research_case_core.sql','utf8');
function definition(name:string){const start=base.indexOf(`create function ${name}(`),end=base.indexOf('end$$;',start)+7;if(start<0||end<7)throw Error(name);return base.slice(start,end).replace('create function','create or replace function');}
let validate=definition('kg_private.validate_research_case').replace(/\$schema\$[\s\S]*?\$schema\$/,()=>`$schema$${JSON.stringify(z.toJSONSchema(caseSchema))}$schema$`);
validate=validate.replace('\nend$$;',()=>`\n for x in select value->'structure' from jsonb_array_elements(p->'compounds') where value ? 'structure' union all select p#>'{reaction,description}' where p#>'{reaction,description}' is not null loop
 if x->>'source_anchor_id' is not null and not exists(select from public.source_anchors a join public.paper_documents d on d.project_id=a.project_id and d.id=a.paper_document_id where a.project_id=p_project and a.id=(x->>'source_anchor_id')::uuid and d.paper_id=p_paper) then raise exception 'KG_SOURCE';end if;
 if x->>'cas' is not null then
 if x->>'cas' !~ '^[0-9]{2,7}-[0-9]{2}-[0-9]$' then raise exception 'KG_INVALID';end if;
 if (select sum(substring(reverse(replace(x->>'cas','-','')) from i for 1)::integer*(i-1))%10 from generate_series(2,length(replace(x->>'cas','-','')))i)<>right(x->>'cas',1)::integer then raise exception 'KG_INVALID';end if;
 end if;
 end loop;
end$$;`);
const stage=definition('public.stage_research_import').replace('language plpgsql', 'language plpgsql security definer').replace(/\$schema\$[\s\S]*?\$schema\$/,()=>`$schema$${JSON.stringify(z.toJSONSchema(caseImportSchema))}$schema$`);
writeFileSync('supabase/proposals/chemical-fields.sql',`-- REVIEW PROPOSAL ONLY. Not a migration. Existing immutable payloads are never rewritten.\nbegin;\n${validate}\ngrant kg_research_writer to current_user with set true;\ngrant create on schema public to kg_research_writer;\nset local role kg_research_writer;\n${stage}\nreset role;\nrevoke create on schema public from kg_research_writer;\ngrant kg_research_writer to current_user with set false;\ncommit;\n`);
writeFileSync('contracts/research-case-with-chemical-fields.schema.json',JSON.stringify(z.toJSONSchema(caseImportSchema),null,2)+'\n');
