import 'server-only';
import {Pool} from 'pg';
import {createClient} from '@supabase/supabase-js';
import {DriveError} from '../../application/drive';
import type {VerifyWorkerJWT} from './worker';
// Explicit server capability; no environment lookup, default admin URL or TLS bypass.
export function createWorkerPool(config:{host:string;port:number;database:string;login:string;password:string;user?:string;ca?:string}){
 if(!config.host||!config.database||!config.password||!config.login||!Number.isInteger(config.port)||config.port<1||config.port>65535||['postgres','service_role','kg_drive_owner','authenticated'].includes(config.login))throw new DriveError('UNCONFIGURED');
 if(config.user&&config.user!==config.login&&(!config.user.startsWith(config.login+'.')||!/^[a-z0-9]{20}$/.test(config.user.slice(config.login.length+1))))throw new DriveError('UNCONFIGURED');
 const pool=new Pool({host:config.host,port:config.port,database:config.database,user:config.user??config.login,password:config.password,ssl:{rejectUnauthorized:true,...(config.ca?{ca:config.ca}:{})},max:2,connectionTimeoutMillis:5000,idleTimeoutMillis:10000,application_name:'kg-drive-worker'});
 // Never forward driver errors (which may contain connection details) to logs or clients.
 pool.on('error',()=>{});return pool;
}
export function workerJWTVerifier(config:{url:string;key:string}):VerifyWorkerJWT{
 if(!config.key.startsWith('sb_publishable_'))throw new DriveError('UNCONFIGURED');let issuer:string;try{const u=new URL(config.url);if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.pathname!=='/')throw Error();issuer=u.origin+'/auth/v1';}catch{throw new DriveError('UNCONFIGURED');}
 const client=createClient(config.url,config.key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 return async jwt=>{const {data,error}=await client.auth.getClaims(jwt);const c=data?.claims;if(error||!c||c.iss!==issuer||c.role!=='authenticated'||!Number.isFinite(c.exp)||c.exp<=Date.now()/1000||!(c.aud==='authenticated'||Array.isArray(c.aud)&&c.aud.includes('authenticated')))throw new DriveError('FORBIDDEN');return {id:c.sub};};
}
