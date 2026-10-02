import {DriveError} from './drive';
// Real local Chromium tests cover cross-origin 308/Range without Location.
// Keep redirect:error: Location redirects must not forward bytes/capabilities.
// Actual Google session-only authorization/CORS still requires its own probe.
export function sessionURL(raw:string){let u:URL;try{u=new URL(raw);}catch{throw new DriveError('CONFLICT');}if(u.origin!=='https://www.googleapis.com'||u.pathname!=='/upload/drive/v3/files'||!u.searchParams.has('upload_id')||u.username||u.password||u.hash)throw new DriveError('CONFLICT');return raw;}
export async function uploadDriveChunks(file:Blob,url:string,signal:AbortSignal,progress:(bytes:number)=>void,http:typeof fetch=fetch){sessionURL(url);const send=async(body:Blob|null,range:string)=>{let r:Response;try{r=await http(url,{method:'PUT',body,headers:{'Content-Type':'application/pdf','Content-Range':range},credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',signal});}catch{throw new DriveError(signal.aborted?'CANCELLED':'RETRYABLE');}if(r.status===404||r.status===410)throw new DriveError('EXPIRED');if(r.status!==308&&r.status!==200&&r.status!==201)throw new DriveError('RETRYABLE');return r;};
 const offset=(r:Response)=>{const range=r.headers.get('range');if(!range)return 0;const m=/^bytes=0-(\d+)$/.exec(range);const n=m?Number(m[1])+1:NaN;if(!Number.isSafeInteger(n)||n<0||n>file.size)throw new DriveError('CONFLICT');return n;};
 let r=await send(null,`bytes */${file.size}`);if(r.ok){progress(file.size);return;}let at=offset(r);progress(at);
 while(at<file.size){const end=Math.min(at+256*1024,file.size);r=await send(file.slice(at,end),`bytes ${at}-${end-1}/${file.size}`);if(r.ok){if(end!==file.size)throw new DriveError('CONFLICT');progress(file.size);return;}const next=offset(r);if(next<=at||next>end)throw new DriveError('RETRYABLE');at=next;progress(at);}
 throw new DriveError('RETRYABLE');
}
