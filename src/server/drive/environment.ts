import 'server-only';
import {X509Certificate} from 'node:crypto';
import type {configuredDriveIntegration} from './integration';
type Config=Omit<Parameters<typeof configuredDriveIntegration>[0],'userClient'>;
// Read only the documented fields. Never return diagnostics containing raw values.
export function driveEnvironment(env:Record<string,string|undefined>):Config|null{
 try{
  if(env.KG_DRIVE_ENABLED!=='true'||env.VERCEL_ENV==='preview')return null;
  const required=(key:string)=>{const v=env[key];if(!v||v!==v.trim()||v.length>8192)throw Error();return v;};
  const origin=required('KG_APP_ORIGIN'),u=new URL(origin);if(u.protocol!=='https:'||u.origin!==origin||u.username||u.password)throw Error();
  const url=required('NEXT_PUBLIC_SUPABASE_URL'),supabase=new URL(url),ref=/^([a-z0-9]{20})\.supabase\.co$/.exec(supabase.hostname)?.[1];if(!ref||supabase.protocol!=='https:'||supabase.port||supabase.pathname!=='/'||supabase.search||supabase.hash||supabase.username||supabase.password)throw Error();
  const key=required('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');if(!key.startsWith('sb_publishable_'))throw Error();
  const host=required('KG_DRIVE_DB_HOST'),port=Number(required('KG_DRIVE_DB_PORT')),pooled=/^aws-[a-z0-9-]+\.pooler\.supabase\.com$/.test(host);if(pooled?![5432,6543].includes(port):host!==`db.${ref}.supabase.co`||port!==5432)throw Error();
  const ca=env.KG_DB_CA_PEM;if(ca)new X509Certificate(ca);
  const database=(login:string,password:string)=>({host,port,database:'postgres',login,user:pooled?`${login}.${ref}`:login,password:required(password),...(ca?{ca}:{})});
  const encoded=required('KG_DRIVE_ENCRYPTION_KEY_BASE64'),encryptionKey=Buffer.from(encoded,'base64');if(encryptionKey.length!==32||encryptionKey.toString('base64')!==encoded)throw Error();
  const clientId=required('GOOGLE_DRIVE_CLIENT_ID');if(!/^[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(clientId))throw Error();
  return {origin,database:database('kg_drive_app','KG_DRIVE_DB_PASSWORD'),vaultDatabase:database('kg_vault_app','KG_VAULT_DB_PASSWORD'),encryptionKey,supabase:{url,key},oauth:{clientId,clientSecret:required('GOOGLE_DRIVE_CLIENT_SECRET'),redirectUri:origin+'/api/drive/oauth/callback'}};
 }catch{return null;}
}
