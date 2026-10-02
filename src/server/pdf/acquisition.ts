import 'server-only';
import type {SupabaseClient} from '@supabase/supabase-js';
import {AppError,uuid} from '../../application/models';
export type QueuePaper={id:string;title:string;authors:string;year:number|null;canonical_url:string|null;priority:number|null;investigation_reason:string|null;doi:string|null};
// Acquisition status describes retained bytes, never page parsing or source confirmation.
export class AcquisitionQueries{
 constructor(private client:SupabaseClient,private authorize:(project:string,paper?:string)=>Promise<void>){}
 private async scope(project:string,paper?:string){uuid.parse(project);if(paper)uuid.parse(paper);await this.authorize(project,paper);}
 private async sources(project:string){
  const docs=await this.client.from('paper_documents').select('id,paper_id,document_asset_id,document_receipt_id,edition_label,acquired_from,role').eq('project_id',project);if(docs.error)throw new AppError('UNAVAILABLE');
  const assets=await this.client.from('document_assets').select('id,sha256').eq('project_id',project).eq('upload_state','verified');if(assets.error)throw new AppError('UNAVAILABLE');
  const receipts=await this.client.from('document_receipts').select('id,paper_id,sha256,state').eq('project_id',project).eq('state','stored_unparsed');if(receipts.error)throw new AppError('UNAVAILABLE');
  return docs.data.flatMap(d=>{const receipt=d.document_receipt_id?receipts.data.find(r=>r.id===d.document_receipt_id&&r.paper_id===d.paper_id):undefined;const asset=d.document_asset_id?assets.data.find(a=>a.id===d.document_asset_id):undefined;if(!receipt&&!asset)return [];return [{...d,sha256:(receipt??asset)!.sha256 as string,pageCount:null,storageState:receipt?'stored_unparsed' as const:'legacy_verified' as const}];});
 }
 async queue(project:string):Promise<QueuePaper[]>{await this.scope(project);const papers=await this.client.from('papers').select('id,title,authors,year,canonical_url,priority,investigation_reason').eq('project_id',project).is('archived_at',null).order('priority',{ascending:true,nullsFirst:false});if(papers.error)throw new AppError('UNAVAILABLE');const docs=await this.sources(project);const ids=await this.client.from('paper_identifiers').select('paper_id,normalized_value').eq('project_id',project).eq('provider','doi');if(ids.error)throw new AppError('UNAVAILABLE');const stored=new Set(docs.filter(d=>d.role==='main_text').map(d=>d.paper_id));return papers.data.filter(p=>!stored.has(p.id)).map(p=>({...p,doi:ids.data.find(d=>d.paper_id===p.id)?.normalized_value??null})) as QueuePaper[];}
 async documents(project:string,paper:string){await this.scope(project,paper);return (await this.sources(project)).filter(d=>d.paper_id===paper);}
}
