import {z} from 'zod';
import {uuid} from './models';
export const MAX_PDF_BYTES=4*1024*1024;
export const SIGNED_VIEW_SECONDS=60;
export const uploadInput=z.strictObject({projectId:uuid,paperId:uuid,requestId:uuid,filename:z.string().min(1).max(255),size:z.number().int().positive().max(MAX_PDF_BYTES),expectedHash:z.string().regex(/^[a-f0-9]{64}$/).nullable(),edition:z.string().trim().min(1).max(200),source:z.string().trim().min(1).max(2000),accessBasis:z.string().trim().min(1).max(500)});
export type UploadInput=z.infer<typeof uploadInput>;
export type Intent=UploadInput & {id:string;path:string;expiresAt:number;state:'awaiting'|'failed'|'cancelled'|'finalized';assetId:string|null};
export type VerifiedPDF={sha256:string;byteSize:number;pageCount:number;mime:'application/pdf';verifier:'pdf-lib@1.17.1'};
export type Finalized={assetId:string;documentId:string;matchedKnownBytes:boolean};
export type PdfErrorCode='UNCONFIGURED'|'FORBIDDEN'|'EXPIRED'|'CANCELLED'|'INVALID_PDF'|'OVERSIZE'|'MISMATCH'|'STORAGE'|'DATABASE'|'CONFLICT';
export class PdfError extends Error{constructor(public code:PdfErrorCode){super(code);}}
export function pdfLimit(value=process.env.PDF_MAX_BYTES){if(value===undefined)return MAX_PDF_BYTES;const n=Number(value);if(!Number.isSafeInteger(n)||n<1024||n>MAX_PDF_BYTES)throw new PdfError('UNCONFIGURED');return n;}
