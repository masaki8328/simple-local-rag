import 'server-only';
import {randomBytes,createHash} from 'node:crypto';
import {DriveError,DRIVE_SCOPE} from '../../application/drive';
export type OAuthConfig={clientId:string;redirectUri:string};
export interface OAuthStateStore{
 // Server-only encrypted store, short TTL, bound to verified app user and expected account.
 put(record:{stateHash:string;userId:string;expectedAccount:string|null;verifier:string;expiresAt:number}):Promise<void>;
 consume(stateHash:string,userId:string):Promise<{expectedAccount:string|null;verifier:string}|null>;
}
export async function authorizationRequest(config:OAuthConfig,userId:string,expectedAccount:string|null,store:OAuthStateStore){let callback:URL;try{callback=new URL(config.redirectUri);}catch{throw new DriveError('UNCONFIGURED');}if(!config.clientId||!userId||callback.protocol!=='https:'||callback.username||callback.password||callback.hash||callback.search)throw new DriveError('UNCONFIGURED');const state=randomBytes(32).toString('base64url'),verifier=randomBytes(32).toString('base64url');await store.put({stateHash:createHash('sha256').update(state).digest('hex'),userId,expectedAccount,verifier,expiresAt:Date.now()+600000});const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');url.search=new URLSearchParams({client_id:config.clientId,redirect_uri:config.redirectUri,response_type:'code',scope:DRIVE_SCOPE,access_type:'offline',prompt:'consent',state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'}).toString();return url.toString();}
