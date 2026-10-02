import 'server-only';
import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {DriveError} from '../../application/drive';
import type {SQLPool,VerifyWorkerJWT} from './worker';
import {workerPreflight} from './worker';
export const vaultPreflight=workerPreflight.replaceAll("'kg_drive_worker'","'kg_vault_worker'").replace("p.proname in ('bind_drive','begin_drive','drive_event','finish_drive')","p.proname='vault_access'");
export interface VaultTransaction {value:unknown|null;put(value:unknown,expiresAt:number):void;remove():void;}
export interface SecretVault {transaction<T>(key:string,fn:(tx:VaultTransaction)=>Promise<T>):Promise<T>;}
// Per-request capability: JWT is independently verified before any database access.
// A different dedicated login owns only the vault worker membership, never Drive worker.
export class PostgresSecretVault implements SecretVault {
 constructor(private pool:SQLPool,private verify:VerifyWorkerJWT,private jwt:string,private login:string,private encryptionKey:Buffer){if(encryptionKey.length!==32||!login)throw new DriveError('UNCONFIGURED');}
 async transaction<T>(key:string,fn:(tx:VaultTransaction)=>Promise<T>):Promise<T>{
  if(!/^(state|token|session):[a-zA-Z0-9_-]{1,128}$/.test(key))throw new DriveError('CONFLICT');
  const user=await this.verify(this.jwt);const c=await this.pool.connect();let destroy=false;
  try{
   await c.query('BEGIN');
   const g=(await c.query(vaultPreflight)).rows[0];
   if(!g||g.login!==this.login||g.session_login!==this.login||g.worker_usage!==true||['elevated','owner_member','app_member','extra_membership','delegable_role','excessive_schema','table_access','extra_definer'].some(k=>g[k]!==false))throw new DriveError('UNCONFIGURED');
   await c.query("select set_config('request.jwt.claim.sub',$1,true),set_config('statement_timeout','35000',true),set_config('lock_timeout','5000',true)",[user.id]);
   const call=async(op:string,payload:string|null=null,expiry:number|null=null)=>(await c.query('select kg_private.vault_access($1,$2,$3,$4::timestamptz) as result',[key,op,payload,expiry===null?null:new Date(expiry).toISOString()])).rows[0]?.result;
   const stored=await call('read');const aad=Buffer.from(user.id+'\n'+key);let value:unknown=null;
   if(typeof stored==='string'){const parts=stored.split('.');if(parts.length!==3)throw new DriveError('RECONNECT');const decipher=createDecipheriv('aes-256-gcm',this.encryptionKey,Buffer.from(parts[0],'base64url'));decipher.setAAD(aad);decipher.setAuthTag(Buffer.from(parts[1],'base64url'));value=JSON.parse(Buffer.concat([decipher.update(Buffer.from(parts[2],'base64url')),decipher.final()]).toString('utf8'));}
   let mutation:{value:unknown;expiresAt:number}|null|undefined;
   const result=await fn({value,put:(v,e)=>{if(!Number.isFinite(e)||e<=Date.now())throw new DriveError('EXPIRED');mutation={value:v,expiresAt:e};},remove:()=>{mutation=null;}});
   if(mutation===null)await call('delete');else if(mutation){const iv=randomBytes(12);const cipher=createCipheriv('aes-256-gcm',this.encryptionKey,iv);cipher.setAAD(aad);const encrypted=Buffer.concat([cipher.update(JSON.stringify(mutation.value),'utf8'),cipher.final()]);await call('put',[iv,cipher.getAuthTag(),encrypted].map(b=>b.toString('base64url')).join('.'),mutation.expiresAt);}
   await c.query('COMMIT');return result;
  }catch(e){destroy=true;await c.query('ROLLBACK').catch(()=>{});throw e instanceof DriveError?e:new DriveError('RETRYABLE');}finally{c.release(destroy);}
 }
}
