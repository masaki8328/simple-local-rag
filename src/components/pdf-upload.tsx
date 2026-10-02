'use client';
import {useRef,useState} from 'react';
import {MAX_PDF_BYTES} from '../application/pdf';
export function PDFUpload({projectId,paperId,enabled=false,maxBytes=MAX_PDF_BYTES}:{projectId:string;paperId:string;enabled?:boolean;maxBytes?:number}){
 const [file,setFile]=useState<File|null>(null);const [edition,setEdition]=useState('Original');const [source,setSource]=useState('');const [basis,setBasis]=useState('');const [message,setMessage]=useState('');const [progress,setProgress]=useState(0);const [busy,setBusy]=useState(false);const [completed,setCompleted]=useState(false);const fileInput=useRef<HTMLInputElement>(null);const intent=useRef<string|null>(null);const requestId=useRef<string|null>(null);const locked=useRef(false);const xhr=useRef<XMLHttpRequest|null>(null);const cancelRequested=useRef(false);
 async function call(action:string,body?:unknown){const r=await fetch(`/api/pdf?action=${action}`,{method:'POST',headers:{'Content-Type':'application/json','x-upload-intent':intent.current??''},body:body===undefined?undefined:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw new Error(data.error??'STORAGE');return data;}
 async function submit(){if(locked.current||!enabled||!file)return;locked.current=true;cancelRequested.current=false;setBusy(true);setMessage('');try{if(file.size>maxBytes)throw new Error('OVERSIZE');
  if(!intent.current){requestId.current??=crypto.randomUUID();const result=await call('begin',{projectId,paperId,requestId:requestId.current,filename:file.name,size:file.size,expectedHash:null,edition,source,accessBasis:basis});intent.current=result.id;}
  if(cancelRequested.current){await cancel();return;}
  const result=await new Promise<{matchedKnownBytes:boolean}>((resolve,reject)=>{const r=new XMLHttpRequest();xhr.current=r;r.open('POST','/api/pdf?action=upload');r.setRequestHeader('x-upload-intent',intent.current!);r.setRequestHeader('Content-Type','application/pdf');r.upload.onprogress=e=>{if(e.lengthComputable)setProgress(Math.round(e.loaded/e.total*100));};r.onload=()=>{try{const data=JSON.parse(r.responseText);if(r.status>=200&&r.status<300)resolve(data);else reject(new Error(data.error??'STORAGE'));}catch{reject(new Error('STORAGE'));}};r.onerror=()=>reject(new Error('STORAGE'));r.onabort=()=>reject(new Error('CANCELLED'));r.send(file);});
  setCompleted(true);setMessage(result.matchedKnownBytes?'既知の PDF と同じバイト列です。論文の同一性は自動判定しません。':'新しい PDF 版を保存・検証しました。再読み込みして確認できます。');
 }catch(error){const code=error instanceof Error?error.message:'STORAGE';setMessage(`${code}: ファイルと入力は保持されています。同じ試行を再送できます。別のファイルは新しい試行にしてください。`);}finally{locked.current=false;setBusy(false);xhr.current=null;}}
 async function cancel(){cancelRequested.current=true;xhr.current?.abort();if(busy&&!intent.current){setMessage('開始処理の完了後にキャンセルします。');return;}if(intent.current&&!completed){try{await call('cancel');}catch{setMessage('キャンセルの確定を確認できません。同じ試行の状態を確認してください。');return;}}intent.current=null;requestId.current=null;setProgress(0);setCompleted(false);setFile(null);if(fileInput.current)fileInput.current.value='';setMessage(completed?'別版を追加できます。確定済みの原本と出典は保持されています。':'試行をキャンセルしました。保存済みのオブジェクトは削除されません。');}
 return <section className="panel"><h2>PDF を追加</h2>{!enabled&&<p role="status">非公開 Storage と検証サービスの設定待ちです。アップロードはまだ利用できません。</p>}
 <p>最大 {Math.floor(maxBytes/1024/1024)} MiB。原本は上書きしません。別版は新しい試行として追加してください。</p>
 <form onSubmit={e=>{e.preventDefault();void submit();}}><fieldset disabled={busy||!enabled||completed}>
 <label>PDF ファイル<input ref={fileInput} type="file" accept="application/pdf,.pdf" required disabled={!!intent.current} onChange={e=>{setFile(e.target.files?.[0]??null);requestId.current=null;}}/></label>
 <label>版のラベル<input value={edition} onChange={e=>setEdition(e.target.value)} required maxLength={200} disabled={!!intent.current}/></label>
 <label>取得元 URL または出典<input value={source} onChange={e=>setSource(e.target.value)} required maxLength={2000} disabled={!!intent.current}/></label>
 <label>アクセスの根拠<input value={basis} onChange={e=>setBasis(e.target.value)} required maxLength={500} disabled={!!intent.current}/></label>
 <button type="submit">{busy?'アップロード・検証中…':intent.current?'同じ試行を再送':'PDF をアップロード'}</button></fieldset></form>
 {busy&&<progress value={progress} max={100} aria-label="アップロード進捗"/>}
 {enabled&&<button type="button" onClick={()=>void cancel()} disabled={!intent.current&&!busy}>{completed?'別版の PDF を追加':'キャンセル / 新しい試行'}</button>}
 <p role="status" aria-live="polite">{message}</p></section>;
}

export function PDFRecovery({id,state,enabled}:{id:string;state:string;enabled:boolean}){const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const lock=useRef(false);async function retry(action:string){if(lock.current||!enabled)return;lock.current=true;setBusy(true);try{const r=await fetch(`/api/pdf?action=${action}`,{method:'POST',headers:{'x-upload-intent':id}});if(!r.ok)throw new Error();setMessage(action==='cancel'?'キャンセル済み。原本は削除しません。':'保存済み PDF の再検証が完了しました。再読み込みしてください。');}catch{setMessage('処理を完了できません。原本と試行は保持されています。');}finally{lock.current=false;setBusy(false);}}return <div>{state!=='finalized'&&state!=='cancelled'&&<><button disabled={!enabled||busy} onClick={()=>void retry('finalize')}>保存済み PDF を再検証</button><button disabled={!enabled||busy} onClick={()=>void retry('cancel')}>この試行をキャンセル</button></>}<p role="status">{message}</p></div>;}
