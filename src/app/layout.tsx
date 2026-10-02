import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'糖類アルカリ反応 · Research Knowledge Graph',description:'Phase 1 foundation — synthetic contract demonstration only',robots:{index:false,follow:false}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="ja"><body>{children}</body></html>;}
