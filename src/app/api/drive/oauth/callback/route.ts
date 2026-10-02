import {productionDriveIntegration} from '../../../../../server/drive/runtime';
export async function GET(request:Request){try{return await productionDriveIntegration().callback(request);}catch{return Response.json({error:'UNCONFIGURED'},{status:503,headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}});}}
