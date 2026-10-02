import 'server-only';
import type {SupabaseClient} from '@supabase/supabase-js';
import {z} from 'zod';
import {uuid} from '../../application/models';
import {DriveError,driveInput} from '../../application/drive';
import {GoogleDriveAdapter,type TokenProvider,type DriveAdapter} from './adapter';
import {driveRepository} from './repository';
import {DriveService,type SessionVault} from './service';
import type {DriveWorker} from './worker';
// All dependencies are server capabilities. None can be selected in request JSON.
export function composeDriveService(deps:{client:SupabaseClient;worker:DriveWorker;tokens:TokenProvider;sessions:SessionVault;adapter?:DriveAdapter}){
 return new DriveService(driveRepository(deps.client,deps.worker),deps.adapter??new GoogleDriveAdapter(deps.tokens),deps.sessions);
}
const begin=driveInput.extend({action:z.literal('begin')});
const command=z.strictObject({action:z.enum(['session','complete','cancel','status','download']),id:uuid});
const requestSchema=z.union([begin,command]);
async function jsonBody(request:Request){if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')throw new DriveError('CONFLICT');const reader=request.body?.getReader();if(!reader)throw new DriveError('CONFLICT');const parts:Uint8Array[]=[];let length=0;try{while(true){const r=await reader.read();if(r.done)break;length+=r.value.length;if(length>16384)throw new DriveError('OVERSIZE');parts.push(r.value);}}finally{await reader.cancel().catch(()=>{});}try{return JSON.parse(Buffer.concat(parts,length).toString('utf8'));}catch{throw new DriveError('CONFLICT');}}
const headers={'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'};
export function driveHandler(factory:()=>DriveService|Promise<DriveService>,trustedOrigin?:string){
 return async(request:Request)=>{try{
  // Disabled production rejects before body read; configured requests then enforce CSRF origin.
  const service=await factory();if(!request||!trustedOrigin||request.headers.get('origin')!==trustedOrigin||new URL(request.url).origin!==trustedOrigin)throw new DriveError('FORBIDDEN');
  const parsed=requestSchema.safeParse(await jsonBody(request));if(!parsed.success)throw new DriveError('CONFLICT');const body=parsed.data;
  if(body.action==='begin'){const {action:_,...input}=body;void _;const i=await service.begin(input);return Response.json({id:i.id,expiresAt:i.expiresAt},{headers});}
  if(body.action==='session')return Response.json(await service.uploadSession(body.id),{headers});
  if(body.action==='complete')return Response.json(await service.complete(body.id),{headers});
  if(body.action==='cancel'){await service.cancel(body.id);return Response.json({cancelled:true},{headers});}
  if(body.action==='status')return Response.json(await service.status(body.id),{headers});
  await service.download(body.id);throw new DriveError('DOWNLOAD_UNPROVEN');
 }catch(e){const code=e instanceof DriveError?e.code:'RETRYABLE';const status=code==='FORBIDDEN'?403:code==='CONFLICT'||code==='CANCELLED'?409:code==='EXPIRED'?410:code==='OVERSIZE'?413:503;return Response.json({error:code},{status,headers});}};
}
