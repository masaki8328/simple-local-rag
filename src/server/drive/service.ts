import 'server-only';
import {hasPDFHeader} from '../../application/pdf-header';
import {createHash} from 'node:crypto';
import {driveInput,DRIVE_TARGET_BYTES,DriveError,type DriveBinding,type DriveInput,type DriveIntent,type DriveReceipt,type SourceEvent} from '../../application/drive';
import type {DriveAdapter,DriveMeta} from './adapter';
export interface DriveRepository{
 authorize(project:string,paper:string):Promise<void>;
 binding(project:string):Promise<DriveBinding>;
 findIntent(id:string):Promise<DriveIntent|null>;
 // Atomically returns existing identical intent; different input conflicts. File ID allocated before insert.
 begin(input:DriveInput,binding:DriveBinding,fileId:string):Promise<DriveIntent>;
 receipt(intentId:string):Promise<DriveReceipt|null>;
 finalize(intent:DriveIntent,verified:{revisionId:string;sha256:string;byteSize:number}):Promise<DriveReceipt>;
 event(intent:DriveIntent,state:SourceEvent):Promise<void>;
 cancel(intent:DriveIntent):Promise<void>;
}
// Session capabilities require encrypted, short-lived server storage and atomic per-intent creation.
// No URLs in SQL audit, telemetry, errors, localStorage or request logging.
export interface SessionVault{once(intentId:string,expiresAt:number,create:()=>Promise<string>):Promise<string>;}
export class DriveService{
 constructor(private repo:DriveRepository,private adapter:DriveAdapter,private sessions:SessionVault,private clock=Date.now){}
 async begin(raw:unknown){const p=driveInput.safeParse(raw);if(!p.success)throw new DriveError('CONFLICT');const input=p.data;await this.repo.authorize(input.projectId,input.paperId);const old=await this.repo.findIntent(input.id);if(old){for(const key of Object.keys(input) as (keyof DriveInput)[])if(old[key]!==input[key])throw new DriveError('CONFLICT');return old;}
  const b=await this.repo.binding(input.projectId);const q=await this.adapter.quota(b);if(input.size>q.available||input.size>q.maxUpload)throw new DriveError('QUOTA');return this.repo.begin(input,b,await this.adapter.allocate(b));}
 private async scoped(id:string){const i=await this.repo.findIntent(id);if(!i)throw new DriveError('FORBIDDEN');await this.repo.authorize(i.projectId,i.paperId);return i;}
 private active(i:DriveIntent){if(i.cancelled)throw new DriveError('CANCELLED');if(i.expiresAt<=this.clock())throw new DriveError('EXPIRED');}
 async uploadSession(id:string){const i=await this.scoped(id);this.active(i);if(await this.repo.receipt(id))throw new DriveError('CONFLICT');return {url:await this.sessions.once(i.id,i.expiresAt,()=>this.adapter.start(i)),size:i.size};}
 private valid(i:DriveIntent,m:DriveMeta){if(m.trashed)throw new DriveError('UNAVAILABLE');if(!m.privateOwned)throw new DriveError('FORBIDDEN');if(m.id!==i.fileId||m.intentId!==i.id||!m.parents.includes(i.binding.folderId)||m.size!==i.size||m.mimeType!=='application/pdf')throw new DriveError('REPLACED');}
 private async inspect(i:DriveIntent){const before=await this.adapter.metadata(i);this.valid(i,before);if(before.size>DRIVE_TARGET_BYTES)throw new DriveError('OVERSIZE');const signal=AbortSignal.timeout(60_000);const stream=await this.adapter.stream(i,before.headRevisionId,signal);const reader=stream.getReader();const stop=()=>{void reader.cancel().catch(()=>{});};signal.addEventListener('abort',stop,{once:true});let size=0;const hash=createHash('sha256');let prefix=Buffer.alloc(0);
  try{while(true){signal.throwIfAborted();const {done,value}=await reader.read();if(done){signal.throwIfAborted();break;}size+=value.byteLength;if(size>DRIVE_TARGET_BYTES||size>i.size)throw new DriveError('OVERSIZE');hash.update(value);if(prefix.length<9)prefix=Buffer.concat([prefix,Buffer.from(value.subarray(0,9-prefix.length))]);}}finally{signal.removeEventListener('abort',stop);await reader.cancel().catch(()=>{});}
  const after=await this.adapter.metadata(i);this.valid(i,after);if(before.headRevisionId!==after.headRevisionId||before.size!==after.size)throw new DriveError('REPLACED');if(size!==before.size)throw new DriveError('RETRYABLE');if(!hasPDFHeader(prefix))throw new DriveError('INVALID_PDF');return {revisionId:before.headRevisionId,sha256:hash.digest('hex'),byteSize:size};}
 private async checked(i:DriveIntent){try{return await this.inspect(i);}catch(error){const e=error instanceof DriveError?error:new DriveError('RETRYABLE');const state:SourceEvent=e.code==='UNAVAILABLE'?'unavailable':e.code==='REPLACED'?'replaced':e.code==='INVALID_PDF'||e.code==='OVERSIZE'?'invalid_bytes':'retryable';await this.repo.event(i,state);throw e;}}
 async complete(id:string){const i=await this.scoped(id);const old=await this.repo.receipt(id);if(!old)this.active(i);const v=await this.checked(i);if(old){if(old.revisionId!==v.revisionId||old.sha256!==v.sha256||old.byteSize!==v.byteSize){await this.repo.event(i,'replaced');throw new DriveError('REPLACED');}return old;}return this.repo.finalize(i,v);}
 async cancel(id:string){const i=await this.scoped(id);if(await this.repo.receipt(id))throw new DriveError('CONFLICT');await this.repo.cancel(i);}
 async checkDownload(id:string){const i=await this.scoped(id);const r=await this.repo.receipt(id);if(!r)throw new DriveError('UNAVAILABLE');await this.complete(id);await this.repo.event(i,'checked');return {receipt:r,disposition:'attachment' as const};}
 // No safe browser revision-pinned private transport proven yet. Never redirect to mutable webContentLink.
 async download(id:string):Promise<never>{await this.checkDownload(id);throw new DriveError('DOWNLOAD_UNPROVEN');}
}
