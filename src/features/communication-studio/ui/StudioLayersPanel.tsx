import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type DragEvent,
} from 'react';
import {
  ChartNoAxesColumn,
  Code2,
  Eye,
  EyeOff,
  File,
  Frame,
  Image as ImageIcon,
  LockKeyhole,
  Pencil,
  PencilLine,
  Shapes,
  Table2,
  Type,
  UnlockKeyhole,
  Video,
  Volume2,
} from 'lucide-react';
import { cn } from '@/features/shared/utils/utils';
import { canMoveStudioLayer, type StudioLayerMovePosition } from '../logic/commands-v3';
import type { StudioDocumentV3, StudioNode } from '../logic/document-v3';
import { getStudioRootFramesInLayerOrder } from '../logic/frame-order';

export interface StudioLayerTreeEntry {
  node: StudioNode;
  depth: number;
  rootFrameId: string | null;
  hasChildren: boolean;
}

const compareLayers = (left: StudioNode, right: StudioNode) =>
  right.zIndex - left.zIndex || left.id.localeCompare(right.id);

function searchText(node: StudioNode) {
  return `${node.name} ${node.type} ${node.type === 'shape' ? node.shape : ''}`.toLocaleLowerCase();
}

export function buildStudioLayerTree(
  document: StudioDocumentV3,
  query = ''
): StudioLayerTreeEntry[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const children = new Map<string | null, StudioNode[]>();

  for (const node of document.nodes) {
    if (node.id === document.masterLayout.frameId) continue;
    const siblings = children.get(node.parentFrameId) ?? [];
    siblings.push(node);
    children.set(node.parentFrameId, siblings);
  }

  const visit = (
    node: StudioNode,
    depth: number,
    rootFrameId: string | null
  ): StudioLayerTreeEntry[] => {
    const descendants = (children.get(node.id) ?? [])
      .sort(compareLayers)
      .flatMap(child => visit(child, depth + 1, rootFrameId));
    const matches = !normalizedQuery || searchText(node).includes(normalizedQuery);
    if (!matches && descendants.length === 0) return [];
    return [
      {
        node,
        depth,
        rootFrameId,
        hasChildren: (children.get(node.id)?.length ?? 0) > 0,
      },
      ...descendants,
    ];
  };

  const roots = children.get(null) ?? [];
  const frames = getStudioRootFramesInLayerOrder(document);
  const unframed = roots.filter(node => node.type !== 'frame').sort(compareLayers);

  return [
    ...frames.flatMap(frame => visit(frame, 0, frame.id)),
    ...unframed.flatMap(node => visit(node, 0, null)),
  ];
}

function layerIcon(node: StudioNode): ComponentType<{ className?: string }> {
  switch (node.type) {
    case 'frame':
      return Frame;
    case 'richText':
      return Type;
    case 'shape':
      return Shapes;
    case 'drawing':
      return Pencil;
    case 'media':
      if (node.mediaType === 'video') return Video;
      if (node.mediaType === 'audio') return Volume2;
      if (node.mediaType === 'file') return File;
      return ImageIcon;
    case 'table':
      return Table2;
    case 'chart':
      return ChartNoAxesColumn;
    case 'embed':
      return Code2;
  }
}

