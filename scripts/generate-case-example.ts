import {writeFileSync} from 'node:fs';
import {syntheticCase} from '../tests/fixtures/research-case';
writeFileSync('contracts/research-case-synthetic-example.json',JSON.stringify({schema_version:'research-case/0.1',project_id:'11111111-1111-4111-8111-111111111111',paper_id:'22222222-2222-4222-8222-222222222222',case_id:'33333333-3333-4333-8333-333333333333',expected_revision:0,analysis_run:{id:'SYNTHETIC demonstration only',adapter:'dot_manual_json',protocol_version:'synthetic/1'},payload:syntheticCase()},null,2)+'\n');
