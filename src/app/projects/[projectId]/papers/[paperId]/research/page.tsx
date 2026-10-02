import Link from 'next/link';import {randomUUID} from 'node:crypto';
import {caseDAL} from '../../../../../../server/research-cases';
import {emptyResearchCase} from '../../../../../../domain/research-case';
import {ResearchCaseEditor,ResearchImport} from '../../../../../../components/research-case';
import {AccessState,Header} from '../../../../../../components/access';
export const dynamic='force-dynamic';
export default async function Research({params}:{params:Promise<{projectId:string;paperId:string}>}){const {projectId,paperId}=await params;let cases;try{cases=await (await caseDAL()).list(projectId,paperId);}catch(error){return <main><Header/><AccessState error={error}/></main>;}return <main><Header/><Link href={`/projects/${projectId}/papers/${paperId}`}>← 論文</Link><h1>反応・実験・根拠</h1><p>確認済み出典の接続待ちです。現在の内容は下書き・レビュー待ちとして保存します。</p><ul>{cases.map(c=><li key={c.id}><Link href={`/projects/${projectId}/papers/${paperId}/research/${c.id}`}>研究ケース · 改訂 {c.revision}{c.archived_at?' · アーカイブ':''}</Link></li>)}</ul><ResearchCaseEditor project={projectId} paper={paperId} id={randomUUID()} revision={0} initial={emptyResearchCase(randomUUID)}/><ResearchImport project={projectId} paper={paperId}/></main>;}
