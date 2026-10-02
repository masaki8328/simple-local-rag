import {sourceDAL} from '../../../../../../server/sources';
import {SourceAnchors} from '../../../../../../components/source-anchors';
import {DraftGraph} from '../../../../../../components/draft-graph';
import {driveAvailable} from '../../../../../../server/drive/runtime';
import Link from 'next/link';import {randomUUID} from 'node:crypto';
import {caseDAL} from '../../../../../../server/research-cases';
import {emptyResearchCase} from '../../../../../../domain/research-case';
import {ResearchCaseEditor,ResearchImport} from '../../../../../../components/research-case';
import {AccessState,Header} from '../../../../../../components/access';
export const dynamic='force-dynamic';
export default async function Research({params}:{params:Promise<{projectId:string;paperId:string}>}){const {projectId,paperId}=await params;let cases,versions,sources;try{const dal=await caseDAL();cases=await dal.list(projectId,paperId);const details=await Promise.all(cases.filter(c=>!c.archived_at).map(c=>dal.detail(projectId,paperId,c.id)));versions=details.flatMap(d=>d?d.versions.filter(v=>v.id===d.record.current_version_id):[]);sources=await (await sourceDAL()).list(projectId,paperId);}catch(error){return <main><Header/><AccessState error={error}/></main>;}return <main><Header/><Link href={`/projects/${projectId}/papers/${paperId}`}>← 論文</Link><h1>反応・実験・根拠</h1><p><Link href={`/projects/${projectId}/reactions`}>プロジェクト全体の反応・対応付け・科学的レビュー →</Link></p><p>ケース編集は下書きとして保存します。出典位置を人が照合し、プロジェクト画面で反応対応と科学的レビューを記録できます。</p><ul>{cases.map(c=><li key={c.id}><Link href={`/projects/${projectId}/papers/${paperId}/research/${c.id}`}>研究ケース · 改訂 {c.revision}{c.archived_at?' · アーカイブ':''}</Link></li>)}</ul><DraftGraph project={projectId} paper={paperId} versions={versions}/><SourceAnchors project={projectId} paper={paperId} documents={sources.documents} anchors={sources.anchors} attestations={sources.attestations} driveEnabled={driveAvailable}/><ResearchCaseEditor project={projectId} paper={paperId} id={randomUUID()} revision={0} initial={emptyResearchCase(randomUUID)}/><ResearchImport project={projectId} paper={paperId}/></main>;}
