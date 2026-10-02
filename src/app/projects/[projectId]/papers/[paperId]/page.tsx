import Link from 'next/link';
import {PaperDetailsEditor} from '../../../../../components/literature';
import {researchDAL} from '../../../../../server/dal';
import {AccessState,Header} from '../../../../../components/access';
import {PaperForm,ArchiveForm} from '../../../../../components/forms';
import {DriveRecovery} from '../../../../../components/drive-recovery';
import {DriveUpload} from '../../../../../components/drive-upload';
import {driveAvailable} from '../../../../../server/drive/runtime';
export const dynamic='force-dynamic';
export default async function PaperPage({params}:{params:Promise<{projectId:string;paperId:string}>}){
 let project,paper;
 try{const {projectId,paperId}=await params;const dal=await researchDAL();project=await dal.project(projectId);paper=await dal.paper(projectId,paperId);}catch(error){return <main><Header/><AccessState error={error}/></main>;}
 return <main><Header/><Link className="back" href={`/projects/${project.id}`}>← {project.name}</Link><div className="page-heading"><div><p className="eyebrow">PAPER · REVISION {paper.revision}</p><h1>{paper.title}</h1></div><span className="badge">{paper.archived_at?'アーカイブ':'登録済み'}</span></div>
 <section className="panel"><dl className="metadata"><dt>掲載誌 / 年</dt><dd>{paper.journal||'未登録'} / {paper.year??'未登録'}</dd><dt>DOI</dt><dd>{paper.doi||'未登録'}</dd><dt>メモ</dt><dd className="preserve-lines">{paper.notes||'未登録'}</dd></dl><p className="notice">DOI は出典履歴を保つため、この段階では登録後の変更はできません。</p></section>
 <p><Link href={`/projects/${project.id}/literature`}>参考文献・被引用・関連論文を探索 →</Link></p><p><Link href={`/projects/${project.id}/papers/${paper.id}/research`}>反応・実験・根拠を編集 →</Link></p>
 {driveAvailable&&<form action={`/api/drive/oauth/connect?project=${project.id}`} method="post"><button type="submit">Google Drive を接続・再接続</button></form>}
 <DriveRecovery projectId={project.id} paperId={paper.id} enabled={driveAvailable&&!project.archived_at&&!paper.archived_at}/>
 <DriveUpload projectId={project.id} paperId={paper.id} enabled={driveAvailable&&!project.archived_at&&!paper.archived_at}/>
 {!project.archived_at&&!paper.archived_at&&<PaperDetailsEditor key={`details-${paper.revision}`} project={project.id} paper={paper}/>}{!project.archived_at&&!paper.archived_at&&<section className="panel settings"><h2>書誌情報を編集</h2><PaperForm key={paper.revision} projectId={project.id} paper={paper}/></section>}
 {!project.archived_at?<section className="panel settings"><h2>保管と復元</h2><ArchiveForm key={`archive-${paper.revision}`} projectId={project.id} paperId={paper.id} revision={paper.revision} archived={!!paper.archived_at}/></section>:<p>変更するには、まずプロジェクトを復元してください。</p>}
 </main>;
}
