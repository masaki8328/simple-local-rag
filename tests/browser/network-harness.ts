// Test-only destination rewrite. HTTP responses are real, not Playwright routes or injected responses.
import {uploadDriveChunks} from '../../src/application/drive-upload';
declare global{interface Window{syntheticDriveNetwork:(mode:'resume'|'redirect')=>Promise<{progress:number[];error:string|null}>;}}
window.syntheticDriveNetwork=async mode=>{const progress:number[]=[];try{await uploadDriveChunks(new Blob([new Uint8Array(300000)]),'https://www.googleapis.com/upload/drive/v3/files?upload_id=SYNTHETIC',new AbortController().signal,n=>progress.push(n),(_url,init)=>fetch(`http://127.0.0.1:3192/${mode}`,init));return {progress,error:null};}catch(e){return {progress,error:e instanceof Error?e.message:'unknown'};}};
