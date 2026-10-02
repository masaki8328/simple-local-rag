import 'server-only';
export function supabaseConfig(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key||!key.startsWith('sb_publishable_'))return null;
 try{const parsed=new URL(url);if(parsed.protocol!=='https:'||parsed.username||parsed.password)return null;}catch{return null;}
 return {url,key};
}
