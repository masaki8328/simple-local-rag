import 'server-only';
import type {SupabaseClient} from '@supabase/supabase-js';
import {PdfError} from '../../application/pdf';
import type {PrivateStorage} from './service';
// User-scoped Storage client only. No service key or overwrite/delete method.
export function privateStorage(client:SupabaseClient):PrivateStorage{return {
 async putOnce(path,bytes){const {error}=await client.storage.from('research-originals').upload(path,bytes,{upsert:false,contentType:'application/pdf',cacheControl:'0'});if(error){if(('code' in error&&['Duplicate','ResourceAlreadyExists','KeyAlreadyExists','already_exists'].includes(String(error.code)))||('statusCode' in error&&String(error.statusCode)==='409')||('statusCode' in error&&String(error.statusCode)==='400'&&['Asset Already Exists','The resource already exists'].includes(error.message)))return 'exists';throw new PdfError('STORAGE');}return 'created';},
 async readBounded(path,max){
  // Download through signed URL with a bounded streaming read instead of buffering an untrusted Blob.
  const {data,error}=await client.storage.from('research-originals').createSignedUrl(path,60);if(error||!data)throw new PdfError('STORAGE');
  const response=await fetch(data.signedUrl,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});if(!response.ok||!response.body)throw new PdfError('STORAGE');
  const reader=response.body.getReader();const chunks:Uint8Array[]=[];let count=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;count+=value.length;if(count>max)throw new PdfError('OVERSIZE');chunks.push(value);}}finally{await reader.cancel();}
  return Buffer.concat(chunks,count);
 },
 async sign(path,seconds){const {data,error}=await client.storage.from('research-originals').createSignedUrl(path,seconds);if(error||!data)throw new PdfError('STORAGE');return data.signedUrl;}
};}
