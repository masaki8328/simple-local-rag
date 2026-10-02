import {z} from 'zod';
export const uuid=z.uuid();
const title=z.string().trim().min(1,'タイトルを入力してください。').max(500);
const year=z.union([z.literal(''),z.string().regex(/^\d{4}$/)]).transform(v=>v===''?null:Number(v)).refine(v=>v===null || (v>=1000&&v<=new Date().getUTCFullYear()+1),'出版年を確認してください。');
export function normalizeDoi(value:string) {return value.trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i,'').replace(/^doi:\s*/i,'').toLowerCase();}
const doi=z.string().max(1000).transform(normalizeDoi).refine(v=>v===''||/^10\.\d{4,9}\/[^\s<>]+$/i.test(v),'DOIの形式を確認してください。');
export const projectInput=z.strictObject({name:z.string().trim().min(1).max(200),description:z.string().trim().max(4000)});
export const createProjectInput=projectInput.extend({request_id:uuid});
export const editProjectInput=projectInput.extend({project_id:uuid,revision:z.coerce.number().int().positive()});
export const paperInput=z.strictObject({title,journal:z.string().trim().max(500),year,notes:z.string().trim().max(10000)});
export const createPaperInput=paperInput.extend({project_id:uuid,request_id:uuid,doi});
export const editPaperInput=paperInput.extend({project_id:uuid,paper_id:uuid,revision:z.coerce.number().int().positive()});
export const archiveInput=z.strictObject({project_id:uuid,paper_id:uuid.optional(),revision:z.coerce.number().int().positive(),archived:z.enum(['true','false']).transform(v=>v==='true')});
export type Project={id:string;name:string;description:string;revision:number;archived_at:string|null};
export type Paper={authors?:string;abstract?:string|null;canonical_url?:string|null;relevance?:string|null;id:string;project_id:string;title:string;journal:string|null;year:number|null;notes:string|null;revision:number;archived_at:string|null;doi:string|null};
export type ErrorCode='CONFIGURATION'|'UNAUTHENTICATED'|'FORBIDDEN'|'INVALID'|'CONFLICT'|'DUPLICATE_TITLE'|'DUPLICATE_DOI'|'ARCHIVED'|'UNAVAILABLE'|'REJECTED';
export class AppError extends Error {constructor(public code:ErrorCode){super(code);}}
export const errorMessage:Record<ErrorCode,string>={REJECTED:'この候補は却下済みです。理由を確認し、再検討として記録してから採用してください。',CONFIGURATION:'Supabase の設定が必要です。管理者の設定完了後にお試しください。',UNAUTHENTICATED:'ログインしてください。',FORBIDDEN:'この項目は見つからないか、アクセス権がありません。',INVALID:'入力内容を確認してください。',CONFLICT:'別の更新または送信済みの内容と競合しました。再読み込みして確認してください。',DUPLICATE_TITLE:'同じタイトルの論文があります。一覧で確認してください。自動統合は行いません。',DUPLICATE_DOI:'この DOI は登録済みです。一覧で確認してください。自動統合は行いません。',ARCHIVED:'プロジェクトまたは論文を復元してから編集してください。',UNAVAILABLE:'現在処理できません。入力を保ったまま、しばらくして再試行してください。'};
export type FormState={error?:string;success?:string;destination?:string};
