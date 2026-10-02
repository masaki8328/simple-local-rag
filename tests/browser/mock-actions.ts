import type {FormState} from '../../src/application/models';
declare global {interface Window {syntheticCalls:number;syntheticValues:Record<string,FormDataEntryValue>;syntheticDestination?:string;syntheticRefreshes:number;}}
async function rejectSynthetic(_state:FormState,data:FormData):Promise<FormState>{window.syntheticCalls=(window.syntheticCalls??0)+1;window.syntheticValues=Object.fromEntries(data);await new Promise(resolve=>setTimeout(resolve,500));return {error:'SYNTHETIC conflict. Draft retained; reload before retry.'};}
export const createProject=rejectSynthetic,editProject=rejectSynthetic,createPaper=rejectSynthetic,editPaper=rejectSynthetic,archiveRecord=rejectSynthetic,signIn=rejectSynthetic;
