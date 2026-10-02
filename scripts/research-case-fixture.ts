// Generates synthetic JSON and SQL only at test time; no research input.
import {readFileSync} from 'node:fs';
import {syntheticCase} from '../tests/fixtures/research-case';
process.stdout.write('select $payload$'+JSON.stringify(syntheticCase())+'$payload$::jsonb as payload \\gset\n'+readFileSync('tests/task4-research.sql','utf8'));
