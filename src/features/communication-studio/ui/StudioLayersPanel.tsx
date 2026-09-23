import { useMemo, useRef, useState, type ComponentType, type DragEvent } from 'react';
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
}: {
  document: StudioDocumentV3;
  selectedNodeIds: string[];
  disabled: boolean;
  tr: (key: string) => string;
  onSelect: (node: StudioNode, rootFrameId: string | null) => void;
  onSetVisibility: (node: StudioNode, visible: boolean) => void;
  onSetLocked: (node: StudioNode, locked: boolean) => void;
  onMove: (nodeId: string, targetId: string, position: StudioLayerMovePosition) => void;
}) {
  const [query, setQuery] = useState('');
  const draggedNodeIdRef = useRef<string | null>(null);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    nodeId: string;
    position: StudioLayerMovePosition;
  } | null>(null);
  const entries = useMemo(() => buildStudioLayerTree(document, query), [document, query]);

  const resolveDropPosition = (event: DragEvent<HTMLDivElement>, target: StudioNode) => {
    const sourceId =
      draggedNodeIdRef.current || event.dataTransfer.getData('text/plain') || draggedNodeId;
    if (!sourceId) return null;
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
      <div className="max-h-[min(32rem,70dvh)] space-y-0.5 overflow-auto" role="tree">
        {entries.map(entry => {
          const { node } = entry;
          const Icon = layerIcon(node);
          const selected = selectedNodeIds.includes(node.id);
          return (
            <div
              key={node.id}
              role="treeitem"
              aria-level={entry.depth + 1}
              aria-expanded={entry.hasChildren ? true : undefined}
              aria-selected={selected}
              draggable={!disabled && !node.locked}
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
              <button
                type="button"
                className="hover:bg-muted/60 flex min-w-0 flex-1 items-center gap-2 self-stretch rounded-sm pr-1 text-left"
                style={{ paddingLeft: `${0.5 + entry.depth}rem` }}
                onClick={() => onSelect(node, entry.rootFrameId)}
              >
                <Icon className="size-4 shrink-0" />
                <span className="truncate">{node.name}</span>
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
