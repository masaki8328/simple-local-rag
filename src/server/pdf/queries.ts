import 'server-only';
import {researchDAL} from '../dal';
import {userClient} from '../supabase/client';
import {AppError,uuid} from '../../application/models';
export type {QueuePaper} from './acquisition';
import {AcquisitionQueries} from './acquisition';
async function acquisition(){return new AcquisitionQueries(await userClient(),async(project,paper)=>{const dal=await researchDAL();if(paper)await dal.paper(project,paper);else await dal.project(project);});}
export async function pdfQueue(projectId:string){return (await acquisition()).queue(projectId);}
export async function paperPDFs(projectId:string,paperId:string){return (await acquisition()).documents(projectId,paperId);}
export async function verifiedAsset(projectId:string,paperId:string,assetId:string){if(!uuid.safeParse(assetId).success)throw new AppError('INVALID');await (await researchDAL()).paper(projectId,paperId);const client=await userClient();const link=await client.from('paper_documents').select('id').eq('project_id',projectId).eq('paper_id',paperId).eq('document_asset_id',assetId).limit(1);if(link.error||!link.data?.length)throw new AppError('FORBIDDEN');const {data,error}=await client.from('document_assets').select('storage_path').eq('project_id',projectId).eq('id',assetId).eq('upload_state','verified').maybeSingle();if(error||!data)throw new AppError('FORBIDDEN');return {client,path:data.storage_path as string};}

export async function paperAttempts(projectId:string,paperId:string){await (await researchDAL()).paper(projectId,paperId);const client=await userClient();const {data,error}=await client.from('upload_intents').select('id,original_filename,edition_label,state,expires_at').eq('project_id',projectId).eq('paper_id',paperId).order('created_at',{ascending:false});if(error)throw new AppError('UNAVAILABLE');return data;}
