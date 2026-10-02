import {writeFileSync} from 'node:fs';
import {z} from 'zod';
import {researchResultSchema,questionRevisionSchema} from '../src/domain/research-handoff';
for(const [name,schema] of [['research-result-v0.1',researchResultSchema],['question-revision-v0.1',questionRevisionSchema]] as const)writeFileSync(`contracts/${name}.schema.json`,JSON.stringify(z.toJSONSchema(schema),null,2)+'\n');
