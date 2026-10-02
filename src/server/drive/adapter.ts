import 'server-only';
import {DriveError,DRIVE_SCOPE,type DriveBinding,type DriveIntent} from '../../application/drive';
export type TokenGrant={accessToken:string;scopes:readonly string[]};
// Secure OAuth storage/refresh is an injected server capability, never a browser prop.
export interface TokenProvider{access(bindingId:string):Promise<TokenGrant>;}
export type DriveMeta={id:string;headRevisionId:string;size:number;mimeType:string;trashed:boolean;privateOwned:boolean;parents:string[];intentId:string};
export interface DriveAdapter{
 quota(binding:DriveBinding):Promise<{available:number;maxUpload:number}>;
 allocate(binding:DriveBinding):Promise<string>;
 start(intent:DriveIntent):Promise<string>;
 metadata(intent:DriveIntent):Promise<DriveMeta>;
 stream(intent:DriveIntent,revision:string,signal:AbortSignal):Promise<ReadableStream<Uint8Array>>;
}
const base='https://www.googleapis.com/drive/v3';
export {sessionURL as assertSessionURL} from '../../application/drive-upload';
import {sessionURL as assertSessionURL} from '../../application/drive-upload';
export class GoogleDriveAdapter implements DriveAdapter{
 constructor(private tokens:TokenProvider,private http:typeof fetch=fetch){}
 private async request(binding:DriveBinding,url:string,init:RequestInit={}){
  let grant:TokenGrant;try{grant=await this.tokens.access(binding.id);}catch{throw new DriveError('RECONNECT');}
  if(!grant.accessToken||grant.scopes.length!==1||grant.scopes[0]!==DRIVE_SCOPE)throw new DriveError('RECONNECT');
  let r:Response;try{r=await this.http(url,{...init,redirect:'error',cache:'no-store',signal:init.signal??AbortSignal.timeout(30_000),headers:{...init.headers,Authorization:`Bearer ${grant.accessToken}`}});}catch{throw new DriveError('RETRYABLE');}
  if(r.status===401)throw new DriveError('RECONNECT');if(r.status===404)throw new DriveError('UNAVAILABLE');if(r.status===403)throw new DriveError('FORBIDDEN');if(!r.ok)throw new DriveError('RETRYABLE');return r;
 }
 private async account(b:DriveBinding){const r=await this.request(b,`${base}/about?fields=user(permissionId),storageQuota,maxUploadSize`);const data=await r.json();if(data.user?.permissionId!==b.accountId)throw new DriveError('WRONG_ACCOUNT');return data;}
 async quota(b:DriveBinding){const d=await this.account(b);const limit=Number(d.storageQuota?.limit),usage=Number(d.storageQuota?.usage),max=Number(d.maxUploadSize);if(!Number.isSafeInteger(limit)||!Number.isSafeInteger(usage)||!Number.isSafeInteger(max)||limit<usage||usage<0||max<=0)throw new DriveError('QUOTA_UNKNOWN');return {available:limit-usage,maxUpload:max};}
 async allocate(b:DriveBinding){await this.account(b);const r=await this.request(b,`${base}/files/generateIds?count=1&space=drive&type=files`);const d=await r.json();if(!Array.isArray(d.ids)||typeof d.ids[0]!=='string'||!d.ids[0])throw new DriveError('RETRYABLE');return d.ids[0] as string;}
 async start(i:DriveIntent){await this.account(i.binding);const folder=await (await this.request(i.binding,`${base}/files/${encodeURIComponent(i.binding.folderId)}?fields=id,mimeType,trashed,ownedByMe,shared,appProperties`)).json();if(folder.id!==i.binding.folderId||folder.mimeType!=='application/vnd.google-apps.folder'||folder.trashed||folder.ownedByMe!==true||folder.shared!==false||folder.appProperties?.kgFolder!=='originals')throw new DriveError('FORBIDDEN');const r=await this.request(i.binding,'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&keepRevisionForever=true&fields=id',{method:'POST',headers:{'Content-Type':'application/json','X-Upload-Content-Type':'application/pdf','X-Upload-Content-Length':String(i.size)},body:JSON.stringify({id:i.fileId,name:i.filename,mimeType:'application/pdf',parents:[i.binding.folderId],appProperties:{kgIntent:i.id}})});return assertSessionURL(r.headers.get('location')??'');}
 async metadata(i:DriveIntent):Promise<DriveMeta>{await this.account(i.binding);const r=await this.request(i.binding,`${base}/files/${encodeURIComponent(i.fileId)}?fields=id,headRevisionId,size,mimeType,trashed,parents,appProperties,ownedByMe,shared`);const d=await r.json();const size=Number(d.size);if(d.id!==i.fileId||typeof d.headRevisionId!=='string'||!d.headRevisionId||!Number.isSafeInteger(size)||size<1||!Array.isArray(d.parents)||d.appProperties?.kgIntent!==i.id)throw new DriveError('REPLACED');return {id:d.id,headRevisionId:d.headRevisionId,size,mimeType:d.mimeType,trashed:d.trashed===true,privateOwned:d.ownedByMe===true&&d.shared===false,parents:d.parents,intentId:d.appProperties.kgIntent};}
 async stream(i:DriveIntent,revision:string,signal:AbortSignal){await this.account(i.binding);const r=await this.request(i.binding,`${base}/files/${encodeURIComponent(i.fileId)}/revisions/${encodeURIComponent(revision)}?alt=media`,{signal});if(!r.body)throw new DriveError('RETRYABLE');return r.body;}
}
