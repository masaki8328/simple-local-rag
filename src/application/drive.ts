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
