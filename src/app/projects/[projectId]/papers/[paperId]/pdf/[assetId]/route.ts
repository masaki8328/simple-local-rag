// Superseded Storage signing endpoint; cannot be enabled with an environment flag.
export async function GET(){return Response.json({error:'SUPERSEDED_USE_DRIVE'},{status:410,headers:{'Cache-Control':'no-store'}});}
