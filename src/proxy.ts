import {createServerClient} from '@supabase/ssr';
import {NextResponse,type NextRequest} from 'next/server';
import {supabaseConfig} from './server/supabase/config';
export async function proxy(request:NextRequest){
 let response=NextResponse.next({request});
 const config=supabaseConfig();
 if(config){
  const client=createServerClient(config.url,config.key,{cookies:{getAll:()=>request.cookies.getAll(),setAll:(values,headers)=>{
   for(const {name,value} of values)request.cookies.set(name,value);
   response=NextResponse.next({request});
   for(const {name,value,options} of values)response.cookies.set(name,value,options);
   for(const [name,value] of Object.entries(headers))response.headers.set(name,value);
  }}});
  // Refresh/verify, never trust getSession(). Each DAL/action verifies again.
  try{await client.auth.getClaims();}catch{/* The DAL fails closed if verification is unavailable. */}
 }
 response.headers.set('Cache-Control','private, no-cache, no-store, must-revalidate, max-age=0');
 return response;
}
export const config={matcher:['/','/login','/projects/:path*']};
