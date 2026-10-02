import {writeFileSync} from 'node:fs';
import {z} from 'zod';
import {caseImportSchema,caseSchema} from '../src/domain/research-case';
writeFileSync('contracts/research-case-v0.1.schema.json',JSON.stringify(z.toJSONSchema(caseImportSchema),null,2)+'\n');
writeFileSync('/tmp/kg-case-payload-schema.json',JSON.stringify(z.toJSONSchema(caseSchema)));
