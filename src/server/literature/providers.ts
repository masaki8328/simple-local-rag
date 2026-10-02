import 'server-only';
import {candidateSchema,candidateURL,mergeCandidates,type Candidate,type ProviderResult,type DiscoveryKind} from '../../application/literature';
import {normalizeDoi} from '../../application/models';
const text=(v:unknown,max:number)=>typeof v==='string'?v.replace(/<[^>]*>/g,'').trim().slice(0,max):'';
const doi=(v:unknown)=>{const d=normalizeDoi(text(v,1000));return /^10\.[0-9]{4,9}\/[^\s<>]+$/.test(d)?d:'';};
const year=(v:unknown)=>typeof v==='number'&&Number.isInteger(v)&&v>=1000&&v<=new Date().getUTCFullYear()+1?v:null;
const record=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
export class LiteratureProviders{
 private cooldown=new Map<string,number>();
 constructor(private http:typeof fetch=fetch){}
 private async request(provider:ProviderResult['provider'],query:string):Promise<ProviderResult>{const result=(status:ProviderResult['status'],items:Candidate[]=[],retryAfter:number|null=null)=>({provider,status,items,retryAfter});const wait=(this.cooldown.get(provider)??0)-Date.now();if(wait>0)return result('rate_limited',[],Math.ceil(wait/1000));const url=new URL(provider==='crossref'?'https://api.crossref.org/works':'https://api.semanticscholar.org/graph/v1/paper/search');url.searchParams.set(provider==='crossref'?'query.bibliographic':'query',query);if(provider==='crossref')url.searchParams.set('rows','10');else{url.searchParams.set('limit','10');url.searchParams.set('fields','title,authors,year,venue,url,externalIds,abstract');}
  try{const r=await this.http(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(12000),redirect:'error',cache:'no-store'});if(r.status===429){const retry=r.headers.get('retry-after')??'';const seconds=Math.min(3600,Math.max(1,Number(retry)||Math.ceil((Date.parse(retry)-Date.now())/1000)||60));this.cooldown.set(provider,Date.now()+seconds*1000);return result('rate_limited',[],seconds);}if(r.status===401||r.status===403)return result('access_denied');if(!r.ok)return result('unavailable');const reader=r.body?.getReader();if(!reader)return result('invalid_response');const parts:Uint8Array[]=[];let size=0;try{while(true){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.length;if(size>1048576)return result('invalid_response');parts.push(chunk.value);}}finally{await reader.cancel().catch(()=>{});}const body=record(JSON.parse(Buffer.concat(parts,size).toString('utf8')));const rows=provider==='crossref'?record(body.message).items:body.data;if(!Array.isArray(rows))return result('invalid_response');const items:Candidate[]=[];for(const raw of rows.slice(0,10)){const x=record(raw),authors=Array.isArray(x.authors)?x.authors:Array.isArray(x.author)?x.author:[];const dates=record(x.published)['date-parts'];const c={title:text(provider==='crossref'&&Array.isArray(x.title)?x.title[0]:x.title,500),authors:authors.map(a=>{const author=record(a);return provider==='crossref'?text([author.given,author.family].filter(v=>typeof v==='string').join(' '),200):text(author.name,200);}).filter(Boolean).join(', ').slice(0,1000),journal:text(provider==='crossref'&&Array.isArray(x['container-title'])?x['container-title'][0]:x.venue,500),year:year(provider==='crossref'&&Array.isArray(dates)&&Array.isArray(dates[0])?dates[0][0]:x.year),doi:doi(provider==='crossref'?x.DOI:record(x.externalIds).DOI),semanticId:provider==='semantic_scholar'?text(x.paperId,255):'',url:candidateURL(text(provider==='crossref'?x.URL:x.url,2000)),abstract:text(x.abstract,2000),sources:[provider]};const parsed=candidateSchema.safeParse(c);if(parsed.success&&(parsed.data.doi||parsed.data.semanticId))items.push(parsed.data);}return result('ok',items);
  }catch{return result('unavailable');}
 }
 async search(query:string):Promise<{providers:ProviderResult[];candidates:Candidate[]}>{const providers=await Promise.all([this.request('semantic_scholar',query),this.request('crossref',query)]);return {providers,candidates:mergeCandidates(providers)};}
 async discover(kind:DiscoveryKind,ids:{doi:string;semanticId:string}):Promise<{providers:ProviderResult[];candidates:Candidate[]}>{
  const providers=await Promise.all([this.discoveryRequest('semantic_scholar',kind,ids),this.discoveryRequest('crossref',kind,ids)]);return {providers,candidates:mergeCandidates(providers)};
 }
 private async discoveryRequest(provider:ProviderResult['provider'],kind:DiscoveryKind,ids:{doi:string;semanticId:string}):Promise<ProviderResult>{
  const result=(status:ProviderResult['status'],items:Candidate[]=[],retryAfter:number|null=null,omitted=0):ProviderResult=>({provider,status,items,retryAfter,coverage:status==='ok'?'bounded':'unknown',omitted});
  if(provider==='crossref'&&(kind!=='references'||!ids.doi)||provider==='semantic_scholar'&&!ids.semanticId&&!ids.doi)return result('unsupported');
  const wait=(this.cooldown.get(provider)??0)-Date.now();if(wait>0)return result('rate_limited',[],Math.ceil(wait/1000));
  const id=ids.semanticId||'DOI:'+ids.doi;
  const url=new URL(provider==='crossref'?`https://api.crossref.org/works/${encodeURIComponent(ids.doi)}`:kind==='related'?`https://api.semanticscholar.org/recommendations/v1/papers/forpaper/${encodeURIComponent(id)}`:`https://api.semanticscholar.org/graph/v1/paper/${encodeURIComponent(id)}/${kind}`);
  if(provider==='semantic_scholar'){url.searchParams.set('limit','10');url.searchParams.set('fields','title,authors,year,venue,url,externalIds,abstract');}
  try{
   const response=await this.http(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(12000),redirect:'error',cache:'no-store'});
   if(response.status===429){const h=response.headers.get('retry-after')??'',retry=Math.min(3600,Math.max(1,Number(h)||Math.ceil((Date.parse(h)-Date.now())/1000)||60));this.cooldown.set(provider,Date.now()+retry*1000);return result('rate_limited',[],retry);}
   if(response.status===401||response.status===403)return result('access_denied');if(!response.ok)return result('unavailable');
   const reader=response.body?.getReader();if(!reader)return result('invalid_response');const chunks:Uint8Array[]=[];let size=0;
   try{while(true){const c=await reader.read();if(c.done)break;size+=c.value.length;if(size>1048576)return result('invalid_response');chunks.push(c.value);}}finally{await reader.cancel().catch(()=>{});}
   const body=record(JSON.parse(Buffer.concat(chunks,size).toString('utf8'))),message=record(body.message),raw=provider==='crossref'?message.reference:kind==='related'?body.recommendedPapers:body.data;
   if(!Array.isArray(raw))return result('invalid_response');const items:Candidate[]=[];let omitted=0;
   for(const row of raw.slice(0,10)){
    const wrapper=record(row),x=provider==='crossref'||kind==='related'?wrapper:record(wrapper[kind==='references'?'citedPaper':'citingPaper']);
    const d=doi(provider==='crossref'?x.DOI:record(x.externalIds).DOI),sid=provider==='semantic_scholar'?text(x.paperId,255):'';
    const c={title:text(provider==='crossref'?x['article-title']:x.title,500)||(d?`DOI ${d} — title not supplied`:''),authors:provider==='crossref'?text(x.author,1000):Array.isArray(x.authors)?x.authors.map(a=>text(record(a).name,200)).filter(Boolean).join(', ').slice(0,1000):'',journal:text(provider==='crossref'?x['journal-title']:x.venue,500),year:year(provider==='crossref'?Number(x.year):x.year),doi:d,semanticId:sid,url:provider==='crossref'&&d?'https://doi.org/'+encodeURIComponent(d):candidateURL(text(x.url,2000)),abstract:text(x.abstract,2000),sources:[provider]};
    const parsed=candidateSchema.safeParse(c);if(!parsed.success||!d&&!sid){omitted++;continue;}if(d&&d===ids.doi||sid&&sid===ids.semanticId){omitted++;continue;}items.push(parsed.data);
   }
   const answer=result('ok',items,null,omitted);answer.coverage=omitted>0||raw.length>10||typeof body.next==='number'?'partial':'bounded';return answer;
  }catch{return result('unavailable');}
 }

}
