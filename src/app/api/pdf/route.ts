// Superseded permanently. Never accepts PDF bodies or calls the old Storage service.
export async function POST(){return Response.json({error:'SUPERSEDED_USE_DRIVE'},{status:410,headers:{'Cache-Control':'no-store'}});}
