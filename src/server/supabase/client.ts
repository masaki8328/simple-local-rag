import 'server-only';
import {createServerClient} from '@supabase/ssr';
import {cookies} from 'next/headers';
import {AppError} from '../../application/models';
import {supabaseConfig} from './config';
export async function userClient(){
 const config=supabaseConfig();if(!config)throw new AppError('CONFIGURATION');
 const store=await cookies();
 return createServerClient(config.url,config.key,{cookies:{
  getAll:()=>store.getAll(),
  setAll:values=>{try{for(const {name,value,options} of values)store.set(name,value,options);}catch{/* Server Components cannot write cookies; proxy refreshes them. */}}
 }});
}
