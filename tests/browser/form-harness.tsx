import {HandoffHarness} from './handoff-harness';
import {networkFixture} from '../fixtures/network';
import {whiteboardFixture} from '../fixtures/whiteboard';
import {ReactionWhiteboard} from '../../src/components/reaction-whiteboard';
import {ProjectReactions} from '../../src/components/project-reactions';
import {groupFixture} from '../fixtures/project-reactions';
import './network-harness';
import {LiteratureHarness} from './literature-harness';
import {SourceHarness} from './source-harness';
// Isolated component test harness, never imported by the Next.js application.
import {createRoot} from 'react-dom/client';
import {ProjectForm,PaperForm,ArchiveForm} from '../../src/components/forms';
import {DriveRecovery} from '../../src/components/drive-recovery';
import {DriveUpload} from '../../src/components/drive-upload';
import {PDFUpload} from '../../src/components/pdf-upload';
import {ResearchCaseEditor,ResearchImport} from '../../src/components/research-case';
import {syntheticCase} from '../fixtures/research-case';
const project='11111111-1111-4111-8111-111111111111';
createRoot(document.getElementById('root')!).render(new URL(location.href).searchParams.has('handoff')?<main><h1>SYNTHETIC research handoff</h1><HandoffHarness/></main>:new URL(location.href).searchParams.has('whiteboard')?<main><h1>SYNTHETIC reaction whiteboard</h1><ReactionWhiteboard project={project} data={new URL(location.href).searchParams.has('topology')?networkFixture():whiteboardFixture()}/></main>:<main><h1>SYNTHETIC form harness — no authentication or data service</h1><section className="panel"><h2>Project</h2><ProjectForm requestId="22222222-2222-4222-8222-222222222222"/></section><section className="panel settings"><h2>Paper</h2><PaperForm projectId={project} requestId="33333333-3333-4333-8333-333333333333"/></section><section className="panel settings"><ArchiveForm projectId={project} revision={1} archived={false}/></section><PDFUpload projectId={project} paperId="33333333-3333-4333-8333-333333333333" enabled/><ResearchCaseEditor project={project} paper="33333333-3333-4333-8333-333333333333" id="44444444-4444-4444-8444-444444444444" revision={1} initial={syntheticCase()}/><ResearchImport project={project} paper="33333333-3333-4333-8333-333333333333"/><DriveUpload projectId={project} paperId="33333333-3333-4333-8333-333333333333" enabled/>{new URL(location.href).searchParams.has('recovery')&&<DriveRecovery projectId={project} paperId="33333333-3333-4333-8333-333333333333" enabled/>}{new URL(location.href).searchParams.has('sourceflow')&&<SourceHarness/>}{new URL(location.href).searchParams.has('literature')&&<LiteratureHarness/>}{new URL(location.href).searchParams.has('projectreviews')&&<ProjectReactions project={project} data={groupFixture()}/>}</main>);
