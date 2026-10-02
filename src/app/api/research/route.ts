import {z} from 'zod';
import {caseDAL} from '../../../server/research-cases';
import {AppError,errorMessage} from '../../../application/models';
const input=z.strictObject({action:z.enum(['save','review','archive','stage','apply']),project:z.uuid(),paper:z.uuid(),id:z.uuid(),revision:z.number().int().nonnegative().optional(),payload:z.unknown().optional(),reason:z.string().min(1).max(4000).optional(),raw:z.string().max(131072).optional(),archived:z.boolean().optional()});
export async function POST(request:Request){try{if(request.headers.get('origin')!==new URL(request.url).origin)throw new AppError('FORBIDDEN');const reader=request.body?.getReader();if(!reader)throw new AppError('INVALID');let size=0;const chunks:Uint8Array[]=[];try{while(true){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>262144)throw new AppError('INVALID');chunks.push(r.value);}}finally{await reader.cancel();}const p=input.parse(JSON.parse(Buffer.concat(chunks,size).toString('utf8')));const dal=await caseDAL();let result:unknown;
 if(p.action==='save')result={versionId:await dal.save(p.project,p.paper,p.id,p.revision!,p.payload,p.reason!)};
 else if(p.action==='review')result={versionId:await dal.review(p.project,p.paper,p.id,p.revision!,p.reason!)};
 else if(p.action==='archive'){await dal.archive(p.project,p.paper,p.id,p.revision!,p.archived!);result={saved:true};}
 else if(p.action==='stage')result=await dal.stage(p.project,p.paper,p.id,p.raw!);
 else result=await dal.apply(p.project,p.paper,p.id);
 return Response.json(result,{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){const code=error instanceof AppError?error.code:'INVALID';return Response.json({error:errorMessage[code]},{status:code==='FORBIDDEN'?403:code==='CONFLICT'?409:400,headers:{'Cache-Control':'no-store'}});}}
