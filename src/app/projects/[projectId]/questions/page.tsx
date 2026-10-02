import Link from 'next/link';
import {handoffDAL} from '../../../../server/research-handoff';
import {researchDAL} from '../../../../server/dal';
import {ResearchHandoff} from '../../../../components/research-handoff';
import {Header,AccessState} from '../../../../components/access';
export const dynamic='force-dynamic';
export default async function Questions({params}:{params:Promise<{projectId:string}>}){const {projectId}=await params;let data,papers;try{[data,papers]=await Promise.all([(await handoffDAL()).overview(projectId),(await researchDAL()).papers(projectId)]);}catch(e){return <main><Header/><AccessState error={e}/></main>;}return <main><Header/><Link href={`/projects/${projectId}`}>← プロジェクト</Link><h1>Research Questions と調査結果</h1><p><Link href={`/projects/${projectId}/literature`}>文献検索</Link> · <Link href={`/projects/${projectId}/reactions`}>Evidence・出典のレビュー</Link></p><ResearchHandoff project={projectId} papers={papers} {...data}/></main>;}
