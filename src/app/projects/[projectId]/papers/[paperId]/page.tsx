import Link from 'next/link';
import {researchDAL} from '../../../../../server/dal';
import {AccessState,Header} from '../../../../../components/access';
import {PaperForm,ArchiveForm} from '../../../../../components/forms';
import {PDFUpload,PDFRecovery} from '../../../../../components/pdf-upload';
import {pdfUploadAvailable} from '../../../../../server/pdf/runtime';
import {paperPDFs,paperAttempts} from '../../../../../server/pdf/queries';
import {pdfLimit} from '../../../../../application/pdf';
export const dynamic='force-dynamic';
export default async function PaperPage({params}:{params:Promise<{projectId:string;paperId:string}>}){
 let project,paper;
 try{const {projectId,paperId}=await params;const dal=await researchDAL();project=await dal.project(projectId);paper=await dal.paper(projectId,paperId);}catch(error){return <main><Header/><AccessState error={error}/></main>;}
 const attempts=await paperAttempts(project.id,paper.id).catch(()=>null);
 const documents=await paperPDFs(project.id,paper.id).catch(()=>null);
 return <main><Header/><Link className="back" href={`/projects/${project.id}`}>← {project.name}</Link><div className="page-heading"><div><p className="eyebrow">PAPER · REVISION {paper.revision}</p><h1>{paper.title}</h1></div><span className="badge">{paper.archived_at?'アーカイブ':'登録済み'}</span></div>
 <section className="panel"><dl className="metadata"><dt>掲載誌 / 年</dt><dd>{paper.journal||'未登録'} / {paper.year??'未登録'}</dd><dt>DOI</dt><dd>{paper.doi||'未登録'}</dd><dt>メモ</dt><dd className="preserve-lines">{paper.notes||'未登録'}</dd></dl><p className="notice">DOI は出典履歴を保つため、この段階では登録後の変更はできません。</p></section>
 <p><Link href={`/projects/${project.id}/papers/${paper.id}/research`}>反応・実験・根拠を編集 →</Link></p>
 <section className="panel"><h2>非公開 PDF</h2>{documents===null?<p>PDF 情報を読み込めません。初期設定を確認してください。</p>:documents.length?documents.map(d=><p key={d.id}><Link prefetch={false} href={`/projects/${project.id}/papers/${paper.id}/pdf/${d.document_asset_id}`}>{d.edition_label} を表示</Link> · 署名 URL は 60 秒間有効<br/>{d.pageCount??'不明'} 物理ページ · 取得元: {d.acquired_from}<br/><small style={{overflowWrap:'anywhere'}}>SHA-256: {d.sha256??'未確認'}</small></p>):<p>本文 PDF 待ち</p>}</section>
 <section className="panel"><h2>アップロード試行と復旧</h2>{attempts?.map(i=><div key={i.id}><p>{i.original_filename} · {i.edition_label} · {i.state} · 期限 {i.expires_at}</p><PDFRecovery id={i.id} state={i.state} enabled={pdfUploadAvailable}/></div>)??<p>初期設定後に試行履歴を表示します。</p>}</section>
 <PDFUpload projectId={project.id} paperId={paper.id} enabled={pdfUploadAvailable&&!project.archived_at&&!paper.archived_at} maxBytes={pdfLimit()}/>
 {!project.archived_at&&!paper.archived_at&&<section className="panel settings"><h2>書誌情報を編集</h2><PaperForm key={paper.revision} projectId={project.id} paper={paper}/></section>}
 {!project.archived_at?<section className="panel settings"><h2>保管と復元</h2><ArchiveForm key={`archive-${paper.revision}`} projectId={project.id} paperId={paper.id} revision={paper.revision} archived={!!paper.archived_at}/></section>:<p>変更するには、まずプロジェクトを復元してください。</p>}
 </main>;
}