export function StudioLayersPanel({
  document,
  selectedNodeIds,
  disabled,
  tr,
  onSelect,
  onSetVisibility,
  onSetLocked,
  onMove,
  onRename,
}: {
  document: StudioDocumentV3;
  selectedNodeIds: string[];
  disabled: boolean;
  tr: (key: string) => string;
  onSelect: (node: StudioNode, rootFrameId: string | null) => void;
  onSetVisibility: (node: StudioNode, visible: boolean) => void;
  onSetLocked: (node: StudioNode, locked: boolean) => void;
  onMove: (nodeId: string, targetId: string, position: StudioLayerMovePosition) => void;
  onRename: (nodeId: string, name: string) => void;
}) {
  const [query, setQuery] = useState('');
  interface RenameDraft {
    nodeId: string;
    originalName: string;
    value: string;
    error: boolean;
  }
  const [renameDraft, setRenameDraft] = useState<RenameDraft | null>(null);
  const renameDraftRef = useRef<RenameDraft | null>(null);
  const renameButtonRef = useRef<HTMLButtonElement | null>(null);
  const errorId = useId();
  const [renameNotice, setRenameNotice] = useState(false);
  const updateRenameDraft = (draft: RenameDraft | null) => {
    renameDraftRef.current = draft;
    setRenameDraft(draft);
  };
  const focusNameInput = useCallback((input: HTMLInputElement | null) => {
    input?.focus();
    input?.select();
  }, []);

  useEffect(() => {
    const draft = renameDraftRef.current;
    if (!draft) return;
    const node = document.nodes.find(candidate => candidate.id === draft.nodeId);
    if (disabled || !node || node.locked || node.name !== draft.originalName) {
      renameDraftRef.current = null;
      setRenameDraft(null);
      if (node && node.name !== draft.originalName) setRenameNotice(true);
    }
  }, [document, disabled]);

  useEffect(() => {
    if (!renameNotice) return;
    const timer = setTimeout(() => setRenameNotice(false), 5000);
    return () => clearTimeout(timer);
  }, [renameNotice]);

  const finishRename = (reason: 'enter' | 'blur' | 'escape') => {
    const draft = renameDraftRef.current;
    if (!draft) return;
    const node = document.nodes.find(candidate => candidate.id === draft.nodeId);
    const name = draft.value.trim();
    const editable = !disabled && node && !node.locked && node.name === draft.originalName;
    if (reason === 'enter' && editable && (!name || name.length > 200)) {
      updateRenameDraft({ ...draft, error: true });
      return;
    }
    const button = renameButtonRef.current;
    // Clear synchronously before committing or focusing: either can trigger another blur.
    updateRenameDraft(null);
    if (reason !== 'escape' && editable && name && name.length <= 200 && name !== node.name)
      onRename(draft.nodeId, name);
    if (reason !== 'blur') button?.focus();
  };

  const beginRename = (entry: StudioLayerTreeEntry) => {
    if (disabled || entry.node.locked || renameDraftRef.current?.nodeId === entry.node.id) return;
    finishRename('blur');
    setRenameNotice(false);
    onSelect(entry.node, entry.rootFrameId);
    updateRenameDraft({
      nodeId: entry.node.id,
      originalName: entry.node.name,
      value: entry.node.name,
      error: false,
    });
  };
  const draggedNodeIdRef = useRef<string | null>(null);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    nodeId: string;
    position: StudioLayerMovePosition;
  } | null>(null);
  const entries = useMemo(() => buildStudioLayerTree(document, query), [document, query]);

  const resolveDropPosition = (event: DragEvent<HTMLDivElement>, target: StudioNode) => {
    if (disabled || renameDraftRef.current?.nodeId === target.id) return null;
    const sourceId =
      draggedNodeIdRef.current || event.dataTransfer.getData('text/plain') || draggedNodeId;
    if (!sourceId) return null;
    if (renameDraftRef.current?.nodeId === sourceId) return null;
    const source = document.nodes.find(node => node.id === sourceId);
    if (!source) return null;
    const bounds = event.currentTarget.getBoundingClientRect();
    const pointerY = Number.isFinite(event.clientY)
      ? event.clientY
      : bounds.top + bounds.height / 2;
    const ratio = bounds.height ? (pointerY - bounds.top) / bounds.height : 0.5;
    const position: StudioLayerMovePosition =
      target.type === 'frame' && source.type !== 'frame' && ratio >= 0.25 && ratio <= 0.75
        ? 'inside'
        : ratio < 0.5
          ? 'before'
          : 'after';
    return canMoveStudioLayer(document, source.id, target.id, position) ? position : null;
  };

  return (
    <div className="space-y-2">
      <input
        className="bg-background h-8 w-full rounded-md border px-2 text-sm"
        type="search"
        aria-label={tr('searchLayers')}
        value={query}
        placeholder={tr('searchLayers')}
        onChange={event => setQuery(event.currentTarget.value)}
      />
      {renameNotice && (
        <p className="text-muted-foreground px-2 text-xs" role="status">
          {tr('layerRenamedElsewhere')}
        </p>
      )}
      <div className="max-h-[min(32rem,70dvh)] space-y-0.5 overflow-auto" role="tree">
        {entries.map(entry => {
          const { node } = entry;
          const Icon = layerIcon(node);
          const selected = selectedNodeIds.includes(node.id);
          const editing = renameDraft?.nodeId === node.id;
          return (
            <div
              key={node.id}
              role="treeitem"
              aria-level={entry.depth + 1}
              aria-expanded={entry.hasChildren ? true : undefined}
              aria-selected={selected}
              draggable={!disabled && !node.locked && !editing}
              data-studio-layer-id={node.id}
              data-drop-position={dropTarget?.nodeId === node.id ? dropTarget.position : undefined}
              className={cn(
                'relative flex min-h-8 items-center rounded-sm text-sm',
                selected && 'bg-accent text-accent-foreground',
                draggedNodeId === node.id && 'opacity-50',
                dropTarget?.nodeId === node.id &&
                  dropTarget.position === 'inside' &&
                  'ring-primary bg-primary/10 ring-2 ring-inset'
              )}
              onDragStart={event => {
                if (disabled || node.locked || editing) {
                  event.preventDefault();
                  return;
                }
                draggedNodeIdRef.current = node.id;
                setDraggedNodeId(node.id);
                setDropTarget(null);
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', node.id);
              }}
              onDragOver={event => {
                const position = resolveDropPosition(event, node);
                if (!position) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                setDropTarget(current =>
                  current?.nodeId === node.id && current.position === position
                    ? current
                    : { nodeId: node.id, position }
                );
              }}
              onDragLeave={event => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null))
                  setDropTarget(current => (current?.nodeId === node.id ? null : current));
              }}
              onDrop={event => {
                const position = resolveDropPosition(event, node);
                const sourceId =
                  draggedNodeIdRef.current ||
                  event.dataTransfer.getData('text/plain') ||
                  draggedNodeId;
                event.preventDefault();
                if (sourceId && position) onMove(sourceId, node.id, position);
                draggedNodeIdRef.current = null;
                setDraggedNodeId(null);
                setDropTarget(null);
              }}
              onDragEnd={() => {
                draggedNodeIdRef.current = null;
                setDraggedNodeId(null);
                setDropTarget(null);
              }}
            >
              {dropTarget?.nodeId === node.id && dropTarget.position !== 'inside' && (
                <span
                  aria-hidden="true"
                  className={cn(
                    'bg-primary pointer-events-none absolute inset-x-1 z-10 h-0.5',
                    dropTarget.position === 'before' ? 'top-0' : 'bottom-0'
                  )}
                />
              )}
              {editing ? (
                <div className="min-w-0 flex-1" style={{ paddingLeft: `${0.5 + entry.depth}rem` }}>
                  <div className="flex items-center gap-2">
                    <Icon className="size-4 shrink-0" />
                    <input
                      data-studio-layer-name-input
                      ref={focusNameInput}
                      className="bg-background focus-visible:ring-ring h-8 w-full min-w-0 rounded-sm border px-1 focus-visible:ring-2 focus-visible:outline-none"
                      aria-label={`${tr('layerName')}: ${renameDraft.originalName}`}
                      aria-invalid={renameDraft.error || undefined}
                      aria-describedby={renameDraft.error ? errorId : undefined}
                      value={renameDraft.value}
                      maxLength={200}
                      onChange={event =>
                        updateRenameDraft({
                          ...renameDraft,
                          value: event.currentTarget.value,
                          error: false,
                        })
                      }
                      onBlur={() => finishRename('blur')}
                      onKeyDown={event => {
                        event.stopPropagation();
                        if (event.nativeEvent.isComposing) return;
                        if (event.key === 'Enter' || event.key === 'Escape') {
                          event.preventDefault();
                          finishRename(event.key === 'Enter' ? 'enter' : 'escape');
                        }
                      }}
                    />
                  </div>
                  {renameDraft.error && (
                    <p id={errorId} className="text-destructive text-xs" role="alert">
                      {tr('layerNameRequired')}
                    </p>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  className="hover:bg-muted/60 flex min-w-0 flex-1 items-center gap-2 self-stretch rounded-sm pr-1 text-left"
                  style={{ paddingLeft: `${0.5 + entry.depth}rem` }}
                  onClick={() => onSelect(node, entry.rootFrameId)}
                  onDoubleClick={() => beginRename(entry)}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="truncate">{node.name}</span>
                </button>
              )}
              <button
                ref={editing ? renameButtonRef : undefined}
                type="button"
                className="hover:bg-muted focus-visible:ring-ring m-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-sm focus-visible:ring-2 focus-visible:outline-none disabled:opacity-40"
                aria-label={`${tr('rename')}: ${node.name}`}
                disabled={disabled || node.locked}
                onClick={() => beginRename(entry)}
              >
                <PencilLine className="size-4" />
              </button>
              <button
                type="button"
                className="hover:bg-muted focus-visible:ring-ring m-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-sm focus-visible:ring-2 focus-visible:outline-none disabled:opacity-40"
                aria-label={`${node.visible ? tr('hide') : tr('show')}: ${node.name}`}
                aria-pressed={!node.visible}
                disabled={disabled || node.locked}
                onClick={() => onSetVisibility(node, !node.visible)}
              >
                {node.visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
              </button>
              <button
                type="button"
                className="hover:bg-muted focus-visible:ring-ring m-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-sm focus-visible:ring-2 focus-visible:outline-none disabled:opacity-40"
                aria-label={`${node.locked ? tr('unlock') : tr('lock')}: ${node.name}`}
                aria-pressed={node.locked}
                disabled={disabled}
                onClick={() => onSetLocked(node, !node.locked)}
              >
                {node.locked ? (
                  <LockKeyhole className="size-4" />
                ) : (
                  <UnlockKeyhole className="size-4" />
                )}
              </button>
            </div>
          );
        })}
        {entries.length === 0 && (
          <p className="text-muted-foreground px-2 py-6 text-center text-sm" role="status">
            {tr('noLayers')}
          </p>
        )}
      </div>
    </div>
  );
}
