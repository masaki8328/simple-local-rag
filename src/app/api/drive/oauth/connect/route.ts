import {productionDriveIntegration} from '../../../../../server/drive/runtime';
export async function POST(request:Request){try{return await productionDriveIntegration().connect(request);}catch{return Response.json({error:'UNCONFIGURED'},{status:503,headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}});}}
