'use server';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {researchDAL} from './dal';
import {userClient} from './supabase/client';
import {AppError,errorMessage,type FormState} from '../application/models';
import {z} from 'zod';
function fields(form:FormData){return Object.fromEntries([...form.entries()].filter(([key])=>!key.startsWith('$ACTION_')));}
function failure(error:unknown):FormState{return {error:errorMessage[error instanceof AppError?error.code:'UNAVAILABLE']};}
export async function createProject(_state:FormState,form:FormData):Promise<FormState>{
 try{const dal=await researchDAL();const id=await dal.createProject(fields(form));revalidatePath('/projects');return {destination:`/projects/${id}`};}catch(e){return failure(e);}
}
export async function editProject(_state:FormState,form:FormData):Promise<FormState>{
 try{const dal=await researchDAL();const id=await dal.editProject(fields(form));revalidatePath(`/projects/${id}`);return {success:'プロジェクトを保存しました。'};}catch(e){return failure(e);}
}
export async function createPaper(_state:FormState,form:FormData):Promise<FormState>{
 try{const dal=await researchDAL();const id=await dal.createPaper(fields(form));const project=String(form.get('project_id'));revalidatePath(`/projects/${project}`);return {destination:`/projects/${project}/papers/${id}`};}catch(e){return failure(e);}
}
export async function editPaper(_state:FormState,form:FormData):Promise<FormState>{
 try{const dal=await researchDAL();const id=await dal.editPaper(fields(form));revalidatePath(`/projects/${String(form.get('project_id'))}`);return {success:`論文を保存しました。`,destination:`/projects/${String(form.get('project_id'))}/papers/${id}`};}catch(e){return failure(e);}
}
export async function archiveRecord(_state:FormState,form:FormData):Promise<FormState>{
 try{const dal=await researchDAL();await dal.archive(fields(form));revalidatePath('/projects','layout');return {success:form.get('archived')==='true'?'アーカイブしました。削除はしていません。':'復元しました。'};}catch(e){return failure(e);}
}
export async function signIn(_state:FormState,form:FormData):Promise<FormState>{
 try{const client=await userClient();const parsed=z.strictObject({email:z.email(),password:z.string().min(1).max(1024)}).safeParse(fields(form));if(!parsed.success)throw new AppError('INVALID');const {error}=await client.auth.signInWithPassword(parsed.data);if(error)return {error:'ログインできませんでした。入力またはアカウントの状態を確認してください。'};return {destination:'/projects'};}catch(e){return failure(e);}
}
export async function signOut(){const client=await userClient();await client.auth.getClaims();const {error}=await client.auth.signOut();if(error)throw new Error('Sign out unavailable');redirect('/login');}
