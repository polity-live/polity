import { useEffect, useImperativeHandle, useReducer } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import type { StudioDocument } from '../../logic/document';
import { createDocument } from '../../logic/templates';
import { studioDocumentV3Schema } from '../../logic/document-v3';
import { legacyDocumentToV3, v3DocumentToLegacy } from '../../logic/v3-adapter';
import * as shared from '../../logic/collaboration';
const io = vi.hoisted(() => ({
  request: vi.fn(),
  upload: vi.fn(),
  notifyError: vi.fn(),
  canvasExecute: vi.fn().mockResolvedValue(undefined),
  canvasProps: null as any,
  editor: {} as any,
  projects: [] as any[],
  project: null as any,
  exports: [] as any[],
  loading: false,
  exportResult: { type: 'complete' } as any,
  projectChat: vi.fn(),
  procedureReason: undefined as string | null | undefined,
  procedureEditingAllowed: true,
  realClone: false,
  realPreview: false,
  realLinks: false,
  renderContextToolbar: false,
}));
export { io };
vi.mock('@rocicorp/zero/react', () => ({
  useQuery: () => [[], { type: 'complete' }],
  useZero: () => ({
    mutate: () => ({ client: Promise.resolve(), server: Promise.resolve({ type: 'success' }) }),
  }),
}));
vi.mock('@/features/project-chat/ui/ProjectChatPanel', () => ({
  ProjectChatPanel: (props: any) => {
    io.projectChat(props);
    return <button data-project-chat-dock>Shared project chat</button>;
  },
}));
vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: { id: 'author', email: 'author@polity.test' } }),
}));
vi.mock('@/zero/users/useUserState', () => ({
  useUserState: () => ({
    currentUser: {
      id: 'author',
      first_name: 'Ada',
      last_name: 'Lovelace',
      handle: 'ada',
      avatar: null,
    },
  }),
}));
vi.mock('@/zero/communication-studio/useStudioState', () => ({
  useStudioState: () => ({
    projects: io.projects,
    project: io.project,
    exports: io.exports,
    isLoading: io.loading,
    exportResult: io.exportResult,
  }),
}));
vi.mock('@/zero/communication-studio/useStudioClient', async () => {
  const { studioClientFixture } = await import('@/test/studio-client.fixture');
  return { useStudioClient: () => studioClientFixture(io) };
});
vi.mock('@/features/collaboration/ui/CollaborationStatus', () => ({
  CollaborationStatus: () => <span>Shared connection status</span>,
}));
vi.mock('../../hooks/useStudioDocument', () => ({
  useStudioDocument: () => {
    const [, notify] = useReducer(n => n + 1, 0);
    useEffect(() => {
      listeners.add(notify);
      return () => {
        listeners.delete(notify);
      };
    }, []);
    return { ...io.editor };
  },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (key === 'features.studio.tableSizeDescription')
        return `${params?.label}: ${params?.rows} x ${params?.columns}`;
      if (key === 'features.studio.format') return 'Format';
      if (key === 'features.editor.header.allSaved') return 'All changes saved';
      if (key === 'common.actions.share') return 'Share';
      const localizedTestCopy: Record<string, string> = {
        canvasEmpty: 'The canvas is empty.',
        undo: 'Undo',
        paste: 'Paste',
        editText: 'Text',
        pixelUnit: 'px',
      };
      const name = key.replace('features.studio.', '');
      return localizedTestCopy[name] ?? name;
    },
  }),
}));
vi.mock('../KonvaStudioCanvas', async () => {
  const { forwardRef: canvasRef } = await import('react');
  return {
    default: canvasRef((p: any, ref) => {
      io.canvasProps = p;
      const canvasPage = p.document
        ? v3DocumentToLegacy(p.document).pages.find(page => page.id === p.activeFrameId)!
        : ydoc.pages.find(page => page.id === p.activeFrameId)!;
      useImperativeHandle(ref, () => ({ execute: io.canvasExecute }));
      useEffect(
        () => p.onGeometry?.({ left: 100, top: 150, right: 350, bottom: 450, interacting: false }),
        []
      );
      useEffect(() => {
        p.onCanvasStateChange?.({
          activeTool: 'selection',
          toolLocked: false,
          zoom: 1,
          viewBounds: { left: 100, top: 200, right: 900, bottom: 1000 },
        });
      }, []);
      if (!p.editable && p.fit === 'contain')
        return <div data-testid="preview-canvas" data-page-id={p.activeFrameId} />;
      return (
        <div data-testid="canvas" data-canvas-engine="konva" data-page-id={p.activeFrameId}>
          {p.inspector && (
            <section aria-label="properties" className="polity-inspector-extension">
              {p.inspector}
            </section>
          )}
          {io.renderContextToolbar && p.contextToolbar && (
            <section aria-label={p.contextToolbarLabel}>{p.contextToolbar}</section>
          )}
          <button onClick={() => p.cursor(12, 24)}>Move cursor</button>
          <button onClick={() => p.selectExact(canvasPage.elements.map((e: any) => e.id))}>
            Select all
          </button>
          {canvasPage.elements.map((e: any) => (
            <button
              key={e.id}
              onClick={() => p.selectExact([e.id])}
            >{`Select ${e.type} ${e.id}`}</button>
          ))}
        </div>
      );
    }),
  };
});
vi.mock('../StudioPreviewDialog', async () => {
  const { lazy, Suspense } = await import('react');
  const ActualPreview = lazy(() =>
    vi
      .importActual<typeof import('../StudioPreviewDialog')>(
        '@/features/communication-studio/ui/StudioPreviewDialog.tsx'
      )
      .then(module => ({ default: module.StudioPreviewDialog }))
  );
  return {
    StudioPreviewDialog: (props: any) =>
      io.realPreview ? (
        <Suspense fallback={<p role="status">Opening preview</p>}>
          <ActualPreview {...props} />
        </Suspense>
      ) : props.open ? (
        <div role="dialog" aria-label="previewTitle">
          <button onClick={() => props.onOpenChange(false)}>closePreview</button>
        </div>
      ) : null,
  };
});
vi.mock('../StudioCloneDialog', async () => {
  const { lazy, Suspense } = await import('react');
  const ActualClone = lazy(() =>
    vi
      .importActual<typeof import('../StudioCloneDialog')>(
        '@/features/communication-studio/ui/StudioCloneDialog.tsx'
      )
      .then(module => ({ default: module.StudioCloneDialog }))
  );
  return {
    StudioCloneDialog: (props: any) =>
      io.realClone ? (
        <Suspense fallback={<p role="status">Opening clone dialog</p>}>
          <ActualClone {...props} />
        </Suspense>
      ) : (
        <button onClick={() => void props.beforeClone()}>confirmClone</button>
      ),
  };
});
vi.mock('../useStudioProcedure', () => ({
  useStudioProcedure: () => ({
    readOnlyReason: io.procedureReason,
    tools: <section aria-label="Shared procedure tools" />,
    modeButton: null,
    canvasOverlay: null,
    markers: [],
    previewDocument: null,
    previewAssets: [],
    editingAllowed: io.procedureEditingAllowed,
    selectProposal: vi.fn(),
  }),
}));
vi.mock('@/features/file-upload/ui/ImageEditorDialog', () => ({
  ImageEditorDialog: (p: any) =>
    p.open ? (
      <div role="dialog">
        <button onClick={() => p.onOpenChange(true)}>Keep image open</button>
        <button onClick={() => p.onSave(new File(['edit'], 'edited.png', { type: 'image/png' }))}>
          Save image
        </button>
        <button onClick={() => p.onOpenChange(false)}>Close image</button>
      </div>
    ) : null,
}));
vi.mock('@/features/shared/hooks/useFixedToolbarController', () => ({
  useFixedToolbarController: () => ({ className: 'fixed' }),
}));
vi.mock('@/features/shared/ui/navigation/SmartLink', async importOriginal => {
  const { forwardRef: linkRef } = await import('react');
  const actual = await importOriginal<typeof import('@/features/shared/ui/navigation/SmartLink')>();
  return {
    ...actual,
    SmartLink: linkRef<HTMLAnchorElement, any>(({ href, children, ...props }, ref) =>
      io.realLinks ? (
        <actual.SmartLink href={href} ref={ref} {...props}>
          {children}
        </actual.SmartLink>
      ) : (
        <a href={href} ref={ref} {...props}>
          {children}
        </a>
      )
    ),
  };
});
import { StudioWorkspace } from '../StudioWorkspace';
export let ydoc: StudioDocument;
export function setDocument(document: StudioDocument) {
  ydoc = document;
  notifyAll();
}
let cachedCanonical: ReturnType<typeof legacyDocumentToV3> | null | undefined;
const listeners = new Set<() => void>();
export const notifyAll = () => {
  cachedCanonical = undefined;
  listeners.forEach(f => f());
};
export function value() {
  return structuredClone(ydoc);
}
// Native editor tests retain the canonical document, as useStudioDocument does.
// The legacy fixture deliberately permits invalid intermediate states in older tests.
export function useCanonicalDocument() {
  let canonical = legacyDocumentToV3(ydoc);
  Object.defineProperty(io.editor, 'v3Value', { get: () => canonical });
  io.editor.transactV3 = (change: (document: typeof canonical) => void) => {
    const draft = structuredClone(canonical);
    change(draft);
    canonical = studioDocumentV3Schema.parse(draft);
    ydoc = v3DocumentToLegacy(canonical);
    notifyAll();
  };
  io.editor.transact = (change: (document: StudioDocument) => void) => {
    const draft = value();
    change(draft);
    canonical = legacyDocumentToV3(draft, canonical);
    ydoc = v3DocumentToLegacy(canonical);
    notifyAll();
  };
  io.editor.meta = (key: string, value: unknown) =>
    io.editor.transact((document: StudioDocument) => Object.assign(document, { [key]: value }));
}
export function setup(kind: Parameters<typeof createDocument>[0] = 'single') {
  ydoc = createDocument(kind, 'Editable campaign', undefined, 1);
  cachedCanonical = undefined;
  io.editor = {
    get value() {
      return value();
    },
    get v3Value() {
      if (cachedCanonical !== undefined) return cachedCanonical;
      try {
        cachedCanonical = legacyDocumentToV3(ydoc);
      } catch {
        // The legacy mock permits intermediate edits that the real document hook validates.
        cachedCanonical = null;
      }
      return cachedCanonical;
    },
    canEdit: true,
    status: 'saved',
    error: '',
    peers: [
      {
        userId: 'peer',
        user: { id: 'peer', name: 'Peer', firstName: 'Peer', color: '#123456' },
      },
    ],
    assets: [],
    sources: [],
    transact: (fn: (d: StudioDocument) => void) =>
      (() => {
        fn(ydoc);
        notifyAll();
      })(),
    transactV3: (fn: (d: ReturnType<typeof legacyDocumentToV3>) => void) =>
      (() => {
        const document = legacyDocumentToV3(ydoc);
        fn(document);
        ydoc = v3DocumentToLegacy(studioDocumentV3Schema.parse(document));
        notifyAll();
      })(),
    patchElement: (p: string, id: string, change: any) => {
      shared.patchElement(ydoc, p, id, change, 'local');
      notifyAll();
    },
    patchPage: (id: string, p: any) => {
      shared.patchPage(ydoc, id, p);
      notifyAll();
    },
    patchPost: (id: string, p: any) => {
      shared.patchPost(ydoc, id, p);
      notifyAll();
    },
    insertElement: (p: string, e: any) => {
      shared.insertElement(ydoc, p, e);
      notifyAll();
    },
    removeElement: (p: string, id: string) => {
      shared.removeElement(ydoc, p, id);
      notifyAll();
    },
    meta: (k: string, v: any) =>
      (() => {
        Object.assign(ydoc, { [k]: v });
        notifyAll();
      })(),
    commit: async () => 0,
    collaboration: { commit: async () => 0 },
    conflicts: [],
    retry: vi.fn(),
    refreshAssets: vi.fn().mockResolvedValue(undefined),
    undo: vi.fn(),
    redo: vi.fn(),
    cursor: vi.fn(),
  };
}
beforeEach(() => {
  io.procedureReason = undefined;
  io.procedureEditingAllowed = true;
  io.realClone = false;
  io.realPreview = false;
  io.realLinks = false;
  io.renderContextToolbar = false;
  vi.clearAllMocks();
  sessionStorage.clear();
  io.projects = [];
  io.project = null;
  io.exports = [];
  io.exportResult = { type: 'complete' };
  io.loading = false;
  io.canvasProps = null;
  io.request.mockImplementation(async (op: string) => {
    if (op === 'create') return { id: 'saved' };
    if (op === 'export') return { id: 'new-job' };
    if (op === 'exportStatus')
      return { id: 'new-job', format: 'png', status: 'queued', progress: 0, error: null };
    return [];
  });
  setup();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
export async function show(props: any = { projectId: 'project', groupId: 'group', open: vi.fn() }) {
  let ui: ReturnType<typeof render>;
  await act(async () => {
    ui = render(<StudioWorkspace {...props} />);
  });
  return ui!;
}
