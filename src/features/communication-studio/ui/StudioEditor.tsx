import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  ArrowRight,
  ArrowDown,
  ArrowUp,
  Bold,
  Circle,
  Code2,
  Copy,
  Crop,
  Diamond,
  Download,
  Eraser,
  FileUp,
  FolderOpen,
  Frame,
  Grid3X3,
  Group,
  Hand,
  Highlighter,
  Italic,
  Layers3,
  Link2,
  Library,
  Loader2,
  List,
  ListOrdered,
  LockKeyhole,
  MessageSquare,
  Minus,
  MoveHorizontal,
  MoveVertical,
  MousePointer2,
  Pencil,
  Play,
  Plus,
  Redo2,
  Search,
  Shapes,
  Sparkles,
  Square,
  SquareRoundCorner,
  Table2,
  Strikethrough,
  Trash2,
  Type,
  Underline,
  Undo2,
  UnlockKeyhole,
  Users,
} from 'lucide-react';
import { generateDistinctUserColorMap } from '@/features/editor/logic/editor-helpers';
import type { EditorCollaborator, EditorPresencePeer } from '@/features/editor/types';
import { EditorSaveStatus } from '@/features/editor/ui/EditorSaveStatus';
import { OnlineCollaboratorAvatars } from '@/features/editor/ui/OnlineCollaboratorAvatars';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { InlineCheckbox } from '@/features/shared/ui/form/InlineCheckbox';
import { ShareButton } from '@/features/shared/ui/action-buttons/ShareButton';
import { FixedToolbar } from '@/features/shared/ui/ui-platejs/fixed-toolbar';
import { ToolbarButton, ToolbarGroup } from '@/features/shared/ui/layout';
import { Button } from '@/features/shared/ui/ui/button';
import { Progress } from '@/features/shared/ui/ui/progress';
import { ImageEditorDialog } from '@/features/file-upload/ui/ImageEditorDialog';
import { GroupThemeSettings } from '@/features/groups/ui/GroupThemeSettings';
import { StudioPanel } from './StudioPanel';
import { StudioInviteDialog } from './StudioInviteDialog';
import { StudioCloneDialog } from './StudioCloneDialog';
import { SmartLink } from '@/features/shared/ui/navigation/SmartLink';
import { StudioVisibilityDialog } from './StudioVisibilityDialog';
import { openStudioPanel } from '../logic/panel-events';
import { StudioLayersPanel } from './StudioLayersPanel';
import { StudioPreviewDialog } from './StudioPreviewDialog';
import { StudioMenuItem, StudioToolbarMenu } from './StudioToolbarMenu';
import { TableSizePicker } from '@/features/shared/ui/ui-platejs/TableSizePicker';
import {
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from '@/features/shared/ui/ui/dropdown-menu';
import { Popover, PopoverAnchor, PopoverContent } from '@/features/shared/ui/ui/popover';
import { StudioDataProperties } from './StudioDataProperties';
import { StudioCanonicalProperties } from './StudioCanonicalProperties';
import type { StudioTextSelectionEditor } from './StudioTextEditor';
import type { useStudioController } from '../hooks/useStudioController';
import { fontFamilies, formats } from '../logic/document';
import {
  createFrameNode,
  drawingNodeSchema,
  richTextNodeSchema,
  shapeNodeSchema,
  type FrameNode,
  type StudioPlateElement,
  type StudioNode,
} from '../logic/document-v3';
import { getStudioRootFramesInLayerOrder } from '../logic/frame-order';
import { applyStudioCommandV3 } from '../logic/commands-v3';
import {
  arrangementReferenceBounds,
  arrangementUnits,
  isDescendantOf,
  moveByWorldDelta,
  selectionUnits,
  worldBounds,
  worldToLocalPoint,
  type ArrangementReference,
} from '../logic/selection-geometry';
import { emptyStudioSelection, type StudioSelectionState } from '../logic/studio-selection';
import { v3DocumentToLegacy } from '../logic/v3-adapter';
import { paletteColor, themeFontFamily } from '../logic/theme';
import { formatStudioRichText } from '../logic/patch-studio-node';
import {
  createStudioV3ClipboardPayload,
  getProjectStudioClipboard,
  parseStudioClipboard,
  pasteStudioV3Clipboard,
  setProjectStudioClipboard,
  stringifyStudioClipboard,
  type StudioClipboardV2Payload,
} from '../logic/studio-clipboard';
import { useStudioViewportStore, type StudioTool } from '../state/studio-viewport-store';
import type {
  StudioCanvasHandle,
  StudioCanvasNodeChange,
  StudioCanvasState,
  StudioCanvasChangeRequestMarker,
} from './KonvaStudioCanvas';
import type { StudioDocumentV3 } from '../logic/document-v3';
const KonvaStudioCanvas = lazy(() => import('./KonvaStudioCanvas'));
const input = 'w-full rounded-md border bg-background px-2 py-1.5 text-sm';
const button = 'rounded-md border px-3 py-2 text-sm hover:bg-muted disabled:opacity-40';

interface StudioPresencePeer {
  userId?: string;
  user?: {
    id?: string;
    name?: string;
    firstName?: string | null;
    lastName?: string | null;
    avatar?: string | null;
    color?: string;
  };
  cursor?: { pageId?: string };
}

function buildStudioPresence(
  identity: {
    id: string;
    name: string;
    firstName?: string | null;
    lastName?: string | null;
    avatarUrl?: string;
  },
  peers: Record<string, unknown>[]
) {
  const normalizedPeers = peers as StudioPresencePeer[];
  const peerByUserId = new Map<string, StudioPresencePeer>();

  for (const peer of normalizedPeers) {
    const userId = peer.userId ?? peer.user?.id;
    if (userId && userId !== identity.id) peerByUserId.set(userId, peer);
  }

  const userIds = [identity.id, ...peerByUserId.keys()].filter(Boolean);
  const presenceColorByUserId = generateDistinctUserColorMap(userIds);
  const collaborators: EditorCollaborator[] = [];

  if (identity.id) {
    collaborators.push({
      id: `studio-presence-${identity.id}`,
      user: {
        id: identity.id,
        name: identity.name,
        firstName: identity.firstName,
        lastName: identity.lastName,
        avatarUrl: identity.avatarUrl,
      },
      canEdit: true,
      status: 'collaborator',
    });
  }

  const onlinePeerMap = new Map<string, EditorPresencePeer>();
  const activeCursorUserIds = new Set<string>();

  for (const [userId, peer] of peerByUserId) {
    const name = peer.user?.name || 'Polity';
    const color = presenceColorByUserId.get(userId) ?? peer.user?.color ?? '#B88A3B';
    collaborators.push({
      id: `studio-presence-${userId}`,
      user: {
        id: userId,
        name,
        firstName: peer.user?.firstName,
        lastName: peer.user?.lastName,
        avatarUrl: peer.user?.avatar ?? undefined,
      },
      canEdit: true,
      status: 'collaborator',
    });
    onlinePeerMap.set(userId, {
      peerId: userId,
      userId,
      name,
      avatar: peer.user?.avatar ?? undefined,
      color,
    });
    if (peer.cursor) activeCursorUserIds.add(userId);
  }

  return { collaborators, onlinePeerMap, activeCursorUserIds, presenceColorByUserId };
}
export function StudioEditor({
  c,
  projectId,
  groupId,
  onCanvasReady,
  governance,
  modeButton,
  canvasOverlay,
  changeRequestMarkers,
  previewDocument,
  previewAssets,
  editingAllowed,
  readOnlyReason,
  onChangeRequestSelect,
}: {
  c: ReturnType<typeof useStudioController>;
  projectId: string;
  groupId: string | null;
  conversationId?: string;
  onCanvasReady?: (handle: StudioCanvasHandle | null) => void;
  open: (id: string) => void;
  governance?: ReactNode;
  modeButton?: ReactNode;
  canvasOverlay?: ReactNode;
  changeRequestMarkers?: StudioCanvasChangeRequestMarker[];
  previewDocument?: StudioDocumentV3 | null;
  previewAssets?: ReturnType<typeof useStudioController>['assets'];
  editingAllowed?: boolean;
  readOnlyReason?: string | null;
  onChangeRequestSelect?: (id: string) => void;
}) {
  const { t } = useTranslation(),
    tr = (k: string) => t('features.studio.' + k);
  const { page, active, value } = c;
  const [emptyClipboardError, setEmptyClipboardError] = useState('');
  const [emptyPastePending, setEmptyPastePending] = useState(false);
  const emptyPasteBusy = useRef(false);
  const emptyEditingDisabled =
    !c.canEdit || c.busy || editingAllowed === false || Boolean(previewDocument);
  const pasteIntoEmptyDocument = async () => {
    if (emptyEditingDisabled || emptyPasteBusy.current) return;
    emptyPasteBusy.current = true;
    setEmptyPastePending(true);
    try {
      let payload = getProjectStudioClipboard(projectId);
      if (!payload) {
        try {
          const text = (await navigator.clipboard?.readText?.()) ?? '';
          payload = text ? parseStudioClipboard(text) : null;
        } catch {
          // The project-bound in-memory clipboard is the permission-independent fallback.
        }
      }
      if (!payload) throw new Error('The Studio clipboard is empty.');
      if (payload.projectId !== projectId)
        throw new Error('Elements can only be pasted within the same Studio project.');
      if (payload.version !== 2)
        throw new Error('This legacy clipboard selection needs an active canvas for pasting.');
      let selectedNodeIds: string[] = [];
      c.transactV3(document => {
        const pasted = pasteStudioV3Clipboard({ document, payload, projectId });
        Object.assign(document, pasted.document);
        selectedNodeIds = pasted.selectedNodeIds;
      });
      c.selectExact(selectedNodeIds);
      if (selectedNodeIds[0]) c.setPageId(selectedNodeIds[0]);
      setEmptyClipboardError('');
    } catch (error) {
      setEmptyClipboardError(error instanceof Error ? error.message : String(error));
    } finally {
      emptyPasteBusy.current = false;
      setEmptyPastePending(false);
    }
  };
  useEffect(() => {
    if (page || !value) return;
    const paste = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        target instanceof HTMLElement &&
        target.closest(
          'input,textarea,select,[contenteditable="true"],[role="dialog"],.polity-canvas-properties'
        )
      )
        return;
      const mod = event.ctrlKey || event.metaKey;
      if (mod && event.key.toLowerCase() === 'z') {
        if (emptyEditingDisabled || emptyPasteBusy.current) return;
        event.preventDefault();
        if (event.shiftKey) c.redo();
        else c.undo();
        return;
      }
      if (!mod || event.key.toLowerCase() !== 'v') return;
      if (emptyEditingDisabled || emptyPasteBusy.current) return;
      event.preventDefault();
      event.stopPropagation();
      void pasteIntoEmptyDocument();
    };
    window.addEventListener('keydown', paste, true);
    return () => window.removeEventListener('keydown', paste, true);
  }, [page, value, projectId, c, emptyEditingDisabled]);
  if (!value) return null;
  if (!page)
    return (
      <main className="grid min-h-64 place-items-center p-6" data-testid="studio-editor">
        <div className="space-y-3 text-center">
          <p role="status">The canvas is empty.</p>
          {emptyClipboardError && <p role="alert">{emptyClipboardError}</p>}
          <div className="flex justify-center gap-2">
            <Button
              data-action-id="communication-studio.empty-canvas.history.undo"
              data-action-kind="interaction"
              type="button"
              disabled={!c.canUndo || emptyEditingDisabled || emptyPastePending}
              onClick={() => c.undo()}
            >
              Undo
            </Button>
            <Button
              data-action-id="communication-studio.empty-canvas.clipboard.paste"
              type="button"
              disabled={emptyEditingDisabled}
              aria-disabled={emptyEditingDisabled || emptyPastePending}
              aria-busy={emptyPastePending}
              onClick={pasteIntoEmptyDocument}
            >
              Paste
            </Button>
          </div>
        </div>
      </main>
    );
  return (
    <StudioEditorReady
      c={c}
      page={page}
      active={active}
      value={value}
      projectId={projectId}
      groupId={groupId}
      onCanvasReady={onCanvasReady}
      governance={governance}
      modeButton={modeButton}
      canvasOverlay={canvasOverlay}
      changeRequestMarkers={changeRequestMarkers}
      previewDocument={previewDocument}
      previewAssets={previewAssets}
      editingAllowed={editingAllowed}
      readOnlyReason={readOnlyReason}
      onChangeRequestSelect={onChangeRequestSelect}
      tr={tr}
    />
  );
}
function StudioEditorReady({
  c,
  page,
  active,
  value,
  projectId,
  groupId,
  onCanvasReady,
  governance,
  modeButton,
  canvasOverlay,
  changeRequestMarkers,
  previewDocument,
  previewAssets,
  editingAllowed,
  readOnlyReason,
  onChangeRequestSelect,
  tr,
}: {
  c: ReturnType<typeof useStudioController>;
  page: NonNullable<ReturnType<typeof useStudioController>['page']>;
  active: ReturnType<typeof useStudioController>['active'];
  value: NonNullable<ReturnType<typeof useStudioController>['value']>;
  projectId: string;
  groupId: string | null;
  onCanvasReady?: (handle: StudioCanvasHandle | null) => void;
  governance?: ReactNode;
  modeButton?: ReactNode;
  canvasOverlay?: ReactNode;
  changeRequestMarkers?: StudioCanvasChangeRequestMarker[];
  previewDocument?: StudioDocumentV3 | null;
  previewAssets?: ReturnType<typeof useStudioController>['assets'];
  editingAllowed?: boolean;
  readOnlyReason?: string | null;
  onChangeRequestSelect?: (id: string) => void;
  tr: (key: string) => string;
}) {
  const { t } = useTranslation();
  const [cloneOpen, setCloneOpen] = useState(false);
  const [visibilityOpen, setVisibilityOpen] = useState(false);
  const disabled = !c.canEdit || c.busy || !!previewDocument || editingAllowed === false;
  const studioPresence = useMemo(
    () => buildStudioPresence(c.identity, c.peers),
    [c.identity, c.peers]
  );
  const sharedSaveStatus =
    c.status === 'saving' || c.status === 'loading'
      ? 'saving'
      : ['error', 'offline', 'unavailable', 'conflict'].includes(c.status)
        ? 'error'
        : 'saved';
  const activeNode = c.v3Value?.nodes.find(node => node.id === c.selected[0]);
  const masterFrame = c.v3Value?.nodes.find(
    (node): node is FrameNode =>
      node.type === 'frame' && node.id === c.v3Value?.masterLayout.frameId
  );
  const rootFrames = useMemo(
    () => (c.v3Value ? getStudioRootFramesInLayerOrder(c.v3Value) : []),
    [c.v3Value]
  );
  const visiblePreviewFrames = rootFrames.filter(frame => frame.visible);
  const activeTool = useStudioViewportStore(state => state.activeTool);
  const setTool = useStudioViewportStore(state => state.setTool);
  const [reference, setReference] = useState<ArrangementReference>('selection');
  const textEditor = useRef<StudioTextSelectionEditor | null>(null);
  const uploadInput = useRef<HTMLInputElement | null>(null);
  const previewButton = useRef<HTMLElement | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [elementQuery, setElementQuery] = useState('');
  const [exportQuery, setExportQuery] = useState('');
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const canvasRef = useRef<StudioCanvasHandle | null>(null);
  const attachCanvas = useCallback(
    (handle: StudioCanvasHandle | null) => {
      canvasRef.current = handle;
      onCanvasReady?.(handle);
    },
    [onCanvasReady]
  );
  const elementsDropTarget = useRef<HTMLElement | null>(null);
  const [canvasState, setCanvasState] = useState<StudioCanvasState>({
    activeTool: 'selection',
    toolLocked: false,
    zoom: 1,
    viewBounds: null,
  });
  const handleCanvasStateChange = useCallback(
    (state: StudioCanvasState) => {
      setCanvasState(state);
      if (useStudioViewportStore.getState().activeTool !== state.activeTool)
        setTool(state.activeTool);
    },
    [setTool]
  );
  const [selectionState, setSelectionState] = useState<StudioSelectionState>(emptyStudioSelection);
  const selectionProjectId = useRef(projectId);
  const [masterMode] = useState(false);
  const [tableInsertCount, setTableInsertCount] = useState(0);
  const masterPage = useMemo(() => {
    if (!c.v3Value || !masterFrame) return null;
    const projected = v3DocumentToLegacy({
      ...c.v3Value,
      masterLayout: { frameId: null, placements: {} },
    });
    return projected.pages.find(candidate => candidate.id === masterFrame.id) ?? null;
  }, [c.v3Value, masterFrame]);
  const canvasPage = masterMode && masterPage ? masterPage : page;
  const selectedNodeIds = selectionState.nodeIds.filter(id =>
    c.v3Value?.nodes.some(node => node.id === id)
  );
  const selectedUnits =
    c.v3Value && selectedNodeIds.length
      ? selectionUnits(c.v3Value, selectedNodeIds, selectionState.groupDepth)
      : [];
  const arrangedUnits =
    c.v3Value && selectedNodeIds.length
      ? arrangementUnits(c.v3Value, selectedNodeIds, selectionState.groupDepth)
      : [];
  const frameReferenceAvailable =
    !!c.v3Value && !!arrangementReferenceBounds(c.v3Value, arrangedUnits, 'frame');
  const viewReferenceAvailable =
    !!c.v3Value &&
    !!arrangementReferenceBounds(c.v3Value, arrangedUnits, 'view', canvasState.viewBounds);
  const referenceAvailable =
    reference === 'selection' ||
    (reference === 'frame' ? frameReferenceAvailable : viewReferenceAvailable);
  const selectedNodes = c.v3Value?.nodes.filter(node => selectedNodeIds.includes(node.id)) ?? [];
  const selectionLocked = selectedNodes.some(node => node.locked);
  const selectionFullyLocked = selectedNodes.length > 0 && selectedNodes.every(node => node.locked);
  const linkedSelection =
    c.v3Value?.componentInstances.some(instance =>
      Object.values(instance.sourceToInstance).some(id => c.selected.includes(id))
    ) ?? false;
  const canSaveElements = (ids: string[]) =>
    !disabled &&
    !c.workspaceId &&
    ids.length > 0 &&
    ids.every(id => {
      const node = c.v3Value?.nodes.find(candidate => candidate.id === id);
      return (
        node && (node.type !== 'frame' || (!!node.parentFrameId && node.id !== masterFrame?.id))
      );
    });
  const visibleElementSets = c.elementSets.filter(set =>
    set.name.toLocaleLowerCase().includes(elementQuery.trim().toLocaleLowerCase())
  );
  const clearElementsDropTarget = () => {
    elementsDropTarget.current?.removeAttribute('data-studio-drop-active');
    elementsDropTarget.current = null;
  };
  const overElementsTarget = (ids: string[], x: number, y: number) => {
    clearElementsDropTarget();
    if (!canSaveElements(ids)) return false;
    const anchor = [
      ...document.querySelectorAll<HTMLElement>(
        '[data-navigation-item-id="studio-elements"], [data-studio-elements-drop-zone]'
      ),
    ].find(item => {
      const bounds = item.getBoundingClientRect();
      return (
        bounds.width > 0 &&
        bounds.height > 0 &&
        x >= bounds.left &&
        x <= bounds.right &&
        y >= bounds.top &&
        y <= bounds.bottom
      );
    });
    if (!anchor) return false;
    anchor.setAttribute('data-studio-drop-active', 'true');
    elementsDropTarget.current = anchor;
    return true;
  };
  useEffect(() => () => clearElementsDropTarget(), []);
  const dropCanvasSelectionOnElements = (ids: string[], x: number, y: number) => {
    const overTarget = overElementsTarget(ids, x, y);
    clearElementsDropTarget();
    if (!overTarget) return false;
    c.selectExact(ids);
    void c.saveSelectionToElements(ids).then(saved => {
      if (saved)
        openStudioPanel({
          panelKey: 'elements',
          origin: 'secondary-navigation',
          navigationItemId: 'studio-elements',
        });
    });
    return true;
  };
  const canGroup =
    selectedUnits.length >= 2 &&
    new Set(selectedUnits.map(unit => unit.parentFrameId)).size === 1 &&
    !selectionLocked;
  const canUngroup = selectedNodes.some(node => !!node.groupIds[selectionState.groupDepth]);
  useEffect(() => {
    if (!referenceAvailable) setReference('selection');
  }, [referenceAvailable]);
  useEffect(() => {
    setSelectionState(current =>
      JSON.stringify(current.nodeIds) === JSON.stringify(c.selected)
        ? current
        : { ...current, nodeIds: c.selected, primaryId: c.selected[0] ?? null, groupDepth: 0 }
    );
  }, [c.selected]);
  useEffect(() => {
    if (selectionProjectId.current === projectId) return;
    selectionProjectId.current = projectId;
    setSelectionState(emptyStudioSelection());
    c.selectExact([]);
  }, [projectId]);
  useEffect(() => {
    const updatePreview = (event: Event) => {
      const detail = (event as CustomEvent<{ open?: boolean }>).detail;
      setPreviewOpen(detail?.open !== false);
    };
    window.addEventListener('studio-preview', updatePreview);
    return () => window.removeEventListener('studio-preview', updatePreview);
  }, []);
  const canvasCommand = (
    action: 'tool' | 'zoomIn' | 'zoomOut' | 'zoom100' | 'fitSelection' | 'fitAll',
    tool?: StudioTool
  ) => {
    if (action === 'tool' && tool) {
      setTool(tool);
      void canvasRef.current?.execute({
        type: 'setTool',
        tool,
        locked: canvasState.toolLocked,
      });
      return;
    }
    const modes = {
      zoomIn: 'in',
      zoomOut: 'out',
      zoom100: 'reset',
      fitSelection: 'selection',
      fitAll: 'all',
    } as const;
    if (action !== 'tool') void canvasRef.current?.execute({ type: 'zoom', mode: modes[action] });
  };
  const arrangeSelection = (
    action:
      | 'front'
      | 'back'
      | 'forward'
      | 'backward'
      | 'group'
      | 'ungroup'
      | 'lock'
      | 'unlock'
      | 'duplicate'
      | 'hide'
      | 'delete'
  ) => {
    if (!selectedNodeIds.length || !c.v3Value) return;
    const depth = selectionState.groupDepth;
    c.transactV3(document => {
      const base = { nodeIds: selectedNodeIds };
      const effective = { nodeIds: selectedUnits.flatMap(unit => unit.ids) };
      const v3Command =
        action === 'group'
          ? { type: 'groupNodes' as const, ...effective, groupId: crypto.randomUUID(), depth }
          : action === 'ungroup'
            ? { type: 'ungroupNodes' as const, ...effective, depth }
            : action === 'delete'
              ? { type: 'deleteNodes' as const, ...base }
              : action === 'hide'
                ? { type: 'setNodeState' as const, ...base, visible: false }
                : action === 'lock' || action === 'unlock'
                  ? { type: 'setNodeState' as const, ...base, locked: action === 'lock' }
                  : action === 'duplicate'
                    ? { type: 'duplicateNodes' as const, ...base }
                    : action === 'front' ||
                        action === 'back' ||
                        action === 'forward' ||
                        action === 'backward'
                      ? { type: 'reorderNodes' as const, ...base, action }
                      : null;
      if (v3Command) Object.assign(document, applyStudioCommandV3(document, v3Command));
    });
    if (action === 'delete' || action === 'hide') c.selectExact([]);
  };
  const toggleSelectionLock = () => {
    const locked = !selectionFullyLocked;
    const nodeIds = selectedNodes.filter(node => node.locked !== locked).map(node => node.id);
    if (!nodeIds.length) return;
    c.transactV3(document =>
      Object.assign(
        document,
        applyStudioCommandV3(document, {
          type: 'setNodeState',
          nodeIds,
          locked,
        })
      )
    );
  };
  const alignSelection = (direction: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
    if (!selectedNodeIds.length || selectionLocked || !referenceAvailable) return;
    c.transactV3(document =>
      Object.assign(
        document,
        applyStudioCommandV3(document, {
          type: 'alignNodes',
          nodeIds: selectedNodeIds,
          direction,
          reference,
          viewBounds: reference === 'view' ? (canvasState.viewBounds ?? undefined) : undefined,
          groupDepth: selectionState.groupDepth,
        })
      )
    );
  };
  const distributeSelection = (axis: 'horizontal' | 'vertical') => {
    if (
      arrangedUnits.length < (reference === 'selection' ? 3 : 2) ||
      selectionLocked ||
      !referenceAvailable
    )
      return;
    c.transactV3(document =>
      Object.assign(
        document,
        applyStudioCommandV3(document, {
          type: 'distributeNodes',
          nodeIds: selectedNodeIds,
          axis,
          reference,
          viewBounds: reference === 'view' ? (canvasState.viewBounds ?? undefined) : undefined,
          groupDepth: selectionState.groupDepth,
        })
      )
    );
  };
  const referenceOptions = () => (
    <>
      <DropdownMenuLabel>{tr('reference')}</DropdownMenuLabel>
      <DropdownMenuRadioGroup
        value={reference}
        onValueChange={value => setReference(value as ArrangementReference)}
      >
        {(['selection', 'frame', 'view'] as const).map(value => (
          <DropdownMenuRadioItem
            data-action-id="communication-studio.arrangement.reference.select"
            data-action-kind="selection"
            key={value}
            value={value}
            disabled={
              (value === 'frame' && !frameReferenceAvailable) ||
              (value === 'view' && !viewReferenceAvailable)
            }
          >
            {tr(value)}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
      <DropdownMenuSeparator />
    </>
  );
  const applyCanvasChanges = (changes: StudioCanvasNodeChange[]) => {
    if (!changes.length) return;
    c.transactV3(document => {
      const movedFrames = changes.flatMap(change => {
        const node = document.nodes.find(candidate => candidate.id === change.nodeId);
        return node?.type === 'frame' && change.transform ? [node.id] : [];
      });
      for (const change of changes) {
        let node = document.nodes.find(candidate => candidate.id === change.nodeId);
        if (!node || node.locked) continue;
        const originalNode = node;
        if (
          change.transform &&
          !movedFrames.some(
            frameId =>
              frameId !== originalNode.id && isDescendantOf(document, originalNode, frameId)
          )
        ) {
          moveByWorldDelta(document, node, {
            x: change.transform.dx,
            y: change.transform.dy,
          });
          const transform = {
            ...node.transform,
            width: Math.max(1, change.transform.width),
            height: Math.max(1, change.transform.height),
            rotation: change.transform.rotation,
            flipX: change.transform.flipX,
            flipY: change.transform.flipY,
          };
          if (node.type === 'media' && change.transform.crop !== undefined)
            node.crop = change.transform.crop;
          if (
            node.type === 'frame' &&
            (node.transform.width !== transform.width || node.transform.height !== transform.height)
          ) {
            Object.assign(
              document,
              applyStudioCommandV3(document, {
                type: 'resizeFrame',
                frameId: node.id,
                transform,
                scaleContent: false,
              })
            );
            node = document.nodes.find(candidate => candidate.id === change.nodeId);
          } else node.transform = transform;
        }
        if (node?.type === 'frame' && change.style) {
          node.style = { ...node.style, ...change.style };
          const overrides = new Set(node.overrides);
          for (const field of ['fill', 'stroke'] as const) {
            if (!Object.prototype.hasOwnProperty.call(change.style, field)) continue;
            node.style[`${field}Binding` as 'fillBinding' | 'strokeBinding'] = null;
            const override = `style.${field}`;
            if (change.style[field] === null) overrides.delete(override);
            else overrides.add(override);
          }
          node.overrides = [...overrides];
        }
      }
    });
  };
  const pasteV3Clipboard = (payload: StudioClipboardV2Payload, targetFrameId: string | null) => {
    let selectedNodeIds: string[] = [];
    c.transactV3(document => {
      const pasted = pasteStudioV3Clipboard({
        document,
        payload,
        projectId,
        targetFrameId,
      });
      Object.assign(document, pasted.document);
      selectedNodeIds = pasted.selectedNodeIds;
    });
    return selectedNodeIds;
  };
  const cutV3Clipboard = (nodeIds: string[]) => {
    if (!nodeIds.length) return;
    c.transactV3(document =>
      Object.assign(
        document,
        applyStudioCommandV3(document, {
          type: 'deleteNodes',
          nodeIds,
        })
      )
    );
  };
  const createCanvasNode = (
    tool: StudioTool,
    start: { x: number; y: number },
    end: { x: number; y: number },
    rounded: boolean,
    points: [number, number][] = []
  ): string | null => {
    const currentDocument = c.v3Value;
    if (!currentDocument || !c.canEdit) return null;
    const frame = [...rootFrames].reverse().find(candidate => {
      const bounds = worldBounds(currentDocument, candidate);
      return (
        start.x >= bounds.left &&
        start.x <= bounds.right &&
        start.y >= bounds.top &&
        start.y <= bounds.bottom
      );
    });
    const parentFrameId = tool === 'frame' ? null : (frame?.id ?? null);
    const localStart = worldToLocalPoint(currentDocument, parentFrameId, start);
    const localEnd = worldToLocalPoint(currentDocument, parentFrameId, end);
    const x = Math.min(localStart.x, localEnd.x);
    const y = Math.min(localStart.y, localEnd.y);
    const width = Math.max(tool === 'text' ? 700 : 4, Math.abs(localEnd.x - localStart.x));
    const height = Math.max(tool === 'text' ? 180 : 4, Math.abs(localEnd.y - localStart.y));
    const id = crypto.randomUUID();
    const zIndex =
      Math.max(
        -1,
        ...currentDocument.nodes
          .filter(node => node.parentFrameId === parentFrameId)
          .map(node => node.zIndex)
      ) + 1;
    const foreground = c.value?.brand.foreground ?? '#12362D';
    const common = {
      id,
      name: tool === 'text' ? 'Text' : tool,
      parentFrameId,
      transform: { x, y, width, height, rotation: 0 },
      zIndex,
      style: {
        fill:
          tool === 'text'
            ? foreground
            : ['line', 'arrow', 'draw', 'laser'].includes(tool)
              ? null
              : '#B88A3B',
        stroke: foreground,
        strokeWidth: ['line', 'arrow', 'draw', 'laser'].includes(tool) ? 3 : 1,
        cornerRadius: rounded ? 24 : 0,
        opacity: 1,
      },
    };
    let node: StudioNode;
    if (tool === 'frame') {
      node = createFrameNode('custom', {
        id,
        name: 'Frame',
        zIndex,
        transform: {
          x,
          y,
          width: Math.max(200, width),
          height: Math.max(200, height),
          rotation: 0,
        },
      });
    } else if (tool === 'text') {
      node = richTextNodeSchema.parse({
        ...common,
        content: [
          { id: crypto.randomUUID(), type: 'p', children: [{ id: crypto.randomUUID(), text: '' }] },
        ],
        typography: {
          fontFamily: 'Manrope',
          fontSize: 42,
          lineHeight: 1.2,
          letterSpacing: 0,
          horizontalAlign: 'left',
          verticalAlign: 'top',
        },
        type: 'richText',
      });
    } else if (tool === 'draw' || tool === 'laser') {
      const localPoints = points.map(([px, py]) =>
        worldToLocalPoint(currentDocument, parentFrameId, { x: px, y: py })
      );
      node = drawingNodeSchema.parse({
        ...common,
        type: 'drawing',
        tool: tool === 'laser' ? 'laser' : 'pen',
        points: localPoints.map(point => [point.x - x, point.y - y]),
      });
    } else {
      node = shapeNodeSchema.parse({
        ...common,
        type: 'shape',
        shape: tool === 'rectangle' ? (rounded ? 'rounded-rectangle' : 'rectangle') : tool,
        endArrowhead: tool === 'arrow' ? 'arrow' : 'none',
      });
    }
    c.transactV3(document => {
      document.nodes.push(node);
    });
    return id;
  };
  const changeCanvasText = (id: string, content: StudioPlateElement[]) => {
    c.transactV3(document => {
      const node = document.nodes.find(candidate => candidate.id === id);
      if (node?.type !== 'richText') return;
      node.content = content;
      node.name =
        content
          .map(block => block.children.map(child => ('text' in child ? child.text : '')).join(''))
          .join(' ')
          .slice(0, 80) || 'Text';
    });
  };
  const canvasClipboard = async (action: 'copy' | 'cut' | 'paste') => {
    if (!c.v3Value) return;
    if (action === 'copy' || action === 'cut') {
      const payload = createStudioV3ClipboardPayload({
        projectId,
        selectedNodeIds,
        document: c.v3Value,
      });
      if (!payload) return;
      setProjectStudioClipboard(payload);
      try {
        await navigator.clipboard.writeText(stringifyStudioClipboard(payload));
      } catch {
        /* Project clipboard remains available. */
      }
      if (action === 'cut') {
        cutV3Clipboard(selectedNodeIds);
        c.selectExact([]);
      }
      return;
    }
    let clipboard = '';
    try {
      clipboard = await navigator.clipboard.readText();
    } catch {
      /* Use project clipboard. */
    }
    const parsed = parseStudioClipboard(clipboard) ?? getProjectStudioClipboard(projectId);
    if (parsed?.version !== 2) return;
    const ids = pasteV3Clipboard(parsed, page.id);
    c.selectExact(ids);
  };
  const formatText = (key: string, v: unknown) => {
    if (textEditor.current) {
      if (['align', 'list'].includes(key)) textEditor.current.paragraph(key, v);
      else {
        textEditor.current.mark('textStyleId', null);
        textEditor.current.mark(key === 'fill' ? 'color' : key === 'font' ? 'fontFamily' : key, v);
      }
    } else if (active?.type === 'text')
      c.transactV3(document => {
        const node = document.nodes.find(candidate => candidate.id === active.id);
        if (node?.type === 'richText')
          formatStudioRichText(node, key as Parameters<typeof formatStudioRichText>[1], v);
      });
  };
  const applyTextStyle = (styleId: string) => {
    const style = c.theme?.textStyles.find(item => item.id === styleId);
    if (!style || !c.themePalette) return;
    if (textEditor.current && active?.type === 'text') {
      textEditor.current.setMark('textStyleId', style.id);
      textEditor.current.setMark('fontFamily', themeFontFamily(style.font));
      textEditor.current.setMark('fontSize', style.size);
      textEditor.current.setMark('colorBinding', style.color);
      textEditor.current.setMark('color', paletteColor(c.themePalette, style.color));
      textEditor.current.setMark('bold', style.bold);
      textEditor.current.setMark('italic', style.italic);
      textEditor.current.setMark('underline', style.underline);
      textEditor.current.paragraph('align', style.align);
      return;
    }
    c.applyTextStyle(styleId);
  };
  useEffect(() => {
    const key = (ev: KeyboardEvent) => {
      const target = ev.target as HTMLElement;
      if (
        target instanceof HTMLElement &&
        target.closest(
          'input,textarea,select,[contenteditable="true"],[role="dialog"],.polity-canvas-properties'
        )
      )
        return;
      const mod = ev.ctrlKey || ev.metaKey;
      if (ev.key === 'Escape') {
        return;
      }
      if (disabled) return;
      if (mod && ['c', 'v', 'x'].includes(ev.key.toLowerCase())) {
        ev.preventDefault();
        ev.stopPropagation();
        void canvasRef.current?.execute({
          type: 'clipboard',
          action: ({ c: 'copy', v: 'paste', x: 'cut' } as const)[
            ev.key.toLowerCase() as 'c' | 'v' | 'x'
          ],
        });
        return;
      }
      if (mod && ev.key.toLowerCase() === 'd') {
        ev.preventDefault();
        arrangeSelection('duplicate');
      }
      if (mod && ev.key.toLowerCase() === 'z') {
        ev.preventDefault();
        if (ev.shiftKey) c.redo();
        else c.undo();
      }
      if (mod && ['b', 'i', 'u'].includes(ev.key.toLowerCase()) && active?.type === 'text') {
        ev.preventDefault();
        const prop = ({ b: 'bold', i: 'italic', u: 'underline' } as const)[
          ev.key.toLowerCase() as 'b'
        ];
        formatText(prop, !active[prop]);
      }
      if (['Delete', 'Backspace'].includes(ev.key) && c.selected.length) {
        ev.preventDefault();
        arrangeSelection('delete');
      }
      const move: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      };
      if (move[ev.key] && c.selected.length) {
        ev.preventDefault();
        const [x, y] = move[ev.key],
          step = ev.shiftKey ? 10 : 1;
        c.transactV3(document => {
          for (const node of document.nodes.filter(
            candidate => c.selected.includes(candidate.id) && !candidate.locked
          ))
            moveByWorldDelta(document, node, { x: x * step, y: y * step });
        });
      }
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [c, page, active, disabled]);
  const field = (label: string, children: ReactNode) => (
    <label key={label} className="block space-y-1 text-xs">
      <span>{tr(label)}</span>
      {children}
    </label>
  );
  const n = (label: string, key: string, v: number, min: number, max: number, step = 1) =>
    field(
      label,
      <input
        className={input}
        type="number"
        min={min}
        max={max}
        step={step}
        value={v}
        onChange={ev => {
          const number = ev.currentTarget.valueAsNumber;
          if (active && Number.isFinite(number) && number >= min && number <= max)
            c.patch(active.id, { [key]: number });
        }}
      />
    );
  const props = (
    <fieldset disabled={disabled || selectionLocked} className="space-y-3">
      {c.selected.length > 1 && <p>{tr('firstSelectedElement')}</p>}{' '}
      {active && (
        <>
          <hr />
          {active.type === 'text' && (
            <>
              {field(
                'text',
                <textarea
                  data-action-id="communication-studio.studioworkspace.activate.textarea-dcebf42594"
                  className={input}
                  rows={5}
                  value={active.text}
                  maxLength={10000}
                  onChange={e => c.patch(active.id, { text: e.target.value })}
                />
              )}
              {field(
                'font',
                <select
                  data-action-id="communication-studio.studioworkspace.activate.select-4d0cd79d46"
                  className={input}
                  value={active.font}
                  onChange={e => c.patch(active.id, { font: e.target.value as typeof active.font })}
                >
                  {fontFamilies.map(f => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
              )}
              {field(
                'alignment',
                <select
                  data-action-id="communication-studio.studioworkspace.activate.select-515683ba65"
                  className={input}
                  value={active.align}
                  onChange={e =>
                    c.patch(active.id, { align: e.target.value as typeof active.align })
                  }
                >
                  {['left', 'center', 'right'].map(a => (
                    <option key={a} value={a}>
                      {tr(a)}
                    </option>
                  ))}
                </select>
              )}
              <div className="flex gap-2">
                {(['bold', 'italic', 'underline'] as const).map(style => (
                  <button
                    key={style}
                    data-action-id="communication-studio.text.inspector.toggle-mark"
                    type="button"
                    className="polity-style-button"
                    aria-label={tr(style)}
                    aria-pressed={active[style]}
                    onClick={() => formatText(style, !active[style])}
                  >
                    {style === 'bold' ? <b>B</b> : style === 'italic' ? <i>I</i> : <u>U</u>}
                  </button>
                ))}
              </div>
            </>
          )}
          <div className="grid grid-cols-2 gap-2">
            {n('X', 'x', active.x, -4000, 4000)}
            {n('Y', 'y', active.y, -4000, 4000)}
            {n('width', 'width', active.width, 4, 5000)}
            {n('height', 'height', active.height, 4, 5000)}
            {n('rotation', 'rotation', active.rotation, -360, 360)}
            {n('opacity', 'opacity', active.opacity, 0, 1, 0.05)}
            {n('order', 'order', active.order, -100, 1000)}
            {active.type === 'text' && n('fontSize', 'fontSize', active.fontSize, 8, 300)}
            {field(
              'color',
              <div className="col-span-2 flex flex-wrap items-center gap-1">
                {c.themePalette &&
                  Object.entries(c.themePalette)
                    .flatMap(([role, color]) =>
                      role === 'charts'
                        ? (color as string[]).map(
                            (chart, index) => [`chart${index + 1}`, chart] as const
                          )
                        : [[role, color as string] as const]
                    )
                    .map(([role, color]) => (
                      <button
                        key={role}
                        data-action-id="communication-studio.text.color.select-role"
                        type="button"
                        className="h-7 w-7 rounded border"
                        style={{ backgroundColor: color }}
                        aria-label={`${tr('color')} ${role}`}
                        aria-pressed={active.fill.toLowerCase() === color.toLowerCase()}
                        onClick={() => c.patch(active.id, { fill: color })}
                      />
                    ))}
                <input
                  data-action-id="communication-studio.studioworkspace.activate.input-f891eec816"
                  type="color"
                  className="h-7 w-7 rounded border p-0"
                  aria-label={tr('customColor')}
                  value={active.fill}
                  onChange={e => c.patch(active.id, { fill: e.target.value })}
                />
              </div>
            )}
          </div>
          <label className="flex items-center gap-2">
            <InlineCheckbox
              data-action-id="communication-studio.studioworkspace.activate.input-70799f297e"
              checked={active.locked}
              onCheckedChange={value => c.patch(active.id, { locked: value === true })}
            />
            {tr('locked')}
          </label>
          {field(
            'animation',
            <select
              data-action-id="communication-studio.studioworkspace.activate.select-74119eaeb9"
              className={input}
              value={active.animation}
              onChange={e => c.patch(active.id, { animation: e.target.value as 'none' | 'fade' })}
            >
              <option value="none">{tr('none')}</option>
              <option value="fade">{tr('fade')}</option>
            </select>
          )}
          {(active.type === 'image' || active.type === 'video') && (
            <>
              {selectedNodeIds.length === 1 &&
                activeNode?.type === 'media' &&
                !activeNode.locked && (
                  <button
                    type="button"
                    data-action-id="communication-studio.media.crop.open"
                    className={button}
                    disabled={disabled}
                    onClick={() =>
                      void canvasRef.current?.execute({ type: 'crop', action: 'start' })
                    }
                  >
                    {tr('cropMedia')}
                  </button>
                )}
              {field(
                'fit',
                <select
                  data-action-id="communication-studio.studioworkspace.activate.select-1408e711cc"
                  className={input}
                  value={active.fit}
                  onChange={e => c.patch(active.id, { fit: e.target.value as 'cover' | 'contain' })}
                >
                  <option value="contain">{tr('contain')}</option>
                  <option value="cover">{tr('cover')}</option>
                </select>
              )}
              {n('cropX', 'cropX', active.cropX, 0, 1, 0.05)}
              {n('cropY', 'cropY', active.cropY, 0, 1, 0.05)}
            </>
          )}
          {active.type === 'video' && (
            <>
              {n('trim', 'trimStart', active.trimStart, 0, 3600)}
              <label className="flex items-center gap-2">
                <InlineCheckbox
                  data-action-id="communication-studio.studioworkspace.activate.input-f95d891276"
                  checked={active.muted}
                  onCheckedChange={value => c.patch(active.id, { muted: value === true })}
                />
                {tr('muted')}
              </label>
            </>
          )}
          {active.type === 'image' && (
            <>
              <button
                data-action-id="communication-studio.studio-workspace.set-photo-edit"
                className={button}
                onClick={() => c.setPhotoEdit(c.assets.find(a => a.id === active.assetId)?.url)}
              >
                {tr('editImage')}
              </button>
            </>
          )}
        </>
      )}
      {active && (
        <>
          <StudioDataProperties element={active} patch={patch => c.patch(active.id, patch)} />
          {activeNode?.type === 'shape' &&
            (activeNode.shape === 'arrow' || activeNode.shape === 'line') && (
              <div className="grid grid-cols-2 gap-2">
                {(['startArrowhead', 'endArrowhead'] as const).map(key =>
                  field(
                    key,
                    <select
                      data-action-id="communication-studio.shape.arrowhead.select"
                      className={input}
                      value={activeNode[key]}
                      onChange={event =>
                        c.transactV3(document => {
                          const node = document.nodes.find(
                            candidate => candidate.id === activeNode.id
                          );
                          if (node?.type === 'shape')
                            node[key] = event.target.value as (typeof node)[typeof key];
                        })
                      }
                    >
                      {(['none', 'arrow', 'bar', 'dot', 'triangle'] as const).map(value => (
                        <option key={value} value={value}>
                          {tr(value)}
                        </option>
                      ))}
                    </select>
                  )
                )}
              </div>
            )}
          {activeNode && (
            <div className="grid grid-cols-2 gap-2">
              {field(
                'horizontalConstraint',
                <select
                  data-action-id="communication-studio.node.constraint.horizontal"
                  className={input}
                  value={activeNode.constraints.horizontal}
                  onChange={event =>
                    c.transactV3(document => {
                      const node = document.nodes.find(candidate => candidate.id === activeNode.id);
                      if (node)
                        node.constraints.horizontal = event.target.value as
                          'left' | 'right' | 'left-right' | 'center' | 'scale';
                    })
                  }
                >
                  {['left', 'right', 'left-right', 'center', 'scale'].map(value => (
                    <option key={value} value={value}>
                      {tr(value)}
                    </option>
                  ))}
                </select>
              )}
              {field(
                'verticalConstraint',
                <select
                  data-action-id="communication-studio.node.constraint.vertical"
                  className={input}
                  value={activeNode.constraints.vertical}
                  onChange={event =>
                    c.transactV3(document => {
                      const node = document.nodes.find(candidate => candidate.id === activeNode.id);
                      if (node)
                        node.constraints.vertical = event.target.value as
                          'top' | 'bottom' | 'top-bottom' | 'center' | 'scale';
                    })
                  }
                >
                  {['top', 'bottom', 'top-bottom', 'center', 'scale'].map(value => (
                    <option key={value} value={value}>
                      {tr(value)}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
          {n('strokeWidth', 'strokeWidth', active.strokeWidth, 0, 40)}
          {field(
            'border',
            <input
              type="color"
              value={active.stroke}
              onChange={ev => c.patch(active.id, { stroke: ev.target.value })}
            />
          )}
          {active.type === 'text' && (
            <>
              {n('lineHeight', 'lineHeight', active.lineHeight, 0.5, 4, 0.1)}
              {field(
                'verticalAlign',
                <select
                  data-action-id="communication-studio.text.vertical-align.select"
                  className={input}
                  value={active.verticalAlign}
                  onChange={ev => c.patch(active.id, { verticalAlign: ev.target.value as 'top' })}
                >
                  {['top', 'middle', 'bottom'].map(v => (
                    <option key={v} value={v}>
                      {tr(v)}
                    </option>
                  ))}
                </select>
              )}
            </>
          )}
        </>
      )}
      {activeNode && !active && (
        <StudioCanonicalProperties
          node={activeNode}
          tr={tr}
          update={change =>
            c.transactV3(document => {
              const node = document.nodes.find(candidate => candidate.id === activeNode.id);
              if (node) change(node);
            })
          }
        />
      )}
    </fieldset>
  );
  const canvasDocument = previewDocument ?? c.v3Value;
  const selectedGroupId =
    selectedNodes.length > 1 ? selectedNodes[0].groupIds[selectionState.groupDepth] : null;
  const completeGroupSelected =
    !!selectedGroupId &&
    selectedNodes.every(node => node.groupIds[selectionState.groupDepth] === selectedGroupId) &&
    c.v3Value?.nodes.filter(node => node.groupIds[selectionState.groupDepth] === selectedGroupId)
      .length === selectedNodes.length;
  const contextAction = (
    key: string,
    icon: ReactNode,
    onClick: () => void,
    options: { disabled?: boolean; pressed?: boolean; preserveTextFocus?: boolean } = {}
  ) => (
    <button
      key={key}
      type="button"
      data-action-id="communication-studio.context.action.activate"
      data-context-action={key}
      aria-label={tr(key)}
      aria-pressed={options.pressed}
      disabled={options.disabled}
      onMouseDown={options.preserveTextFocus ? event => event.preventDefault() : undefined}
      onClick={onClick}
    >
      {icon}
    </button>
  );
  const contextToolbar =
    disabled || selectionLocked || !selectedNodeIds.length ? null : completeGroupSelected ? (
      <>
        {(
          [
            ['front', ArrowUp],
            ['forward', ArrowUp],
            ['backward', ArrowDown],
            ['back', ArrowDown],
          ] as const
        ).map(([action, Icon]) =>
          contextAction(action, <Icon className="size-4" />, () => arrangeSelection(action))
        )}
        <span className="polity-canvas-context-separator" aria-hidden="true" />
        {(
          [
            ['left', AlignLeft],
            ['center', AlignCenter],
            ['right', AlignRight],
            ['top', ArrowUp],
            ['middle', MoveVertical],
            ['bottom', ArrowDown],
          ] as const
        ).map(([direction, Icon]) =>
          contextAction(direction, <Icon className="size-4" />, () => alignSelection(direction), {
            disabled: !referenceAvailable,
          })
        )}
        <span className="polity-canvas-context-separator" aria-hidden="true" />
        {(['horizontal', 'vertical'] as const).map(axis =>
          contextAction(
            `distribute${axis === 'horizontal' ? 'Horizontal' : 'Vertical'}`,
            axis === 'horizontal' ? (
              <MoveHorizontal className="size-4" />
            ) : (
              <MoveVertical className="size-4" />
            ),
            () => distributeSelection(axis),
            {
              disabled:
                !referenceAvailable || arrangedUnits.length < (reference === 'selection' ? 3 : 2),
            }
          )
        )}
      </>
    ) : selectedNodeIds.length === 1 &&
      activeNode?.type === 'richText' &&
      active?.type === 'text' ? (
      <>
        {(
          [
            ['bold', Bold],
            ['italic', Italic],
            ['underline', Underline],
          ] as const
        ).map(([mark, Icon]) =>
          contextAction(mark, <Icon className="size-4" />, () => formatText(mark, !active[mark]), {
            pressed: active[mark],
            preserveTextFocus: true,
          })
        )}
      </>
    ) : selectedNodeIds.length === 1 &&
      activeNode?.type === 'media' &&
      activeNode.mediaType === 'image' ? (
      <>
        {contextAction(
          'resizeImage',
          <Crop className="size-4" />,
          () => void canvasRef.current?.execute({ type: 'crop', action: 'start' })
        )}
        {contextAction(
          'editImage',
          <Pencil className="size-4" />,
          () => c.setPhotoEdit(c.assets.find(asset => asset.id === activeNode.assetId)?.url),
          { disabled: !c.assets.some(asset => asset.id === activeNode.assetId && asset.url) }
        )}
      </>
    ) : null;
  if (!canvasDocument) return null;
  return (
    <main
      className="flex h-[calc(100dvh-var(--app-shell-mobile-top-offset,0rem)-var(--app-shell-mobile-bottom-offset,0rem))] flex-col overflow-hidden bg-[var(--surface-sunken)] pt-10 [--studio-status-height:2.5rem] [--studio-toolbar-height:2.5rem]"
      data-testid="studio-editor"
    >
      <FixedToolbar
        className="h-10 flex-nowrap !justify-start gap-0 rounded-none border-x-0 border-t-0 px-1 py-1 shadow-none [&>*]:shrink-0"
        aria-label={tr('tools')}
      >
        <ToolbarGroup>
          <ToolbarButton
            asChild
            tooltip={tr('projects')}
            data-action-id="communication-studio.project.list.navigate"
            data-action-kind="navigation"
          >
            <SmartLink
              data-action-id="communication-studio.project.list.navigate"
              href={groupId ? `/group/${groupId}/studio` : '/studio'}
            >
              <ArrowLeft />
            </SmartLink>
          </ToolbarButton>
          <StudioToolbarMenu panelKey="project" label={tr('project')} icon={<FolderOpen />}>
            {(groupId || c.project?.owner_id === c.identity.id) && (
              <StudioMenuItem
                data-action-id="communication-studio.project.template.save"
                data-action-kind="interaction"
                label={tr('saveTemplate')}
                icon={<Library />}
                disabled={disabled}
                onSelect={() =>
                  c.run(async () => {
                    await c.commit();
                    await c.actions.request('template', { id: projectId, value: true });
                  })
                }
              />
            )}
            <StudioMenuItem
              data-action-id="communication-studio.project.clone.open"
              data-action-kind="interaction"
              label={tr('duplicateProject')}
              icon={<Copy />}
              onSelect={() => setCloneOpen(true)}
            />
            {(groupId || c.project?.owner_id === c.identity.id) && (
              <StudioMenuItem
                data-action-id="communication-studio.project.visibility.open"
                data-action-kind="interaction"
                label={t('pages.create.common.visibility')}
                icon={<FolderOpen />}
                onSelect={() => setVisibilityOpen(true)}
              />
            )}
          </StudioToolbarMenu>
        </ToolbarGroup>
        {modeButton && <ToolbarGroup>{modeButton}</ToolbarGroup>}
        <ToolbarGroup>
          <ToolbarButton
            data-action-id="communication-studio.selection.lock.toggle"
            data-action-kind="interaction"
            tooltip={selectionFullyLocked ? tr('unlock') : tr('lock')}
            pressed={selectionFullyLocked}
            disabled={disabled || !selectedNodeIds.length}
            onClick={toggleSelectionLock}
          >
            {selectionFullyLocked ? <LockKeyhole /> : <UnlockKeyhole />}
          </ToolbarButton>
          {(['selection', 'hand'] as const).map(tool => (
            <ToolbarButton
              data-action-kind="interaction"
              key={tool}
              tooltip={tr(tool)}
              pressed={activeTool === tool}
              onClick={() => canvasCommand('tool', tool)}
            >
              {tool === 'selection' ? <MousePointer2 /> : <Hand />}
            </ToolbarButton>
          ))}
          <StudioToolbarMenu
            panelKey="frames"
            label={tr('frame')}
            icon={<Frame />}
            pressed={activeTool === 'frame'}
          >
            <DropdownMenuLabel>{tr('format')}</DropdownMenuLabel>
            {(
              [
                ['square', 'square'],
                ['portrait', 'feed'],
                ['story', 'story'],
                ['widescreen', 'widescreen'],
                ['standard', 'standard'],
              ] as const
            ).map(([label, format]) => (
              <StudioMenuItem
                data-action-kind="interaction"
                key={label}
                label={`${label} · ${formats[format].join(' × ')}`}
                icon={<Frame />}
                disabled={disabled}
                onSelect={() => c.insertFrame(format)}
              />
            ))}
            <DropdownMenuSeparator />
            {(['single', 'carousel', 'story', 'video', 'presentation'] as const).map(kind => (
              <StudioMenuItem
                data-action-kind="interaction"
                key={kind}
                label={
                  kind === 'presentation'
                    ? typeof document !== 'undefined' && document.documentElement.lang === 'en'
                      ? 'Presentation'
                      : 'Präsentation'
                    : tr(kind)
                }
                icon={<Layers3 />}
                disabled={disabled}
                onSelect={() => c.insertFrameSet(kind)}
              />
            ))}
            <DropdownMenuSeparator />
            <StudioMenuItem
              data-action-kind="interaction"
              label={tr('freeFrame')}
              icon={<Frame />}
              onSelect={() => canvasCommand('tool', 'frame')}
            />
          </StudioToolbarMenu>
          <StudioToolbarMenu
            panelKey="shapes"
            label={tr('shapes')}
            icon={<Shapes />}
            pressed={['rectangle', 'ellipse', 'diamond'].includes(activeTool)}
          >
            {(
              [
                ['rectangle', Square],
                ['ellipse', Circle],
                ['diamond', Diamond],
              ] as const
            ).map(([tool, Icon]) => (
              <StudioMenuItem
                data-action-kind="interaction"
                key={tool}
                label={tr(tool)}
                icon={<Icon />}
                iconOnly
                onSelect={() => canvasCommand('tool', tool)}
              />
            ))}
            <StudioMenuItem
              data-action-kind="interaction"
              label={tr('roundedRectangle')}
              icon={<SquareRoundCorner />}
              iconOnly
              onSelect={() => {
                setTool('rectangle');
                void canvasRef.current?.execute({
                  type: 'setTool',
                  tool: 'rectangle',
                  locked: canvasState.toolLocked,
                  rounded: true,
                });
              }}
            />
          </StudioToolbarMenu>
          <StudioToolbarMenu
            panelKey="lines"
            label={tr('line')}
            icon={<ArrowRight />}
            pressed={activeTool === 'line' || activeTool === 'arrow'}
          >
            <StudioMenuItem
              data-action-kind="interaction"
              label={tr('arrow')}
              icon={<ArrowRight />}
              onSelect={() => canvasCommand('tool', 'arrow')}
            />
            <StudioMenuItem
              data-action-kind="interaction"
              label={tr('line')}
              icon={<Minus />}
              onSelect={() => canvasCommand('tool', 'line')}
            />
          </StudioToolbarMenu>
          <StudioToolbarMenu
            panelKey="drawing"
            label={tr('draw')}
            icon={<Pencil />}
            pressed={['draw', 'eraser', 'laser'].includes(activeTool)}
          >
            <StudioMenuItem
              data-action-kind="interaction"
              label={tr('draw')}
              icon={<Pencil />}
              onSelect={() => canvasCommand('tool', 'draw')}
            />
            <StudioMenuItem
              data-action-kind="interaction"
              label={tr('eraser')}
              icon={<Eraser />}
              onSelect={() => canvasCommand('tool', 'eraser')}
            />
            <StudioMenuItem
              data-action-kind="interaction"
              label={tr('laser')}
              icon={<Sparkles />}
              onSelect={() => canvasCommand('tool', 'laser')}
            />
          </StudioToolbarMenu>
          <ToolbarButton
            data-action-kind="interaction"
            tooltip={tr('text')}
            pressed={activeTool === 'text'}
            disabled={disabled}
            onClick={() => canvasCommand('tool', 'text')}
          >
            <Type />
          </ToolbarButton>
          <StudioToolbarMenu
            panelKey="zoom"
            label={`${tr('zoom')} ${Math.round(canvasState.zoom * 100)}%`}
            icon={<span className="font-mono text-xs">{Math.round(canvasState.zoom * 100)}%</span>}
          >
            <StudioMenuItem
              data-action-kind="interaction"
              label="+"
              icon={<Plus />}
              onSelect={() => canvasCommand('zoomIn')}
            />
            <StudioMenuItem
              data-action-kind="interaction"
              label="−"
              icon={<Minus />}
              onSelect={() => canvasCommand('zoomOut')}
            />
            <StudioMenuItem
              data-action-kind="interaction"
              label="100 %"
              icon={<Search />}
              onSelect={() => canvasCommand('zoom100')}
            />
            <DropdownMenuSeparator />
            <StudioMenuItem
              data-action-kind="interaction"
              label={tr('fitSelection')}
              icon={<MousePointer2 />}
              onSelect={() => canvasCommand('fitSelection')}
            />
            <StudioMenuItem
              data-action-kind="interaction"
              label={tr('fitAll')}
              icon={<Frame />}
              onSelect={() => canvasCommand('fitAll')}
            />
          </StudioToolbarMenu>
        </ToolbarGroup>
        {governance && (
          <ToolbarGroup>
            <StudioPanel panelKey="collaboration" label={tr('collaboration')} icon={<Users />}>
              {governance}
            </StudioPanel>
            <ToolbarButton
              data-action-kind="interaction"
              tooltip={tr('comments')}
              data-action-id="communication-studio.collaboration.comments.open"
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent('studio-open-panel', { detail: 'collaboration' })
                )
              }
            >
              <MessageSquare />
            </ToolbarButton>
          </ToolbarGroup>
        )}
        <ToolbarGroup>
          <ToolbarButton
            data-action-kind="interaction"
            tooltip={tr('undo')}
            disabled={disabled}
            onClick={c.undo}
          >
            <Undo2 />
          </ToolbarButton>
          <ToolbarButton
            data-action-kind="interaction"
            tooltip={tr('redo')}
            disabled={disabled}
            onClick={c.redo}
          >
            <Redo2 />
          </ToolbarButton>
        </ToolbarGroup>
        <ToolbarGroup>
          <ToolbarButton
            data-action-kind="interaction"
            tooltip={tr('chart')}
            disabled={disabled}
            onClick={() => c.add('chart')}
          >
            <Grid3X3 />
          </ToolbarButton>
          <StudioToolbarMenu
            resetKey={tableInsertCount}
            panelKey="table"
            label={tr('table')}
            icon={<Table2 />}
            disabled={disabled}
            className="p-1"
          >
            <TableSizePicker
              key={tableInsertCount}
              label={tr('tableSize')}
              onSelect={dimensions => {
                const id = c.addTable(dimensions);
                if (id) {
                  setTableInsertCount(value => value + 1);
                }
              }}
            />
          </StudioToolbarMenu>
          <ToolbarButton
            data-action-kind="interaction"
            tooltip={tr('upload')}
            data-action-id="communication-studio.assets.upload.open"
            disabled={disabled}
            onClick={() => uploadInput.current?.click()}
          >
            <FileUp />
          </ToolbarButton>
          <input
            ref={uploadInput}
            hidden
            type="file"
            accept="image/png,image/jpeg,image/webp,video/mp4"
            disabled={disabled}
            aria-label={tr('upload')}
            onChange={ev => {
              if (ev.target.files?.[0]) void c.upload(ev.target.files[0]);
              ev.target.value = '';
            }}
          />
        </ToolbarGroup>
        <ToolbarGroup>
          <StudioPanel panelKey="pages" label={tr('layers')} icon={<Layers3 />} compact>
            {c.v3Value && (
              <StudioLayersPanel
                document={c.v3Value}
                selectedNodeIds={selectedNodeIds}
                disabled={disabled}
                tr={tr}
                onRename={(nodeId, name) => {
                  if (disabled) return;
                  const normalizedName = name.trim();
                  if (!normalizedName || normalizedName.length > 200) return;
                  c.transactV3(document => {
                    const node = document.nodes.find(candidate => candidate.id === nodeId);
                    if (!node || node.locked || node.name === normalizedName) return;
                    Object.assign(
                      document,
                      applyStudioCommandV3(document, {
                        type: 'updateNode',
                        nodeId,
                        patch: { name: normalizedName },
                      })
                    );
                  });
                }}
                onSelect={(node, rootFrameId) => {
                  if (rootFrameId) c.setPageId(rootFrameId);
                  c.selectExact([node.id]);
                  setSelectionState(current => ({
                    ...current,
                    nodeIds: [node.id],
                    primaryId: node.id,
                    groupDepth: 0,
                  }));
                }}
                onSetVisibility={(node, visible) =>
                  c.transactV3(document =>
                    Object.assign(
                      document,
                      applyStudioCommandV3(document, {
                        type: 'setNodeState',
                        nodeIds: [node.id],
                        visible,
                      })
                    )
                  )
                }
                onSetLocked={(node, locked) =>
                  c.transactV3(document =>
                    Object.assign(
                      document,
                      applyStudioCommandV3(document, {
                        type: 'setNodeState',
                        nodeIds: [node.id],
                        locked,
                      })
                    )
                  )
                }
                onMove={(nodeId, targetId, position) =>
                  c.transactV3(document =>
                    Object.assign(
                      document,
                      applyStudioCommandV3(document, {
                        type: 'moveNode',
                        nodeId,
                        targetId,
                        position,
                      })
                    )
                  )
                }
              />
            )}
          </StudioPanel>
        </ToolbarGroup>
        <ToolbarGroup>
          <ToolbarButton
            data-action-id="communication-studio.selection.copy.duplicate"
            data-action-kind="interaction"
            tooltip={tr('duplicate')}
            disabled={disabled || !c.selected.length}
            onClick={() => arrangeSelection('duplicate')}
          >
            <Copy />
          </ToolbarButton>
          <ToolbarButton
            data-action-id="communication-studio.selection.remove.delete"
            data-action-kind="interaction"
            tooltip={tr('remove')}
            disabled={disabled || !c.selected.length}
            onClick={() => arrangeSelection('delete')}
          >
            <Trash2 />
          </ToolbarButton>
          <StudioToolbarMenu
            panelKey="arrange"
            label={tr('elementAlignment')}
            icon={<AlignCenter />}
          >
            {referenceOptions()}
            <DropdownMenuLabel>{tr('elementAlignment')}</DropdownMenuLabel>
            <div className="grid grid-cols-6">
              {(
                [
                  ['left', AlignLeft],
                  ['center', AlignCenter],
                  ['right', AlignRight],
                  ['top', ArrowUp],
                  ['middle', MoveVertical],
                  ['bottom', ArrowDown],
                ] as const
              ).map(([direction, Icon]) => (
                <StudioMenuItem
                  data-action-id="communication-studio.selection.align.apply"
                  data-action-kind="interaction"
                  key={direction}
                  label={tr(direction)}
                  icon={<Icon />}
                  iconOnly
                  disabled={
                    disabled || !arrangedUnits.length || selectionLocked || !referenceAvailable
                  }
                  onSelect={() => alignSelection(direction)}
                />
              ))}
            </div>
          </StudioToolbarMenu>
          <StudioToolbarMenu label={tr('distribute')} icon={<MoveHorizontal />}>
            {referenceOptions()}
            <DropdownMenuLabel>{tr('distribute')}</DropdownMenuLabel>
            <StudioMenuItem
              data-action-id="communication-studio.selection.distribute.horizontal"
              data-action-kind="interaction"
              label={`${tr('distribute')} ${tr('horizontal')}`}
              icon={<MoveHorizontal />}
              disabled={
                disabled ||
                arrangedUnits.length < (reference === 'selection' ? 3 : 2) ||
                selectionLocked ||
                !referenceAvailable
              }
              onSelect={() => distributeSelection('horizontal')}
            />
            <StudioMenuItem
              data-action-id="communication-studio.selection.distribute.vertical"
              data-action-kind="interaction"
              label={`${tr('distribute')} ${tr('vertical')}`}
              icon={<MoveVertical />}
              disabled={
                disabled ||
                arrangedUnits.length < (reference === 'selection' ? 3 : 2) ||
                selectionLocked ||
                !referenceAvailable
              }
              onSelect={() => distributeSelection('vertical')}
            />
          </StudioToolbarMenu>
          <StudioToolbarMenu label={tr('order')} icon={<Layers3 />}>
            <DropdownMenuLabel>{tr('order')}</DropdownMenuLabel>
            {(
              [
                ['front', ArrowUp],
                ['back', ArrowDown],
                ['forward', ArrowUp],
                ['backward', ArrowDown],
              ] as const
            ).map(([action, Icon]) => (
              <StudioMenuItem
                data-action-id="communication-studio.selection.order.apply"
                data-action-kind="interaction"
                key={action}
                label={tr(action)}
                icon={<Icon />}
                disabled={
                  disabled ||
                  !selectedNodeIds.length ||
                  selectionLocked ||
                  new Set(selectedNodes.map(node => node.parentFrameId)).size !== 1
                }
                onSelect={() => arrangeSelection(action)}
              />
            ))}
          </StudioToolbarMenu>
          <StudioToolbarMenu label={tr('groupElements')} icon={<Group />}>
            <DropdownMenuLabel>{tr('groupElements')}</DropdownMenuLabel>
            {(['group', 'ungroup'] as const).map(action => (
              <StudioMenuItem
                data-action-id="communication-studio.selection.group.toggle"
                data-action-kind="interaction"
                key={action}
                label={action === 'group' ? tr('groupElements') : tr(action)}
                icon={<Layers3 />}
                disabled={disabled || (action === 'group' ? !canGroup : !canUngroup)}
                onSelect={() => arrangeSelection(action)}
              />
            ))}
          </StudioToolbarMenu>
        </ToolbarGroup>
        {active?.type === 'text' && (
          <ToolbarGroup>
            <StudioToolbarMenu
              label={tr('font')}
              tooltip={`${tr('font')}: ${active.font}`}
              icon={<Type />}
              disabled={disabled}
            >
              <DropdownMenuRadioGroup
                value={active.font}
                onValueChange={v => formatText('font', v)}
              >
                {fontFamilies.map(font => (
                  <DropdownMenuRadioItem
                    data-action-id="communication-studio.text.font.select"
                    key={font}
                    value={font}
                  >
                    {font}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </StudioToolbarMenu>
            <input
              data-action-kind="interaction"
              data-action-id="communication-studio.studio-editor.activate.input-f9d64640a1"
              aria-label={tr('fontSize')}
              className="w-16"
              type="number"
              min={8}
              max={300}
              value={active.fontSize}
              disabled={disabled}
              onChange={ev => {
                const n = ev.target.valueAsNumber;
                if (n >= 8 && n <= 300) formatText('fontSize', n);
              }}
            />
            {(
              [
                ['bold', Bold],
                ['italic', Italic],
                ['underline', Underline],
                ['strikethrough', Strikethrough],
              ] as const
            ).map(([mark, Icon]) => (
              <ToolbarButton
                data-action-id="communication-studio.text.toolbar.toggle-mark"
                data-action-kind="interaction"
                key={mark}
                tooltip={tr(mark)}
                pressed={active[mark]}
                disabled={disabled}
                onMouseDown={ev => ev.preventDefault()}
                onClick={() => formatText(mark, !active[mark])}
              >
                <Icon />
              </ToolbarButton>
            ))}
            <ToolbarButton
              data-action-id="communication-studio.text.mark-code.apply"
              data-action-kind="interaction"
              tooltip={tr('code')}
              disabled={disabled}
              onMouseDown={ev => ev.preventDefault()}
              onClick={() => formatText('code', true)}
            >
              <Code2 />
            </ToolbarButton>
            <ToolbarButton
              data-action-id="communication-studio.text.mark-highlight.apply"
              data-action-kind="interaction"
              tooltip={tr('highlight')}
              disabled={disabled}
              onMouseDown={ev => ev.preventDefault()}
              onClick={() => formatText('highlight', true)}
            >
              <Highlighter />
            </ToolbarButton>
            <input
              data-action-kind="interaction"
              data-action-id="communication-studio.studio-editor.activate.input-6b4651ec8d"
              aria-label={tr('color')}
              type="color"
              className="w-8"
              value={active.fill}
              disabled={disabled}
              onChange={ev => formatText('fill', ev.target.value)}
            />
            <StudioToolbarMenu
              label={tr('alignment')}
              icon={
                active.align === 'center' ? (
                  <AlignCenter />
                ) : active.align === 'right' ? (
                  <AlignRight />
                ) : active.align === 'justify' ? (
                  <AlignJustify />
                ) : (
                  <AlignLeft />
                )
              }
              disabled={disabled}
              className="min-w-0"
            >
              <DropdownMenuRadioGroup
                value={active.align}
                onValueChange={v => formatText('align', v)}
              >
                {(
                  [
                    ['left', AlignLeft],
                    ['center', AlignCenter],
                    ['right', AlignRight],
                    ['justify', AlignJustify],
                  ] as const
                ).map(([value, Icon]) => (
                  <DropdownMenuRadioItem
                    data-action-id="communication-studio.text.alignment.select"
                    key={value}
                    value={value}
                    aria-label={tr(value)}
                    title={tr(value)}
                    className="justify-center pl-2 *:first:[span]:hidden"
                  >
                    <Icon />
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </StudioToolbarMenu>
            <Popover open={linkOpen} onOpenChange={setLinkOpen}>
              <PopoverAnchor asChild>
                <div className="inline-flex">
                  <StudioToolbarMenu
                    panelKey="text"
                    label={tr('text')}
                    icon={<Type />}
                    disabled={disabled}
                    onCloseAutoFocus={ev => {
                      if (linkOpen) ev.preventDefault();
                    }}
                  >
                    <StudioMenuItem
                      data-action-id="communication-studio.text.list.bullet"
                      data-action-kind="interaction"
                      label={tr('bulletList')}
                      icon={<List />}
                      onSelect={() => {
                        if (textEditor.current) textEditor.current.paragraph('list', 'bullet');
                        else formatText('list', 'bullet');
                      }}
                    />
                    <StudioMenuItem
                      data-action-id="communication-studio.text.list.numbered"
                      data-action-kind="interaction"
                      label={tr('numberedList')}
                      icon={<ListOrdered />}
                      onSelect={() => {
                        if (textEditor.current) textEditor.current.paragraph('list', 'number');
                        else formatText('list', 'number');
                      }}
                    />
                    <DropdownMenuSeparator />
                    <StudioMenuItem
                      data-action-id="communication-studio.text.link.open"
                      data-action-kind="interaction"
                      label={tr('link')}
                      icon={<Link2 />}
                      onSelect={() => {
                        setLinkUrl('');
                        setLinkOpen(true);
                      }}
                    />
                  </StudioToolbarMenu>
                </div>
              </PopoverAnchor>
              <PopoverContent align="start" className="w-64 p-2">
                <label className="block space-y-1 text-sm">
                  <span>{tr('link')}</span>
                  <input
                    data-action-id="communication-studio.text.link.edit"
                    data-action-kind="interaction"
                    autoFocus
                    aria-label={tr('link')}
                    className={input}
                    type="url"
                    value={linkUrl}
                    onChange={ev => setLinkUrl(ev.target.value)}
                    onKeyDown={ev => {
                      if (ev.key === 'Enter' && /^https?:\/\//.test(linkUrl)) {
                        if (textEditor.current) textEditor.current.mark('url', linkUrl);
                        else formatText('url', linkUrl);
                        setLinkOpen(false);
                      }
                    }}
                  />
                </label>
              </PopoverContent>
            </Popover>
          </ToolbarGroup>
        )}
        <StudioPanel panelKey="theme" label={tr('theme')} toolbarTrigger={false}>
          <section className="space-y-4 p-2">
            <label className="block space-y-1 text-sm">
              <span>{tr('theme')}</span>
              <select
                data-action-id="communication-studio.theme.definition.select"
                className={input}
                value={c.theme?.themeId}
                disabled={disabled}
                onChange={event => {
                  const theme = c.themes.find(item => item.themeId === event.currentTarget.value);
                  if (theme) c.applyTheme({ ...theme, mode: c.theme?.mode ?? 'light' });
                }}
              >
                {c.themes.map(theme => (
                  <option
                    key={`${theme.themeId}:${theme.revisionId ?? 'builtin'}`}
                    value={theme.themeId}
                  >
                    {theme.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['light', 'dark'] as const).map(mode => (
                <button
                  data-action-id="communication-studio.theme.appearance-mode.select"
                  key={mode}
                  type="button"
                  className={button}
                  aria-pressed={c.theme?.mode === mode}
                  disabled={disabled}
                  onClick={() => c.setThemeMode(mode)}
                >
                  {tr(mode)}
                </button>
              ))}
            </div>
            {c.themePalette && (
              <section>
                <h3 className="mb-2 text-sm font-semibold">{tr('palette')}</h3>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(c.themePalette)
                    .flatMap(([role, color]) =>
                      role === 'charts'
                        ? (color as string[]).map(
                            (chart, index) => [`chart${index + 1}`, chart] as const
                          )
                        : [[role, color as string] as const]
                    )
                    .map(([role, color]) => (
                      <div key={role} className="flex items-center gap-2 text-xs">
                        <span
                          className="h-6 w-6 rounded border"
                          style={{ backgroundColor: color }}
                        />
                        <span className="truncate">{role}</span>
                      </div>
                    ))}
                </div>
              </section>
            )}
            {c.theme && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">{tr('fonts')}</h3>
                <p className="text-xs">Display: {c.theme.fonts.display}</p>
                <p className="text-xs">Sans: {c.theme.fonts.sans}</p>
                <p className="text-xs">Mono: {c.theme.fonts.mono}</p>
                <h3 className="pt-2 text-sm font-semibold">{tr('textStyles')}</h3>
                {c.theme.textStyles.map(style => (
                  <button
                    data-action-id="communication-studio.theme.text-style.apply"
                    key={style.id}
                    type="button"
                    className={button + ' flex w-full items-center justify-between text-left'}
                    disabled={disabled || !c.selected.length}
                    onClick={() => applyTextStyle(style.id)}
                  >
                    <span>{style.name}</span>
                    <span className="text-muted-foreground text-xs">{style.size}px</span>
                  </button>
                ))}
              </section>
            )}
            {groupId && (
              <SmartLink
                data-action-id="communication-studio.theme.settings.navigate"
                className="block text-sm underline"
                href={`/group/${groupId}/settings?tab=themes`}
              >
                {tr('editThemes')}
              </SmartLink>
            )}
            <details className="border-t pt-3">
              <summary className="cursor-pointer text-sm font-semibold">
                {tr('manageThemes')}
              </summary>
              <div className="mt-3">
                <GroupThemeSettings groupId={groupId} />
              </div>
            </details>
          </section>
        </StudioPanel>
        <StudioPanel
          panelKey="elements"
          label={tr('elements')}
          toolbarTrigger={false}
          keepOpenOnCanvasInteraction
        >
          <section data-studio-elements-drop-zone className="space-y-2 p-1">
            <input
              data-action-id="communication-studio.elements.library.search"
              data-action-kind="interaction"
              className="bg-background h-8 w-full rounded-md border px-2 text-sm"
              type="search"
              aria-label={tr('searchElements')}
              placeholder={tr('searchElements')}
              value={elementQuery}
              onChange={event => setElementQuery(event.currentTarget.value)}
            />
            <button
              data-action-id="communication-studio.elements.selection.save"
              type="button"
              className="hover:bg-muted w-full rounded-sm border px-2 py-1.5 text-left text-sm disabled:opacity-40"
              disabled={!canSaveElements(c.selected)}
              onClick={() => void c.saveSelectionToElements()}
            >
              {tr('saveSelectionToElements')}
            </button>
            <div className="max-h-[min(32rem,70dvh)] space-y-0.5 overflow-auto">
              {visibleElementSets.map(set => (
                <article
                  key={set.id}
                  draggable={!disabled}
                  className="hover:bg-muted/60 flex min-h-8 items-center gap-2 rounded-sm px-2 text-sm"
                  onDragStart={event => {
                    event.dataTransfer.effectAllowed = 'copy';
                    event.dataTransfer.setData('application/x-polity-element-set', set.id);
                  }}
                >
                  <Library className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{set.name}</span>
                  <span className="text-muted-foreground text-xs">v{set.version}</span>
                  <button
                    data-action-id="communication-studio.elements.set.rename"
                    type="button"
                    className="hover:bg-muted focus-visible:ring-ring inline-flex size-7 shrink-0 items-center justify-center rounded-sm focus-visible:ring-2 focus-visible:outline-none disabled:opacity-40"
                    aria-label={`${tr('rename')}: ${set.name}`}
                    disabled={disabled}
                    onClick={() => {
                      const name = window.prompt(tr('rename'), set.name);
                      if (name?.trim()) void c.renameElementSet(set.id, name);
                    }}
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    data-action-id="communication-studio.elements.set.archive"
                    type="button"
                    className="hover:bg-muted focus-visible:ring-ring inline-flex size-7 shrink-0 items-center justify-center rounded-sm focus-visible:ring-2 focus-visible:outline-none disabled:opacity-40"
                    aria-label={`${tr('delete')}: ${set.name}`}
                    disabled={disabled}
                    onClick={() => void c.archiveElementSet(set.id)}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </article>
              ))}
              {!c.elementSets.length && (
                <p className="text-muted-foreground px-2 py-4 text-center text-sm">
                  {tr('noElements')}
                </p>
              )}
              {!!c.elementSets.length && !visibleElementSets.length && (
                <p className="text-muted-foreground px-2 py-4 text-center text-sm">
                  {tr('noElementsFound')}
                </p>
              )}
            </div>
            {linkedSelection && (
              <button
                data-action-id="communication-studio.elements.instance.publish"
                type="button"
                className="hover:bg-muted w-full rounded-sm border px-2 py-1.5 text-left text-sm disabled:opacity-40"
                disabled={disabled || !!c.workspaceId}
                onClick={() => void c.publishSelectedElementChanges()}
              >
                {tr('publishElementChanges')}
              </button>
            )}
          </section>
        </StudioPanel>
        <ToolbarGroup>
          <ToolbarButton
            data-action-kind="interaction"
            data-action-id="communication-studio.preview.open"
            tooltip={tr(visiblePreviewFrames.length ? 'preview' : 'noVisibleFrames')}
            disabled={!visiblePreviewFrames.length}
            onClick={event => {
              previewButton.current = event.currentTarget as HTMLElement;
              setPreviewOpen(true);
            }}
          >
            <Play />
          </ToolbarButton>
          <ToolbarButton
            data-action-kind="interaction"
            tooltip={tr('guides')}
            pressed={c.guides}
            onClick={() => c.setGuides(!c.guides)}
          >
            <Grid3X3 />
          </ToolbarButton>
          <StudioPanel panelKey="exports" label={tr('exports')} icon={<Download />} compact>
            <section className="space-y-2 p-1">
              <div className="flex items-center gap-2">
                <select
                  data-action-id="communication-studio.studioworkspace.activate.format-2"
                  className={input + ' min-w-0 flex-1'}
                  aria-label={tr('format')}
                  value={c.format}
                  onChange={e => c.setFormat(e.target.value)}
                >
                  {['png', 'pdf', 'pptx', 'canva', 'mp4', 'xlsx', 'zip'].map(f => (
                    <option key={f} value={f}>
                      {f === 'zip' ? 'ALL' : f.toUpperCase()}
                    </option>
                  ))}
                </select>
                <button
                  data-action-id="communication-studio.studio-workspace.export-media"
                  className={button}
                  disabled={
                    disabled ||
                    c.status === 'offline' ||
                    c.exportPreparing ||
                    !c.exportFrameIds.length
                  }
                  onClick={c.exportMedia}
                >
                  {c.exportPreparing ? tr('preparingExport') : tr('export')}
                </button>
              </div>
              <input
                data-action-id="communication-studio.export.frames.search"
                className="bg-background h-8 w-full rounded-md border px-2 text-sm"
                type="search"
                aria-label={tr('searchExportFrames')}
                placeholder={tr('searchExportFrames')}
                value={exportQuery}
                onChange={event => setExportQuery(event.currentTarget.value)}
              />
              <div className="flex gap-1">
                <button
                  data-action-id="communication-studio.export.frames.select-all"
                  type="button"
                  className={button}
                  onClick={c.markAllExportFrames}
                >
                  {tr('markAllFrames')}
                </button>
                <button
                  data-action-id="communication-studio.export.frames.select-current"
                  type="button"
                  className={button}
                  disabled={!c.exportFrames.some(frame => frame.id === c.selected[0])}
                  onClick={c.markSelectedExportFrame}
                >
                  {tr('markSelectedFrame')}
                </button>
              </div>
              <div
                className="max-h-[min(24rem,50dvh)] space-y-0.5 overflow-auto"
                role="group"
                aria-label={tr('exportFrames')}
              >
                {c.exportFrames
                  .filter(frame =>
                    frame.name.toLocaleLowerCase().includes(exportQuery.trim().toLocaleLowerCase())
                  )
                  .map(frame => (
                    <label
                      key={frame.id}
                      className="hover:bg-muted/60 flex min-h-8 cursor-pointer items-center gap-2 rounded-sm px-2 text-sm"
                    >
                      <input
                        data-action-id="communication-studio.export.frame.toggle"
                        type="checkbox"
                        checked={c.exportFrameIds.includes(frame.id)}
                        onChange={() => c.toggleExportFrame(frame.id)}
                      />
                      <Frame className="size-4 shrink-0" aria-hidden="true" />
                      <span className="truncate">{frame.name}</span>
                    </label>
                  ))}
              </div>
              <p className="text-muted-foreground text-xs">
                {tr(c.format === 'canva' ? 'canvaHint' : 'exportHint')}
              </p>
              {c.exportPreparing && (
                <div role="status" className="flex items-center gap-2 text-sm">
                  <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" />
                  {tr('preparingExport')}
                </div>
              )}
              {c.exportFailure && (
                <p role="alert" className="text-destructive text-sm">
                  {c.exportFailure}
                </p>
              )}
              {c.exportStatusError && (
                <p role="status" className="text-muted-foreground text-sm">
                  {tr('exportStatusUnavailable')}
                </p>
              )}
              {c.exports.map(job => (
                <div key={job.id} className="border-t px-1 pt-2 text-sm">
                  <div className="flex items-center gap-3">
                    {(job.status === 'queued' || job.status === 'running') && (
                      <Loader2
                        className="size-4 shrink-0 motion-safe:animate-spin"
                        aria-hidden="true"
                      />
                    )}
                    <span>
                      {job.format === 'zip' ? 'ALL' : job.format.toUpperCase()} · {tr(job.status)} ·{' '}
                      {job.progress}%
                    </span>
                    {job.status === 'completed' ? (
                      <>
                        <button
                          data-action-id="communication-studio.studioworkspace.activate.button-fdbeb1cd6b"
                          className={button}
                          onClick={() => c.downloadExport(job.id, job.fileName)}
                        >
                          {tr('download')}
                        </button>
                        {(job.fileName?.endsWith('.png') || job.fileName?.endsWith('.mp4')) && (
                          <button
                            data-action-id="communication-studio.studioworkspace.activate.button-07f95dca6d"
                            className={button}
                            disabled={disabled}
                            onClick={() =>
                              c.run(async () => {
                                const result = await c.actions.request<any>('handoff', {
                                  id: job.id,
                                });
                                sessionStorage.setItem(
                                  'studio:post',
                                  JSON.stringify({
                                    ...result,
                                    groupId,
                                    title: value.title,
                                    projectId,
                                  })
                                );
                                window.location.assign(
                                  '/create/statement' + (groupId ? '?groupId=' + groupId : '')
                                );
                              })
                            }
                          >
                            {tr('usePost')}
                          </button>
                        )}
                      </>
                    ) : (
                      ['queued', 'running'].includes(job.status) && (
                        <button
                          data-action-id="communication-studio.studioworkspace.activate.button-f159baea82"
                          className={button}
                          disabled={disabled}
                          onClick={() => c.run(() => c.actions.request('cancel', { id: job.id }))}
                        >
                          {tr('cancel')}
                        </button>
                      )
                    )}
                  </div>
                  {(job.status === 'queued' || job.status === 'running') && (
                    <Progress
                      aria-label={`${job.format.toUpperCase()} ${tr('exportProgress')}`}
                      value={Math.max(0, Math.min(100, job.progress))}
                      className="mt-2 h-2 motion-safe:animate-pulse"
                    />
                  )}
                  {job.error && <p role="alert">{job.error}</p>}
                </div>
              ))}
            </section>
          </StudioPanel>
        </ToolbarGroup>
      </FixedToolbar>
      <section className="bg-card flex min-h-0 flex-1 flex-col overflow-hidden">
        <header
          className="scrollbar-hide flex h-10 min-h-10 shrink-0 items-center gap-3 overflow-x-auto border-b px-3 py-1"
          aria-label={tr('projectStatus')}
        >
          <input
            data-action-id="communication-studio.project.title.edit"
            aria-label={tr('name')}
            className={input + ' h-8 max-w-sm min-w-40 flex-1 font-semibold'}
            value={value.title}
            disabled={disabled}
            maxLength={200}
            onChange={ev => c.meta('title', ev.target.value)}
          />
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <ShareButton
              data-action-id="editor.shell.share.open"
              url={groupId ? `/group/${groupId}/studio/${projectId}` : `/studio/${projectId}`}
              title={value.title}
              size="sm"
            />
            {!groupId && c.project?.group_id === null && c.project.owner_id === c.identity.id ? (
              <StudioInviteDialog projectId={projectId} currentUserId={c.identity.id} />
            ) : null}
            <OnlineCollaboratorAvatars
              collaborators={studioPresence.collaborators}
              onlinePeerMap={studioPresence.onlinePeerMap}
              activeCursorUserIds={studioPresence.activeCursorUserIds}
              currentUserId={c.identity.id}
              presenceColorByUserId={studioPresence.presenceColorByUserId}
            />
            <EditorSaveStatus
              saveStatus={sharedSaveStatus}
              hasUnsavedChanges={c.status === 'unsaved'}
              className="w-auto whitespace-nowrap md:w-auto"
            />
          </div>
          {['error', 'offline', 'unsaved'].includes(c.status) && (
            <button
              onClick={() =>
                void c.retry().catch(() => {
                  /* Error is visible in save status. */
                })
              }
            >
              {tr('retry')}
            </button>
          )}
        </header>
        {(c.failure || c.error) && (
          <p role="alert" className="text-destructive p-2">
            {c.failure || c.error}
          </p>
        )}
        {(readOnlyReason || (!c.canEdit && readOnlyReason === undefined)) && (
          <p role="status">{readOnlyReason ? tr(readOnlyReason) : tr('readOnly')}</p>
        )}
        {!!c.conflicts.length && (
          <section role="alert" className="space-y-2 rounded border p-3">
            <h2>{tr('conflict')}</h2>
            {c.conflicts.map((f, i) => (
              <div key={i}>
                <p>{f.path.join(' / ')}</p>
                <pre className="max-h-28 overflow-auto text-xs">
                  {JSON.stringify(
                    { [tr('base')]: f.base, [tr('local')]: f.local, [tr('remote')]: f.remote },
                    null,
                    2
                  )}
                </pre>
              </div>
            ))}
            <button
              onClick={() =>
                void c.resolveConflicts(false).catch(() => {
                  /* Error is visible in save status. */
                })
              }
            >
              {tr('keepRemote')}
            </button>
            <button
              onClick={() =>
                void c.resolveConflicts(true).catch(() => {
                  /* Error is visible in save status. */
                })
              }
            >
              {tr('keepLocal')}
            </button>
          </section>
        )}
        <div className="min-h-0 flex-1">
          <Suspense fallback={<p>{tr('loading')}</p>}>
            <KonvaStudioCanvas
              ref={attachCanvas}
              key={`${projectId}:${masterMode ? 'master' : 'content'}`}
              document={canvasDocument}
              changeRequestMarkers={changeRequestMarkers}
              changeRequestOverlay={canvasOverlay}
              onChangeRequestSelect={onChangeRequestSelect}
              activeFrameId={canvasPage.id}
              onCreateNode={createCanvasNode}
              onDeleteNodes={cutV3Clipboard}
              onTextChange={changeCanvasText}
              onClipboard={canvasClipboard}
              activateFrame={frameId => {
                c.setPageId(frameId);
              }}
              applyCanvasChanges={applyCanvasChanges}
              onNodeDragMove={(_nodeId, ids, x, y) => {
                overElementsTarget(ids, x, y);
              }}
              onNodeDragEnd={(_nodeId, ids, x, y) => dropCanvasSelectionOnElements(ids, x, y)}
              onElementSetDrop={(setId, point) => {
                if (!disabled && c.elementSets.some(set => set.id === setId))
                  void c.insertElementSet(setId, point);
              }}
              assets={[...c.assets, ...(previewAssets ?? [])]}
              selected={c.selected}
              selectExact={c.selectExact}
              editable={!disabled && !previewDocument}
              peers={c.peers}
              cursor={(x, y) => c.cursor(canvasPage.id, x, y, c.selected)}
              guides={c.guides}
              onCanvasStateChange={handleCanvasStateChange}
              onCropCommit={(nodeId, state) =>
                c.transactV3(document => {
                  const node = document.nodes.find(candidate => candidate.id === nodeId);
                  if (node?.type !== 'media' || node.locked || !state) return;
                  node.transform = { ...state.frame };
                  const crop = state.crop;
                  const fullSource =
                    Math.abs(crop.x) < 0.01 &&
                    Math.abs(crop.y) < 0.01 &&
                    Math.abs(crop.width - crop.naturalWidth) < 0.01 &&
                    Math.abs(crop.height - crop.naturalHeight) < 0.01;
                  node.crop = fullSource ? null : { ...crop };
                  node.fit = state.fit;
                  node.focus = { ...state.focus };
                })
              }
              cropLabels={{
                crop: tr('cropMedia'),
                apply: tr('applyCrop'),
                cancel: tr('cancelCrop'),
                reset: tr('resetCrop'),
                zoom: tr('cropZoom'),
                loading: tr('cropLoading'),
                failed: tr('cropFailed'),
              }}
              inspector={!masterMode && activeNode ? props : undefined}
              inspectorLabels={{
                title: tr('properties'),
                collapse: tr('collapseProperties'),
                expand: tr('expandProperties'),
                move: tr('moveProperties'),
              }}
              registerTextEditor={e => {
                textEditor.current = e;
              }}
              contextToolbar={contextToolbar}
              contextToolbarLabel={tr('elementActions')}
            />
          </Suspense>
        </div>
      </section>
      {c.v3Value && (
        <StudioPreviewDialog
          document={c.v3Value}
          assets={c.assets}
          activeFrameId={page.id}
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          returnFocusRef={previewButton}
          tr={tr}
        />
      )}
      <ImageEditorDialog
        imageUrl={c.photoEdit}
        open={!!c.photoEdit}
        onOpenChange={v => {
          if (!v) c.setPhotoEdit(undefined);
        }}
        onSave={async file => (await c.savePhoto(file)) ?? false}
      />
      {cloneOpen && (
        <StudioCloneDialog
          sourceId={projectId}
          open={cloneOpen}
          onOpenChange={setCloneOpen}
          beforeClone={c.commit}
        />
      )}
      {visibilityOpen && (
        <StudioVisibilityDialog
          key={`${projectId}:${c.project?.visibility ?? 'private'}`}
          projectId={projectId}
          visibility={
            (c.project?.visibility as 'public' | 'authenticated' | 'private') ?? 'private'
          }
          open={visibilityOpen}
          onOpenChange={setVisibilityOpen}
        />
      )}
    </main>
  );
}
