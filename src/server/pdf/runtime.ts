import 'server-only';
import {PdfError} from '../../application/pdf';
import type {PdfService} from './service';
// Deliberately no credential env var or service-role fallback. A reviewed worker
// capability and authenticated binding must be implemented before enabling this.
export function productionPDFService():PdfService{throw new PdfError('UNCONFIGURED');}
export const pdfUploadAvailable=false;
