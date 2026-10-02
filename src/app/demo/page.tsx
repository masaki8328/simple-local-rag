import Link from 'next/link';
import {classifyGraph} from '../../domain/graph';
import {fixture,lowTemperature} from '../../../tests/fixtures/synthetic';
export default async function Page({searchParams}:{searchParams:Promise<{temperature?:string}>}) {
 const {temperature}=await searchParams;
 const filtered=temperature==='120';
 const data=fixture();
 const graph=classifyGraph({reaction:data.reactions[0],claim:data.claims[0],evidence:data.evidence,bundles:data.condition_bundles,filters:filtered?[lowTemperature]:[]});
 return <main>
  <header><span className="eyebrow">RESEARCH NOTEBOOK / PHASE 01</span><span className="status">架空データのみ · Synthetic data</span></header>
  <section className="intro"><p className="eyebrow">ALKALINE CARBOHYDRATE RESEARCH</p><h1>糖類アルカリ反応<br/><span>Knowledge Graph</span></h1><p>反応、条件、根拠を分けて考えるための研究基盤。</p><p className="notice">基盤レビュー用のデモです。実論文・研究データは含まれません。認証、PDF保管、解析プロバイダー連携は未接続です。</p></section>
  <section className="panel" aria-labelledby="demo-title"><div className="panel-heading"><div><p className="eyebrow">SYNTHETIC CONTRACT DEMO</p><h2 id="demo-title">条件に応じた根拠の表示</h2></div><span className="badge">Claim: net_conversion</span></div>
   <nav aria-label="Synthetic temperature filter"><Link aria-current={!filtered?'page':undefined} href="/demo">全温度</Link><Link aria-current={filtered?'page':undefined} href="/demo?temperature=120">≤ 120°C</Link></nav>
   <div className="reaction" aria-label={`Synthetic reaction, ${graph.line_style}`}><span>架空の反応物 A + B</span><span className={`edge ${graph.line_style}`}>→</span><span>架空の生成物 + 共生成物</span></div>
   <p><strong>{graph.line_style==='solid'?'実線 · Solid':'点線 · Dashed'}</strong> <span className="badge">AI未確認</span></p>
   <p>{filtered?'100°Cの提案のみが一致します。150°Cの強い根拠は条件外です。':'150°Cの強い根拠と100°Cの提案を含みます。'}</p>
   <details><summary>全参加物質と判定根拠</summary><ul>{graph.participants.map(p=><li key={p.compound_version_id}>{p.compound_version_id} · {p.role} · 係数不明</li>)}</ul><p>{graph.reason}</p><p>Supporting IDs: {graph.support_evidence_ids.join(', ')}</p></details>
  </section>
  <section className="scope"><article><h2>01 / 出典を固定</h2><p>論文 → PDF版・ハッシュ → ページ・記述位置。旧版への参照を保持します。</p></article><article><h2>02 / 主張を区別</h2><p>生成物の観測は、素反応機構の証明とは別のClaimとして扱います。</p></article><article><h2>03 / 訂正を保護</h2><p>AI結果は候補として扱い、人間による訂正を自動で上書きしません。</p></article></section>
  <footer>設計契約 v0.1 · Phase 1 / PM review · No research conclusions are represented here.</footer>
 </main>;
}
