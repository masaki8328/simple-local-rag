import Link from 'next/link';
import {randomUUID} from 'node:crypto';
import {researchDAL} from '../../server/dal';
import {AccessState,Header} from '../../components/access';
import {ProjectForm} from '../../components/forms';
import {signOut} from '../../server/actions';
export const dynamic='force-dynamic';
export default async function Projects(){
 let projects;
 try{projects=await (await researchDAL()).projects();}catch(error){return <main><Header/><AccessState error={error}/></main>;}
 return <main><Header/><div className="page-heading"><div><p className="eyebrow">YOUR PRIVATE WORKSPACE</p><h1>プロジェクト</h1></div><form action={signOut}><button className="secondary">ログアウト</button></form></div>
 <div className="workspace-grid"><section className="panel"><h2>研究プロジェクト</h2>{!projects.length?<p className="empty">まだプロジェクトはありません。最初の研究プロジェクトを作成してください。</p>:<ul className="record-list">{projects.map(p=><li key={p.id}><Link href={`/projects/${p.id}`}>{p.name}</Link><span className="badge">{p.archived_at?'アーカイブ':'進行中'}</span><p>{p.description||'説明は未登録です。'}</p></li>)}</ul>}</section><section className="panel"><h2>プロジェクトを作成</h2><ProjectForm requestId={randomUUID()}/></section></div></main>;
}
