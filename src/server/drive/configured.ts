import 'server-only';
import type {SupabaseClient} from '@supabase/supabase-js';
import {DriveError} from '../../application/drive';
import {createWorkerPool,workerJWTVerifier} from './connection';
import {DriveWorker} from './worker';
import {composeDriveService,driveHandler} from './orchestration';
import type {TokenProvider} from './adapter';
import type {SessionVault} from './service';
// Local wiring target for explicitly provisioned capabilities. The OAuth-capable production path uses configuredDriveIntegration instead.
// Singleton pool; fresh cookie-bound Supabase client per request. No raw credential env discovery.
export function configuredDriveHandler(config:{origin:string;database:Parameters<typeof createWorkerPool>[0];supabase:{url:string;key:string};tokens:TokenProvider;sessions:SessionVault;userClient:()=>Promise<SupabaseClient>}){
 let origin:URL;try{origin=new URL(config.origin);if(origin.origin!==config.origin||origin.protocol!=='https:')throw Error();}catch{throw new DriveError('UNCONFIGURED');}
 if(!config.tokens||!config.sessions||!config.userClient)throw new DriveError('UNCONFIGURED');
 const verify=workerJWTVerifier(config.supabase);const pool=createWorkerPool(config.database);const worker=new DriveWorker(pool,verify,config.database.login);
 return {POST:driveHandler(async()=>composeDriveService({client:await config.userClient(),worker,tokens:config.tokens,sessions:config.sessions}),origin.origin),close:()=>pool.end()};
}
