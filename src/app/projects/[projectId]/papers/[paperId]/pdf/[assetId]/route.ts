import {verifiedAsset} from '../../../../../../../server/pdf/queries';
import {privateStorage} from '../../../../../../../server/pdf/storage';
import {SIGNED_VIEW_SECONDS} from '../../../../../../../application/pdf';
import {pdfUploadAvailable} from '../../../../../../../server/pdf/runtime';
export async function GET(_request:Request,{params}:{params:Promise<{projectId:string;paperId:string;assetId:string}>}){if(!pdfUploadAvailable)return new Response('Google Drive 保存の接続待ちです。',{status:503,headers:{'Cache-Control':'no-store'}});try{const p=await params;const {client,path}=await verifiedAsset(p.projectId,p.paperId,p.assetId);const url=await privateStorage(client).sign(path,SIGNED_VIEW_SECONDS);return new Response(null,{status:303,headers:{Location:url,'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}});}catch{return new Response('PDF を表示できません。再ログインまたは権限を確認してください。',{status:403,headers:{'Cache-Control':'no-store'}});}}
