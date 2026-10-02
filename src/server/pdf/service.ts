import 'server-only';
import {hasPDFHeader} from '../../application/pdf-header';
import {uuid} from '../../application/models';
import {createHash} from 'node:crypto';
import {PDFDocument} from 'pdf-lib';
import {PdfError,SIGNED_VIEW_SECONDS,uploadInput,type UploadInput,type Intent,type VerifiedPDF,type Finalized} from '../../application/pdf';
export interface PdfRepository{
 authorize(projectId:string,paperId:string):Promise<void>;
 intent(input:UploadInput):Promise<Intent>;
 getIntent(id:string):Promise<Intent>;
 mark(id:string,state:'failed'|'cancelled'):Promise<void>;
 // Trusted verifier capability only; never wired to a user-accessible RPC client.
 finalize(intent:Intent,verified:VerifiedPDF):Promise<Finalized>;
 asset(projectId:string,paperId:string,assetId:string):Promise<{path:string}>;
}
export interface PrivateStorage{
 putOnce(path:string,bytes:Uint8Array):Promise<'created'|'exists'>;
 readBounded(path:string,maxBytes:number):Promise<Uint8Array>;
 sign(path:string,seconds:number):Promise<string>;
}
export async function inspectPDF(bytes:Uint8Array,max:number):Promise<VerifiedPDF>{
 if(bytes.byteLength>max)throw new PdfError('OVERSIZE');
 if(bytes.byteLength<20||!hasPDFHeader(bytes))throw new PdfError('INVALID_PDF');
 try{
  const pdf=await PDFDocument.load(bytes,{ignoreEncryption:false,throwOnInvalidObject:true,updateMetadata:false});
  const pageCount=pdf.getPageCount();if(pdf.isEncrypted||pageCount<1||pageCount>2000)throw new Error('Invalid pages');
  return {sha256:createHash('sha256').update(bytes).digest('hex'),byteSize:bytes.byteLength,pageCount,mime:'application/pdf',verifier:'pdf-lib@1.17.1'};
 }catch{throw new PdfError('INVALID_PDF');}
}
export class PdfService{
 constructor(private repo:PdfRepository,private storage:PrivateStorage,private maxBytes:number,private clock=Date.now){}
 async begin(raw:unknown){const parsed=uploadInput.safeParse(raw);if(!parsed.success)throw new PdfError('CONFLICT');if(parsed.data.size>this.maxBytes)throw new PdfError('OVERSIZE');await this.repo.authorize(parsed.data.projectId,parsed.data.paperId);return this.repo.intent(parsed.data);}
 private async scoped(id:string){if(!uuid.safeParse(id).success)throw new PdfError('FORBIDDEN');const i=await this.repo.getIntent(id);await this.repo.authorize(i.projectId,i.paperId);if(i.path!==`${i.projectId}/${i.id}/original.pdf`)throw new PdfError('FORBIDDEN');return i;}
 private active(i:Intent){if(i.state==='cancelled')throw new PdfError('CANCELLED');if(i.state!=='finalized'&&i.expiresAt<=this.clock())throw new PdfError('EXPIRED');}
 async upload(id:string,bytes:Uint8Array){const i=await this.scoped(id);this.active(i);if(i.state==='finalized')return this.finalize(id);if(bytes.length!==i.size)throw new PdfError('MISMATCH');const uploaded=await inspectPDF(bytes,this.maxBytes);if(i.state==='failed')return this.finalize(id,uploaded.sha256);await this.storage.putOnce(i.path,bytes);return this.finalize(id,uploaded.sha256);}
 async finalize(id:string,uploadedHash?:string){const i=await this.scoped(id);this.active(i);
  // Always re-read immutable stored bytes, including retries; request metadata is not proof.
  let verified:VerifiedPDF;
  try{verified=await inspectPDF(await this.storage.readBounded(i.path,this.maxBytes),this.maxBytes);
   if((uploadedHash!==undefined&&verified.sha256!==uploadedHash)||verified.byteSize!==i.size||(i.expectedHash!==null&&verified.sha256!==i.expectedHash))throw new PdfError('MISMATCH');
  }catch(error){if(i.state!=='finalized')await this.repo.mark(i.id,'failed').catch(()=>{});throw error;}
  // DB failure retains object and intent for retry; no delete/overwrite/cleanup capability.
  return this.repo.finalize(i,verified);
 }
 async cancel(id:string){const i=await this.scoped(id);if(i.state==='finalized')throw new PdfError('CONFLICT');await this.repo.mark(i.id,'cancelled');}
 async view(projectId:string,paperId:string,assetId:string){await this.repo.authorize(projectId,paperId);const asset=await this.repo.asset(projectId,paperId,assetId);if(!asset.path.startsWith(`${projectId}/`))throw new PdfError('FORBIDDEN');return {url:await this.storage.sign(asset.path,SIGNED_VIEW_SECONDS),expiresAt:this.clock()+SIGNED_VIEW_SECONDS*1000};}
}
