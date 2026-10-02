import Link from 'next/link';
import {researchDAL} from '../../../../server/dal';
import {pdfQueue} from '../../../../server/pdf/queries';
import {driveAvailable} from '../../../../server/drive/runtime';
import {DriveUpload} from '../../../../components/drive-upload';
import {AccessState,Header} from '../../../../components/access';

export const dynamic='force-dynamic';
function safeURL(value:string|null){try{const u=new URL(value??'');return ['https:','http:'].includes(u.protocol)?u.href:null;}catch{return null;}}
export default async function Queue({params}:{params:Promise<{projectId:string}>}){let project,papers,projectId;try{({projectId}=await params);project=await (await researchDAL()).project(projectId);papers=await pdfQueue(projectId);}catch(error){return <main><Header/><AccessState error={error}/></main>;}return <main><Header/><Link href={`/projects/${projectId}`}>← {project.name}</Link><h1>PDF が必要な論文</h1><p>本文 PDF が未登録の論文です。論文情報と PDF の版は別々に保管します。</p>{!papers.length&&<p>現在、PDF 待ちはありません。</p>}{papers.map(p=><article className="panel" key={p.id}><h2><Link href={`/projects/${projectId}/papers/${p.id}`}>{p.title}</Link></h2><dl className="metadata"><dt>著者 / 年</dt><dd>{p.authors||'著者未登録'} / {p.year??'年不明'}</dd><dt>DOI</dt><dd>{p.doi??'未登録'}</dd><dt>取得元</dt><dd>{safeURL(p.canonical_url)?<a href={safeURL(p.canonical_url)!} rel="noreferrer">論文の取得元</a>:'未登録'}</dd><dt>優先度 / 調査理由</dt><dd>{p.priority??'未設定'} / {p.investigation_reason??'未登録'}</dd><dt>Research Question</dt><dd>リンク機能は今後追加予定</dd></dl><DriveUpload projectId={projectId} paperId={p.id} enabled={driveAvailable&&!project.archived_at}/></article>)}</main>;}
