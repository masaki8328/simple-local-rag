import 'server-only';
import type {SupabaseClient} from '@supabase/supabase-js';
import {DriveError} from '../../application/drive';
import {ResearchDAL} from '../research';
import {supabaseGateway} from '../dal';
import {DriveWorker} from './worker';
import {createWorkerPool,workerJWTVerifier} from './connection';
import {PostgresSecretVault} from './vault';
import {DriveOAuth,encryptedSessions,type GoogleOAuthConfig} from './oauth-service';
import {composeDriveService,driveHandler} from './orchestration';
// Complete composition, but production activation is a separate reviewed step.
export function configuredDriveIntegration(config:{origin:string;database:Parameters<typeof createWorkerPool>[0];vaultDatabase:Parameters<typeof createWorkerPool>[0];encryptionKey:Buffer;supabase:{url:string;key:string};oauth:GoogleOAuthConfig;userClient:()=>Promise<SupabaseClient>}){
 const origin=new URL(config.origin);if(origin.origin!==config.origin||origin.protocol!=='https:'||config.oauth.redirectUri!==config.origin+'/api/drive/oauth/callback'||config.database.login===config.vaultDatabase.login||config.encryptionKey.length!==32)throw new DriveError('UNCONFIGURED');
 const verify=workerJWTVerifier(config.supabase),pool=createWorkerPool(config.database),vaultPool=createWorkerPool(config.vaultDatabase),worker=new DriveWorker(pool,verify,config.database.login);
 async function context(){const client=await config.userClient();const session=await client.auth.getSession();const jwt=session.data.session?.access_token;if(session.error||!jwt)throw new DriveError('FORBIDDEN');const user=await verify(jwt);const dal=new ResearchDAL(supabaseGateway(client));const vault=new PostgresSecretVault(vaultPool,verify,jwt,config.vaultDatabase.login,config.encryptionKey);
  const oauth=new DriveOAuth(config.oauth,user.id,vault,{async project(id){const p=await dal.project(id);if(p.archived_at)throw new DriveError('FORBIDDEN');const {data,error}=await client.from('drive_bindings').select('id,account_id,folder_id').eq('project_id',id).limit(2);if(error||!data||data.length>1)throw new DriveError('CONFLICT');return data.length?{id:data[0].id,accountId:data[0].account_id,folderId:data[0].folder_id}:null;},async bind(id,project,account,folder){await worker.bind(jwt,id,project,account,folder);}});
  return {oauth,service:composeDriveService({client,worker,tokens:oauth,sessions:encryptedSessions(vault)})};
 }
 const headers={'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'};
 const error=(e:unknown)=>Response.json({error:e instanceof DriveError?e.code:'RETRYABLE'},{status:e instanceof DriveError&&e.code==='FORBIDDEN'?403:503,headers});
 return {POST:driveHandler(async()=>(await context()).service,config.origin),async connect(request:Request){try{const url=new URL(request.url);if(request.method!=='POST'||url.origin!==config.origin||request.headers.get('origin')!==config.origin)throw new DriveError('FORBIDDEN');const project=url.searchParams.get('project')??'';const c=await context();return new Response(null,{status:303,headers:{...headers,Location:await c.oauth.start(project)}});}catch(e){return error(e);}},async callback(request:Request){try{const url=new URL(request.url);if(request.method!=='GET'||url.origin!==config.origin||url.pathname!=='/api/drive/oauth/callback')throw new DriveError('FORBIDDEN');const c=await context();if(url.searchParams.has('error'))throw new DriveError('RECONNECT');const project=await c.oauth.callback(url.searchParams.get('state')??'',url.searchParams.get('code')??'');return new Response(null,{status:303,headers:{...headers,Location:config.origin+'/projects/'+project}});}catch(e){return error(e);}},close:()=>Promise.all([pool.end(),vaultPool.end()])};
}
