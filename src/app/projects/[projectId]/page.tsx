import Link from 'next/link';
import {randomUUID} from 'node:crypto';
import {researchDAL} from '../../../server/dal';
import {AccessState,Header} from '../../../components/access';
import {ProjectForm,PaperForm,ArchiveForm} from '../../../components/forms';
export const dynamic='force-dynamic';
export default async function ProjectPage({params}:{params:Promise<{projectId:string}>}){
 let project,papers;
 try{const {projectId}=await params;const dal=await researchDAL();project=await dal.project(projectId);papers=await dal.papers(projectId);}catch(error){return <main><Header/><AccessState error={error}/></main>;}
 return <main><Header/><Link className="back" href="/projects">← プロジェクト一覧</Link><div className="page-heading"><div><p className="eyebrow">PROJECT</p><h1>{project.name}</h1></div><span className="badge">{project.archived_at?'アーカイブ':'進行中'}</span></div><p>{project.description}</p>
 <div className="workspace-grid"><section className="panel"><h2>論文</h2><p><Link href={`/projects/${project.id}/reactions`}>反応グラフ・根拠の集約・人によるレビュー →</Link></p><p><Link href={`/projects/${project.id}/literature`}>文献を検索・Research Question を記録 →</Link></p><p><Link href={`/projects/${project.id}/questions`}>Research Questions・回答・調査データ入出力 →</Link></p><Link href={`/projects/${project.id}/pdf-queue`}>PDF 待ちキュー →</Link>{!papers.length?<p className="empty">まだ論文はありません。書誌情報から登録できます。</p>:<ul className="record-list">{papers.map(p=><li key={p.id}><Link href={`/projects/${project.id}/papers/${p.id}`}>{p.title}</Link><p>{p.year??'出版年未登録'} · {p.journal||'掲載誌未登録'}</p>{p.archived_at&&<span className="badge">アーカイブ</span>}</li>)}</ul>}</section>
 {!project.archived_at&&<section className="panel"><h2>論文を登録</h2><PaperForm projectId={project.id} requestId={randomUUID()}/></section>}</div>
 <section className="panel settings"><h2>プロジェクト設定</h2>{!project.archived_at&&<ProjectForm key={project.revision} project={project}/>}<ArchiveForm key={`archive-${project.revision}`} projectId={project.id} revision={project.revision} archived={!!project.archived_at}/></section></main>;
}
