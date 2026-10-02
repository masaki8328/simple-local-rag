import 'server-only';
import type {SupabaseClient} from '@supabase/supabase-js';
import {uuid} from '../../application/models';
import {DriveError,driveInput,type DriveBinding,type DriveIntent,type DriveReceipt} from '../../application/drive';
import {ResearchDAL} from '../research';
import {supabaseGateway} from '../dal';
import type {DriveRepository} from './service';
import {DriveWorker,workerFailure} from './worker';
function checked<T>(result:{data:T;error:unknown}):T{if(result.error)throw workerFailure(result.error);return result.data;}
export function driveRepository(client:SupabaseClient,worker:DriveWorker):DriveRepository{
 const dal=new ResearchDAL(supabaseGateway(client));
 async function jwt(){const {data,error}=await client.auth.getClaims();if(error||!data?.claims.sub)throw new DriveError('FORBIDDEN');const session=await client.auth.getSession();if(session.error||!session.data.session)throw new DriveError('FORBIDDEN');return session.data.session.access_token;}
 async function getBinding(project:string,id?:string):Promise<DriveBinding>{await dal.project(project);let q=client.from('drive_bindings').select('id,account_id,folder_id').eq('project_id',project);if(id)q=q.eq('id',id);const rows=checked(await q.order('created_at',{ascending:false}).limit(id?1:2));if(!rows||rows.length!==1)throw new DriveError('UNCONFIGURED');return {id:rows[0].id,accountId:rows[0].account_id,folderId:rows[0].folder_id};}
 const repo:DriveRepository={
  async authorize(project,paper){try{const p=await dal.project(project);const d=await dal.paper(project,paper);if(p.archived_at||d.archived_at)throw new DriveError('FORBIDDEN');}catch{throw new DriveError('FORBIDDEN');}},
  async binding(project){return getBinding(project);},
  async findIntent(id){uuid.parse(id);const i=checked(await client.from('drive_intents').select('id,project_id,paper_id,binding_id,file_id,input,expires_at').eq('id',id).maybeSingle());if(!i)return null;await repo.authorize(i.project_id,i.paper_id);const cancellation=checked(await client.from('document_provider_events').select('id').eq('project_id',i.project_id).eq('intent_id',id).eq('state','cancelled').limit(1));const input=driveInput.parse({...i.input,id:i.id,projectId:i.project_id,paperId:i.paper_id});const expiresAt=Date.parse(i.expires_at);if(!Number.isFinite(expiresAt))throw new DriveError('CONFLICT');return {...input,binding:await getBinding(i.project_id,i.binding_id),fileId:i.file_id,expiresAt,cancelled:(cancellation??[]).length>0} as DriveIntent;},
  async begin(input,binding,fileId){await repo.authorize(input.projectId,input.paperId);const id=await worker.begin(await jwt(),input,binding.id,fileId);const i=await repo.findIntent(id);if(!i)throw new DriveError('RETRYABLE');return i;},
  async receipt(intentId){const i=await repo.findIntent(intentId);if(!i)throw new DriveError('FORBIDDEN');const r=checked(await client.from('document_receipts').select('id,intent_id,project_id,paper_id,provider,external_file_id,content_revision,sha256,byte_size,state').eq('project_id',i.projectId).eq('intent_id',intentId).maybeSingle());if(!r)return null;if(r.paper_id!==i.paperId||r.external_file_id!==i.fileId||r.provider!=='google_drive'||r.state!=='stored_unparsed')throw new DriveError('CONFLICT');return {id:r.id,intentId:r.intent_id,projectId:r.project_id,paperId:r.paper_id,provider:r.provider,fileId:r.external_file_id,revisionId:r.content_revision,sha256:r.sha256,byteSize:Number(r.byte_size),state:r.state} as DriveReceipt;},
  async finalize(i,v){await repo.authorize(i.projectId,i.paperId);const id=await worker.finish(await jwt(),i.id,v);const receipt=await repo.receipt(i.id);if(!receipt||receipt.id!==id)throw new DriveError('RETRYABLE');return receipt;},
  async event(i,state){await repo.authorize(i.projectId,i.paperId);await worker.event(await jwt(),i.id,state);},
  async cancel(i){await repo.authorize(i.projectId,i.paperId);await worker.event(await jwt(),i.id,'cancelled');}
 };return repo;
}
