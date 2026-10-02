import {z} from 'zod';
import {handoffDAL} from '../../../server/research-handoff';
import {AppError,errorMessage} from '../../../application/models';
const ids={project:z.uuid(),id:z.uuid()};
const input=z.discriminatedUnion('action',[
 z.strictObject({...ids,action:z.literal('revise'),question:z.uuid(),expected:z.number().int().nonnegative(),data:z.unknown()}),
 z.strictObject({...ids,action:z.literal('request'),question:z.uuid(),paper:z.uuid(),caseId:z.uuid()}),
 z.strictObject({...ids,action:z.literal('stage'),raw:z.string()}),
]);
const headers={'Cache-Control':'private, no-store'};
function failure(e:unknown){const code=e instanceof AppError?e.code:'INVALID';return Response.json({error:errorMessage[code]},{status:code==='FORBIDDEN'?403:code==='CONFLICT'?409:400,headers});}
export async function GET(request:Request){try{const u=new URL(request.url),p=z.object(ids).parse({project:u.searchParams.get('project'),id:u.searchParams.get('id')});const data=await (await handoffDAL()).download(p.project,p.id);return Response.json(data,{headers:{...headers,'Content-Disposition':`attachment; filename="research-request-${p.id}.json"`,'X-Content-Type-Options':'nosniff'}});}catch(e){return failure(e);}}
export async function POST(request:Request){try{if(request.headers.get('origin')!==new URL(request.url).origin)throw new AppError('FORBIDDEN');const reader=request.body?.getReader();if(!reader)throw new AppError('INVALID');const parts:Uint8Array[]=[];let size=0;try{while(true){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>393216)throw new AppError('INVALID');parts.push(r.value);}}finally{await reader.cancel();}const p=input.parse(JSON.parse(Buffer.concat(parts,size).toString('utf8'))),dal=await handoffDAL();const result=p.action==='request'?{id:await dal.request(p.project,p.id,p.question,p.paper,p.caseId)}:p.action==='revise'?{id:await dal.revise(p.project,p.question,p.id,p.expected,p.data)}:await dal.stage(p.project,p.id,p.raw);return Response.json(result,{headers});}catch(e){return failure(e);}}
