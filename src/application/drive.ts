import {z} from 'zod';
import {uuid} from './models';
export const DRIVE_TARGET_BYTES=100_000_000;
export const DRIVE_SCOPE='https://www.googleapis.com/auth/drive.file';
export const driveInput=z.strictObject({id:uuid,projectId:uuid,paperId:uuid,filename:z.string().min(1).max(255),size:z.number().int().positive().max(DRIVE_TARGET_BYTES),edition:z.string().min(1).max(200),source:z.string().min(1).max(2000),accessBasis:z.string().min(1).max(500)});
export type DriveInput=z.infer<typeof driveInput>;
export type DriveCode='UNCONFIGURED'|'FORBIDDEN'|'RECONNECT'|'WRONG_ACCOUNT'|'QUOTA_UNKNOWN'|'QUOTA'|'UNAVAILABLE'|'REPLACED'|'RETRYABLE'|'EXPIRED'|'CANCELLED'|'INVALID_PDF'|'OVERSIZE'|'CONFLICT'|'DOWNLOAD_UNPROVEN';
export class DriveError extends Error{constructor(public readonly code:DriveCode){super(code);}}
export type DriveBinding={id:string;accountId:string;folderId:string};
export type DriveIntent=DriveInput & {binding:DriveBinding;fileId:string;expiresAt:number;cancelled:boolean};
export type DriveReceipt={id:string;intentId:string;projectId:string;paperId:string;provider:'google_drive';fileId:string;revisionId:string;sha256:string;byteSize:number;state:'stored_unparsed'};
export type SourceEvent='unavailable'|'replaced'|'retryable'|'invalid_bytes'|'checked';

const safeCodes:readonly DriveCode[]=['UNCONFIGURED','FORBIDDEN','RECONNECT','WRONG_ACCOUNT','QUOTA_UNKNOWN','QUOTA','UNAVAILABLE','REPLACED','RETRYABLE','EXPIRED','CANCELLED','INVALID_PDF','OVERSIZE','CONFLICT','DOWNLOAD_UNPROVEN'];
export function safeDriveCode(body:unknown):DriveCode{const value=body&&typeof body==='object'&&'error' in body?body.error:null;return typeof value==='string'&&safeCodes.includes(value as DriveCode)?value as DriveCode:'RETRYABLE';}
export function driveRecovery(code:DriveCode):string{
 switch(code){
  case 'RECONNECT':return '接続が失効しています。Google Drive を再接続してから再開してください。';
  case 'WRONG_ACCOUNT':return '接続した Google アカウントが異なります。元のアカウントで再接続してください。';
  case 'QUOTA':case 'QUOTA_UNKNOWN':return '保存容量を確認してください。容量を確保するか、新しい試行で別のファイルを選んでください。';
  case 'EXPIRED':return '転送期限が切れました。「別版・新しい試行」でやり直してください。';
  case 'FORBIDDEN':return 'アクセスできません。所有者と接続権限を確認してください。';
  case 'CANCELLED':return '転送を中断しました。同じ試行で再開できます。';
  case 'UNCONFIGURED':return 'Drive 接続は未設定です。設定完了までアップロードできません。';
  case 'INVALID_PDF':case 'OVERSIZE':case 'REPLACED':return 'ファイルを確認し、別版・新しい試行で追加してください。';
  default:return '一時的に処理できません。同じ試行で再開できます。';
 }
}
