'use client';
import {useActionState,useEffect,useRef} from 'react';
import {useFormStatus} from 'react-dom';
import {useRouter} from 'next/navigation';
import type {FormState,Project,Paper} from '../application/models';
import {createProject,editProject,createPaper,editPaper,archiveRecord,signIn} from '../server/actions';
function Submit({label}:{label:string}){const {pending}=useFormStatus();return <button type="submit" disabled={pending}>{pending?'処理中…':label}</button>;}
function ActionForm({action,children,label}:{action:(state:FormState,data:FormData)=>Promise<FormState>;children:React.ReactNode;label:string}){
 const [state,dispatch,pending]=useActionState(action,{});
 const router=useRouter();const ref=useRef<HTMLFormElement>(null);
 // Keep drafts on server-side errors: React otherwise resets uncontrolled forms on action return.
 const draft=useRef<[string,FormDataEntryValue][]>([]);
 useEffect(()=>{
  if(state.error&&ref.current){for(const [key,value] of draft.current){const element=ref.current.elements.namedItem(key);if((element instanceof HTMLInputElement||element instanceof HTMLTextAreaElement)&&element.type!=='password'&&typeof value==='string')element.value=value;}}
  if(state.destination){router.push(state.destination);router.refresh();}
  else if(state.success)router.refresh();
 },[state,router]);
 return <form ref={ref} action={dispatch} onSubmit={event=>{if(pending){event.preventDefault();return;}draft.current=[...new FormData(event.currentTarget).entries()].filter(([key])=>key!=='password');}} aria-busy={pending}>
  <fieldset disabled={pending}>{children}<Submit label={label}/></fieldset>
  {state.error&&<p role="alert" className="form-error">{state.error} <button type="button" className="text-button" onClick={()=>window.location.reload()}>再読み込み</button></p>}
  {state.success&&<p role="status">{state.success}</p>}
 </form>;
}
export function ProjectForm({project,requestId}:{project?:Project;requestId?:string}){return <ActionForm action={project?editProject:createProject} label={project?'変更を保存':'プロジェクトを作成'}>
 {project?<><input type="hidden" name="project_id" value={project.id}/><input type="hidden" name="revision" value={project.revision}/></>:<input type="hidden" name="request_id" value={requestId}/>}
 <label>名前<input name="name" required maxLength={200} defaultValue={project?.name}/></label>
 <label>説明<textarea name="description" maxLength={4000} defaultValue={project?.description}/></label>
 </ActionForm>;}
export function PaperForm({projectId,paper,requestId}:{projectId:string;paper?:Paper;requestId?:string}){return <ActionForm action={paper?editPaper:createPaper} label={paper?'変更を保存':'論文を登録'}>
 <input type="hidden" name="project_id" value={projectId}/>
 {paper?<><input type="hidden" name="paper_id" value={paper.id}/><input type="hidden" name="revision" value={paper.revision}/></>:<input type="hidden" name="request_id" value={requestId}/>}
 <label>タイトル<input name="title" required maxLength={500} defaultValue={paper?.title}/></label>
 <div className="form-columns"><label>掲載誌<input name="journal" maxLength={500} defaultValue={paper?.journal??''}/></label><label>出版年<input name="year" inputMode="numeric" pattern="[0-9]{4}" placeholder="例: 2026" defaultValue={paper?.year??''}/></label></div>
 {!paper&&<label>DOI（任意）<input name="doi" maxLength={1000} placeholder="10.xxxx/… または https://doi.org/…"/><small>重複は通知します。別の論文への自動統合は行いません。</small></label>}
 <label>メモ<textarea name="notes" maxLength={10000} defaultValue={paper?.notes??''}/></label>
 </ActionForm>;}
export function ArchiveForm({projectId,paperId,revision,archived}:{projectId:string;paperId?:string;revision:number;archived:boolean}){return <ActionForm action={archiveRecord} label={archived?'復元する':'アーカイブする'}>
 <input type="hidden" name="project_id" value={projectId}/>{paperId&&<input type="hidden" name="paper_id" value={paperId}/>}
 <input type="hidden" name="revision" value={revision}/><input type="hidden" name="archived" value={String(!archived)}/>
 <p className="notice">{archived?'履歴を保持したまま通常の一覧へ戻します。':'削除せず保管します。いつでも復元できます。'}</p>
 </ActionForm>;}
export function LoginForm(){return <ActionForm action={signIn} label="ログイン"><label>メールアドレス<input type="email" name="email" autoComplete="username" required/></label><label>パスワード<input type="password" name="password" autoComplete="current-password" required/></label></ActionForm>;}
