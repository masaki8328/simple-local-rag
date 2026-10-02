import {writeFileSync} from 'node:fs';
import {z} from 'zod';
import {analysisSchema} from '../src/domain/contracts';
writeFileSync('contracts/analysis-v0.1.schema.json',JSON.stringify(z.toJSONSchema(analysisSchema),null,2)+'\n');
