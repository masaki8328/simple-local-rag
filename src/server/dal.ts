import 'server-only';
import type {SupabaseClient} from '@supabase/supabase-js';
import {AppError,type ErrorCode,type Paper,type Project} from '../application/models';
import {ResearchDAL,type ResearchGateway} from './research';
import {userClient} from './supabase/client';
const projectFields='id,name,description,revision,archived_at';
const paperFields='id,project_id,title,journal,year,notes,revision,archived_at';
function failure(error:{message:string;code?:string}|null){
 if(!error)return;
 const allowed:ErrorCode[]=['CONFLICT','DUPLICATE_TITLE','DUPLICATE_DOI','FORBIDDEN','INVALID','ARCHIVED'];
 const code=allowed.find(c=>error.message===`KG_${c}`);
 throw new AppError(code??'UNAVAILABLE');
}
export function supabaseGateway(client:SupabaseClient):ResearchGateway {return {
 async verifiedUser(){const {data,error}=await client.auth.getClaims();if(error||!data?.claims?.sub)return null;return {id:data.claims.sub};},
 async ownsProject(id,userId){const {data,error}=await client.from('projects').select('id').eq('id',id).eq('owner_user_id',userId).maybeSingle();failure(error);return !!data;},
 async listProjects(userId){const {data,error}=await client.from('projects').select(projectFields).eq('owner_user_id',userId).order('created_at',{ascending:false});failure(error);return (data??[]) as Project[];},
 async getProject(id){const {data,error}=await client.from('projects').select(projectFields).eq('id',id).maybeSingle();failure(error);return data as Project|null;},
 async listPapers(projectId){const {data,error}=await client.from('papers').select(paperFields).eq('project_id',projectId).order('created_at',{ascending:false});failure(error);return (data??[]).map(p=>({...p,doi:null})) as Paper[];},
 async getPaper(projectId,id){const {data,error}=await client.from('papers').select(paperFields).eq('project_id',projectId).eq('id',id).maybeSingle();failure(error);if(!data)return null;const ids=await client.from('paper_identifiers').select('normalized_value').eq('project_id',projectId).eq('paper_id',id).eq('provider','doi').limit(1);failure(ids.error);return {...data,doi:ids.data?.[0]?.normalized_value??null} as Paper;},
 async write(operation,args){const {data,error}=await client.rpc(operation,args);failure(error);if(typeof data!=='string')throw new AppError('UNAVAILABLE');return data;}
};}
export async function researchDAL(){return new ResearchDAL(supabaseGateway(await userClient()));}
