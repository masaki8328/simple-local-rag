import {productionDriveService} from '../../../server/drive/runtime';
import {DriveError} from '../../../application/drive';
// No body is consumed while configuration/capability gates are closed.
export async function POST(){try{productionDriveService();return Response.json({error:'UNCONFIGURED'},{status:503});}catch(e){return Response.json({error:e instanceof DriveError?e.code:'UNCONFIGURED'},{status:503,headers:{'Cache-Control':'no-store'}});}}
