import 'server-only';
import type {SupabaseClient} from '@supabase/supabase-js';
import {PdfError,type Intent,type Finalized,type VerifiedPDF} from '../../application/pdf';
import {ResearchDAL} from '../research';
import {supabaseGateway} from '../dal';
import type {PdfRepository} from './service';
// Future isolated worker MUST independently verify jwt and bind its database
// transaction's caller identity to that subject, never to a client-supplied ID.
// If exposed across a network, the worker must re-read and verify stored bytes;
// never accept the verified fields below as client attestations. This callback
// is an internal trusted boundary, not a public API request schema.
export type TrustedFinalizer=(request:{jwt:string;intentId:string;verified:VerifiedPDF})=>Promise<Finalized>;
function fail(error:{message:string}|null){if(error)throw new PdfError(error.message==='KG_FORBIDDEN'?'FORBIDDEN':error.message==='KG_CONFLICT'?'CONFLICT':'DATABASE');}
export function pdfRepository(client:SupabaseClient,commit:TrustedFinalizer):PdfRepository{
 const dal=new ResearchDAL(supabaseGateway(client));
 return {
  async authorize(projectId,paperId){const project=await dal.project(projectId);const paper=await dal.paper(projectId,paperId);if(project.archived_at||paper.archived_at)throw new PdfError('FORBIDDEN');},
  async intent(i){const {data,error}=await client.rpc('begin_pdf_upload',{p_id:i.requestId,p_project:i.projectId,p_paper:i.paperId,p_filename:i.filename,p_size:i.size,p_hash:i.expectedHash,p_edition:i.edition,p_source:i.source,p_access:i.accessBasis});fail(error);if(data!==i.requestId)throw new PdfError('DATABASE');return this.getIntent(data);},
  async getIntent(id){const {data:i,error}=await client.from('upload_intents').select('id,project_id,paper_id,original_filename,expected_size,expected_hash,edition_label,acquired_from,access_basis,expires_at,state,result_asset_id').eq('id',id).maybeSingle();fail(error);if(!i)throw new PdfError('FORBIDDEN');return {id:i.id,requestId:i.id,projectId:i.project_id,paperId:i.paper_id,filename:i.original_filename,size:Number(i.expected_size),expectedHash:i.expected_hash,edition:i.edition_label,source:i.acquired_from,accessBasis:i.access_basis,expiresAt:Date.parse(i.expires_at),state:i.state,assetId:i.result_asset_id,path:`${i.project_id}/${i.id}/original.pdf`} as Intent;},
  async mark(id,state){const {error}=await client.rpc('mark_pdf_upload',{p_id:id,p_state:state});fail(error);},
  async finalize(i,verified){const claims=await client.auth.getClaims();if(claims.error||!claims.data?.claims.sub)throw new PdfError('FORBIDDEN');
   // getSession supplies a token only AFTER verified claims; it does not authorize.
   const session=await client.auth.getSession();if(session.error||!session.data.session)throw new PdfError('FORBIDDEN');return commit({jwt:session.data.session.access_token,intentId:i.id,verified});
  },
  async asset(projectId,paperId,assetId){const link=await client.from('paper_documents').select('id').eq('project_id',projectId).eq('paper_id',paperId).eq('document_asset_id',assetId).limit(1);fail(link.error);if(!link.data?.length)throw new PdfError('FORBIDDEN');const asset=await client.from('document_assets').select('storage_path').eq('project_id',projectId).eq('id',assetId).eq('upload_state','verified').maybeSingle();fail(asset.error);if(!asset.data)throw new PdfError('FORBIDDEN');return {path:asset.data.storage_path};}
 };
}
