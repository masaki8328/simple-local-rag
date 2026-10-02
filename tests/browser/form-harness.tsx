// Isolated component test harness, never imported by the Next.js application.
import {createRoot} from 'react-dom/client';
import {ProjectForm,PaperForm,ArchiveForm} from '../../src/components/forms';
import {PDFUpload} from '../../src/components/pdf-upload';
import {ResearchCaseEditor,ResearchImport} from '../../src/components/research-case';
import {syntheticCase} from '../fixtures/research-case';
const project='11111111-1111-4111-8111-111111111111';
createRoot(document.getElementById('root')!).render(<main><h1>SYNTHETIC form harness — no authentication or data service</h1><section className="panel"><h2>Project</h2><ProjectForm requestId="22222222-2222-4222-8222-222222222222"/></section><section className="panel settings"><h2>Paper</h2><PaperForm projectId={project} requestId="33333333-3333-4333-8333-333333333333"/></section><section className="panel settings"><ArchiveForm projectId={project} revision={1} archived={false}/></section><PDFUpload projectId={project} paperId="33333333-3333-4333-8333-333333333333" enabled/><ResearchCaseEditor project={project} paper="33333333-3333-4333-8333-333333333333" id="44444444-4444-4444-8444-444444444444" revision={1} initial={syntheticCase()}/><ResearchImport project={project} paper="33333333-3333-4333-8333-333333333333"/></main>);
