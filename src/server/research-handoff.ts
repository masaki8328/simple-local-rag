import 'server-only';
import {z} from 'zod';
import type {SupabaseClient} from '@supabase/supabase-js';
import {questionRevisionSchema,parseResearchResult,handoffInstructions,type QuestionRevision,type QuestionState} from '../domain/research-handoff';
import {caseDiff,type CaseVersion,type CaseImport} from '../domain/research-case';
import {AppError} from '../application/models';
import {researchDAL} from './dal';
import {userClient} from './supabase/client';
export type HandoffRequest={id:string;question_id:string;paper_id:string;case_id:string;content_hash:string;created_at:string;snapshot:{case_version_id:string;case_import:CaseImport;question:{id:string;question:string;revision:number};sources:unknown[]}};
export type HandoffResult={id:string;request_id:string;batch_id:string;raw_content:string;created_at:string};
function fail(error:{message:string}|null){if(error)throw new AppError(error.message==='KG_CONFLICT'?'CONFLICT':error.message==='KG_FORBIDDEN'?'FORBIDDEN':error.message==='KG_ARCHIVED'?'ARCHIVED':'INVALID');}
export class HandoffDAL{
 constructor(private client:SupabaseClient,private authorize:(project:string)=>Promise<void>){}
 private async scope(project:string){z.uuid().parse(project);await this.authorize(project);}
 async overview(project:string){
  await this.scope(project);
  // Exact counts plus stable paging detect server row caps instead of treating omitted records as current.
  const read=async(table:string,columns:string)=>{
   const rows:Record<string,unknown>[]=[];let total:number|null=null;
   for(let page=0;page<100;page++){
    const r=await this.client.from(table).select(columns,{count:'exact'}).eq('project_id',project).order('id').range(rows.length,rows.length+499);
    fail(r.error);if(r.count===null||r.count===undefined||r.count>10000||total!==null&&total!==r.count)throw new AppError('UNAVAILABLE');total=r.count;
    const data=r.data as unknown as Record<string,unknown>[];
    if(!data||!data.length&&rows.length<total)throw new AppError('UNAVAILABLE');rows.push(...data);
    if(rows.length===total){if(new Set(rows.map(x=>x.id)).size!==rows.length)throw new AppError('UNAVAILABLE');return rows;}
    if(rows.length>total)throw new AppError('UNAVAILABLE');
   }throw new AppError('UNAVAILABLE');
  };
  const [q,revisions,requests,returned,allCases,versions,reviews,attestations,anchors,papers]=await Promise.all([
   read('research_questions','id,question'),read('question_revisions','id,question_id,revision,data,created_at'),
   read('research_requests','id,question_id,paper_id,case_id,content_hash,created_at,snapshot'),read('research_results','id,request_id,batch_id,raw_content,created_at'),
   read('research_cases','id,paper_id,current_version_id,revision,archived_at'),read('research_case_versions','id,case_id,revision,payload,author_kind,review_state,confirmation,change_reason,created_at'),
   read('scientific_evidence_reviews','id,case_version_id,decision,source_attestation_id,revision'),read('source_attestations','id,anchor_id,decision,revision'),read('source_anchors','id,supersedes_anchor_id'),read('papers','id,archived_at')
  ]);
  const history=(revisions as unknown as {id:string;question_id:string;revision:number;data:QuestionRevision;created_at:string}[]).sort((a,b)=>b.revision-a.revision);
  const caseVersions=versions as unknown as CaseVersion[];
  const cases=(allCases as unknown as {id:string;paper_id:string;current_version_id:string;revision:number;archived_at:string|null}[]).filter(c=>c.archived_at===null&&papers.some(p=>p.id===c.paper_id&&p.archived_at===null));
  reviews.sort((a,b)=>Number(b.revision)-Number(a.revision));attestations.sort((a,b)=>Number(b.revision)-Number(a.revision));
  const invalid=new Set(caseVersions.filter(v=>{const r=reviews.find(r=>r.case_version_id===v.id),a=attestations.find(a=>a.anchor_id===v.payload.evidence.source_anchor_id);return !cases.some(c=>c.current_version_id===v.id)||r?.decision!=='accepted'||!a||a.decision!=='attested'||a.id!==r.source_attestation_id||!anchors.some(a=>a.id===v.payload.evidence.source_anchor_id)||anchors.some(a=>a.supersedes_anchor_id===v.payload.evidence.source_anchor_id);}).map(v=>v.id));
  for(const h of history)for(const id of h.data.evidence_versions)if(!caseVersions.some(v=>v.id===id))invalid.add(id);
  const newest=(rows:Record<string,unknown>[])=>rows.sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))).slice(0,30);
  return {invalidEvidenceVersions:[...invalid],questions:q.map(q=>{const v=history.find(v=>v.question_id===q.id);return {id:q.id,question:v?.data.question??q.question,revision:v?.revision??0,data:v?.data??null} as QuestionState;}),history,requests:newest(requests) as unknown as HandoffRequest[],results:newest(returned) as unknown as HandoffResult[],cases,versions:caseVersions};
 }
 async revise(project:string,question:string,id:string,expected:number,data:unknown){await this.scope(project);z.uuid().parse(question);z.uuid().parse(id);z.number().int().nonnegative().parse(expected);const r=await this.client.rpc('revise_research_question',{p_project:project,p_question:question,p_id:id,p_expected:expected,p_data:questionRevisionSchema.parse(data)});fail(r.error);return r.data as string;}
 async request(project:string,id:string,question:string,paper:string,caseId:string){await this.scope(project);[id,question,paper,caseId].forEach(v=>z.uuid().parse(v));const r=await this.client.rpc('create_research_request',{p_project:project,p_id:id,p_question:question,p_paper:paper,p_case:caseId});fail(r.error);return r.data as string;}
 async download(project:string,id:string){await this.scope(project);z.uuid().parse(id);const r=await this.client.from('research_requests').select('id,content_hash,snapshot').eq('project_id',project).eq('id',id).maybeSingle();fail(r.error);if(!r.data)throw new AppError('FORBIDDEN');return {...r.data.snapshot,request_id:r.data.id,request_hash:r.data.content_hash,instructions:handoffInstructions,result_template:{schema_version:'research-result/0.1',request_id:r.data.id,request_hash:r.data.content_hash,case_import:r.data.snapshot.case_import,conclusion:'',uncertainties:[]}};}
 async stage(project:string,id:string,raw:string){await this.scope(project);z.uuid().parse(id);const p=parseResearchResult(raw);if(p.case_import.project_id!==project)throw new AppError('FORBIDDEN');const r=await this.client.rpc('stage_research_result',{p_project:project,p_id:id,p_raw:raw});fail(r.error);const c=await this.client.from('research_cases').select('revision,current_version_id').eq('project_id',project).eq('id',p.case_import.case_id).maybeSingle();fail(c.error);const v=await this.client.from('research_case_versions').select('payload,author_kind,review_state').eq('project_id',project).eq('id',c.data?.current_version_id).maybeSingle();fail(v.error);return {batchId:r.data as string,caseId:p.case_import.case_id,paperId:p.case_import.paper_id,diff:caseDiff(v.data?.payload??null,p.case_import.payload),humanProtected:v.data?.author_kind==='human'||v.data?.review_state?.startsWith('human_'),stale:c.data?.revision!==p.case_import.expected_revision};}
}
export async function handoffDAL(){return new HandoffDAL(await userClient(),async p=>{await (await researchDAL()).project(p);});}
