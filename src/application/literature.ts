import {z} from 'zod';
export const providerName=z.enum(['semantic_scholar','crossref']);
export const candidateSchema=z.strictObject({title:z.string().min(1).max(500),authors:z.string().max(1000),journal:z.string().max(500),year:z.number().int().min(1000).max(9999).nullable(),doi:z.string().max(1000),semanticId:z.string().max(255),url:z.string().max(2000),abstract:z.string().max(2000),sources:z.array(providerName).min(1).max(2)});
export type Candidate=z.infer<typeof candidateSchema>;
export type ProviderResult={provider:z.infer<typeof providerName>;status:'ok'|'rate_limited'|'access_denied'|'unavailable'|'invalid_response';retryAfter:number|null;items:Candidate[]};
export type SearchRun={id:string;query:string;question_id:string|null;created_at:string;payload:{providers:ProviderResult[];candidates:Candidate[]}};
export type ResearchQuestion={id:string;question:string};
export type AcquisitionTask={id:string;paper_id:string;question_id:string|null;priority:number;status:'needed'|'requested'|'blocked'|'deferred';reason:string;revision:number};
export function candidateURL(value:string){try{const u=new URL(value);return (u.protocol==='https:'||u.protocol==='http:')&&!u.username&&!u.password?u.href:'';}catch{return '';}}
// Stable identifiers only. Similar titles never prove identity.
export function mergeCandidates(results:ProviderResult[]){const merged:Candidate[]=[];for(const p of results)for(const c of p.items){const old=merged.find(x=>c.doi&&x.doi===c.doi||c.semanticId&&x.semanticId===c.semanticId&&!(c.doi&&x.doi&&c.doi!==x.doi));if(old){old.sources=[...new Set([...old.sources,...c.sources])];if(!old.semanticId)old.semanticId=c.semanticId;if(!old.doi)old.doi=c.doi;}else merged.push({...c,sources:[...c.sources]});}return merged;}
