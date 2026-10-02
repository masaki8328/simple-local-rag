import {mkdir,copyFile} from 'node:fs/promises';
await mkdir('public/chemistry/vendor',{recursive:true});
for(const name of ['RDKit_minimal.js','RDKit_minimal.wasm'])await copyFile(`node_modules/@rdkit/rdkit/dist/${name}`,`public/chemistry/vendor/${name}`);
