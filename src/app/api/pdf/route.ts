import {productionPDFService} from '../../../server/pdf/runtime';
import {PdfError,pdfLimit} from '../../../application/pdf';
export const runtime='nodejs';
async function boundedBody(request:Request,max:number){const reader=request.body?.getReader();if(!reader)throw new PdfError('INVALID_PDF');let size=0;const chunks:Uint8Array[]=[];try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max)throw new PdfError('OVERSIZE');chunks.push(value);}}finally{await reader.cancel();}return Buffer.concat(chunks,size);}
export async function POST(request:Request){
 try{const service=productionPDFService();if(request.headers.get('origin')!==new URL(request.url).origin)throw new PdfError('FORBIDDEN');const action=new URL(request.url).searchParams.get('action');const id=request.headers.get('x-upload-intent')??'';
  if(action==='upload')return Response.json(await service.upload(id,await boundedBody(request,pdfLimit())),{headers:{'Cache-Control':'no-store'}});
  if(action==='begin')return Response.json(await service.begin(JSON.parse((await boundedBody(request,16384)).toString('utf8'))),{headers:{'Cache-Control':'no-store'}});
  if(action==='finalize')return Response.json(await service.finalize(id),{headers:{'Cache-Control':'no-store'}});
  if(action==='cancel'){await service.cancel(id);return Response.json({cancelled:true},{headers:{'Cache-Control':'no-store'}});}
  throw new PdfError('CONFLICT');
 }catch(error){return Response.json({error:error instanceof PdfError?error.code:'STORAGE'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
