'use client';
export default function ErrorState({reset}:{reset:()=>void}){return <main><section className="panel"><h1>読み込めませんでした</h1><p>データを変更せずに再試行できます。</p><button onClick={reset}>再試行</button></section></main>;}
