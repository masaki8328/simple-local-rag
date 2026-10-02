import 'server-only';
import {z} from 'zod';
import {uuid} from '../../application/models';
import {DriveError,type DriveInput,type SourceEvent} from '../../application/drive';
export interface SQLConnection{query(text:string,values?:unknown[]):Promise<{rows:Record<string,unknown>[]}>;release(destroy?:boolean):void;}
export interface SQLPool{connect():Promise<SQLConnection>;}
export type VerifyWorkerJWT=(jwt:string)=>Promise<{id:string}>;
// Catalog-only guard: rejects admin/service credentials, owner membership and direct app data privileges.
export const workerPreflight=`select current_user as login, session_user as session_login,
 r.rolsuper or r.rolbypassrls or r.rolcreaterole or r.rolcreatedb as elevated,
 pg_has_role(current_user,'kg_drive_owner','MEMBER') as owner_member,
 pg_has_role(current_user,'authenticated','MEMBER') as app_member,
 pg_has_role(current_user,'kg_drive_worker','USAGE') as worker_usage,
 exists(select 1 from pg_roles target where target.rolname not in (current_user,'kg_drive_worker') and pg_has_role(current_user,target.oid,'MEMBER')) as extra_membership,
 exists(select 1 from pg_auth_members m join pg_roles member_role on member_role.oid=m.member where member_role.rolname=current_user and (m.admin_option or m.set_option)) as delegable_role,
 has_schema_privilege(current_user,'auth','USAGE') or has_schema_privilege(current_user,'public','CREATE') or has_schema_privilege(current_user,'kg_private','CREATE') as excessive_schema,
 exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','kg_private') and c.relkind in ('r','p','v','m','f') and
 (has_table_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') or has_any_column_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,REFERENCES'))) as table_access,
 exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','kg_private') and has_function_privilege(current_user,p.oid,'EXECUTE') and p.prosecdef and not (n.nspname='kg_private' and p.proname in ('bind_drive','begin_drive','drive_event','finish_drive'))) as extra_definer
 from pg_roles r where r.rolname=current_user`;
export function workerFailure(error:unknown):DriveError{
 if(error instanceof DriveError)return error;
 const message=error&&typeof error==='object'&&'message' in error?error.message:'';
 const codes:Record<string,'FORBIDDEN'|'CONFLICT'|'EXPIRED'>={KG_FORBIDDEN:'FORBIDDEN',KG_CONFLICT:'CONFLICT',KG_INVALID:'CONFLICT',KG_EXPIRED:'EXPIRED'};
 return new DriveError(typeof message==='string'&&codes[message]?codes[message]:'RETRYABLE');
}
export class DriveWorker{
 constructor(private pool:SQLPool,private verify:VerifyWorkerJWT,private expectedLogin:string){if(!expectedLogin||['postgres','service_role','kg_drive_owner','authenticated'].includes(expectedLogin))throw new DriveError('UNCONFIGURED');}
 private async execute(jwt:string,sql:string,args:unknown[]):Promise<unknown>{
  let caller:{id:string};try{caller=await this.verify(jwt);uuid.parse(caller.id);}catch{throw new DriveError('FORBIDDEN');}
  let connection:SQLConnection;try{connection=await this.pool.connect();}catch{throw new DriveError('RETRYABLE');}
  let destroy=false;
  try{
   await connection.query('BEGIN');
   const guard=(await connection.query(workerPreflight)).rows[0];
   if(!guard||guard.login!==this.expectedLogin||guard.session_login!==this.expectedLogin||guard.worker_usage!==true||['elevated','owner_member','app_member','extra_membership','delegable_role','excessive_schema','table_access','extra_definer'].some(k=>guard[k]!==false))throw new DriveError('UNCONFIGURED');
   await connection.query("select set_config('request.jwt.claim.sub',$1,true), set_config('statement_timeout','10000',true), set_config('lock_timeout','5000',true)",[caller.id]);
   const result=await connection.query(sql,args);await connection.query('COMMIT');await connection.query('RESET request.jwt.claim.sub');return result.rows[0]?.result;
  }catch(e){destroy=true;try{await connection.query('ROLLBACK');}catch{destroy=true;}throw workerFailure(e);}finally{connection.release(destroy);}
 }
 async bind(jwt:string,id:string,project:string,account:string,folder:string){uuid.parse(id);uuid.parse(project);z.string().min(1).max(255).parse(account);z.string().min(1).max(255).parse(folder);return uuid.parse(await this.execute(jwt,'select kg_private.bind_drive($1::uuid,$2::uuid,$3::text,$4::text) as result',[id,project,account,folder]));}
 async begin(jwt:string,input:DriveInput,bindingId:string,fileId:string){uuid.parse(bindingId);z.string().min(1).max(255).parse(fileId);const {filename,size,edition,source,accessBasis}=input;return uuid.parse(await this.execute(jwt,'select kg_private.begin_drive($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::text,$6::jsonb) as result',[input.id,input.projectId,input.paperId,bindingId,fileId,JSON.stringify({filename,size,edition,source,accessBasis})]));}
 async event(jwt:string,intentId:string,state:SourceEvent|'cancelled'){uuid.parse(intentId);z.enum(['unavailable','replaced','retryable','invalid_bytes','checked','cancelled']).parse(state);await this.execute(jwt,'select kg_private.drive_event($1::uuid,$2::text) as result',[intentId,state]);}
 async finish(jwt:string,intentId:string,v:{revisionId:string;sha256:string;byteSize:number}){uuid.parse(intentId);z.string().min(1).max(255).parse(v.revisionId);z.string().regex(/^[a-f0-9]{64}$/).parse(v.sha256);z.number().int().min(1).max(100000000).parse(v.byteSize);return uuid.parse(await this.execute(jwt,'select kg_private.finish_drive($1::uuid,$2::text,$3::text,$4::bigint) as result',[intentId,v.revisionId,v.sha256,v.byteSize]));}
}
