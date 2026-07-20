import type { PrimaryEntityTone } from '@/features/shared/theme';
import React, { type CSSProperties, type ReactNode } from 'react';
import { RightBadge } from '@/features/shared/ui/status';

export type GroupNodeVisualVariant =
  'current' | 'parent' | 'child' | 'sibling-open' | 'sibling-elected' | 'sibling-parliament';

type GroupNodeVisualRole = 'current' | 'parent' | 'child' | 'sibling';

export type WorkflowStepVisualRole = 'start' | 'intermediate' | 'end';
export type ProcessStatusVisualState = 'approved' | 'active-next' | 'pending' | 'rejected';

export type CivicNetworkNodeKind =
  | { type: 'entity'; entityType: PrimaryEntityTone }
  | { type: 'group'; visualVariant: GroupNodeVisualVariant }
  | { type: 'workflow'; role: WorkflowStepVisualRole }
  | { type: 'process'; state: ProcessStatusVisualState };

export interface NodeVisualTokens {
  symbol: string;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  shadowColor?: string;
}

interface EntityNetworkNodeStyleOptions {
  width?: CSSProperties['width'];
  height?: CSSProperties['height'];
  borderRadius?: CSSProperties['borderRadius'];
  padding?: CSSProperties['padding'];
  fontSize?: CSSProperties['fontSize'];
  fontWeight?: CSSProperties['fontWeight'];
  textAlign?: CSSProperties['textAlign'];
  cursor?: CSSProperties['cursor'];
  display?: CSSProperties['display'];
  alignItems?: CSSProperties['alignItems'];
  justifyContent?: CSSProperties['justifyContent'];
  boxShadow?: CSSProperties['boxShadow'];
  borderWidth?: number;
}

const CIVIC_NODE_SURFACE = 'var(--card)';
const CIVIC_NODE_TEXT = 'var(--card-foreground)';
const CIVIC_NODE_SHADOW = 'var(--shadow-panel)';
const CIVIC_NODE_MUTED_BORDER = 'var(--border)';

const ENTITY_NODE_SYMBOLS: Record<PrimaryEntityTone, string> = {
  user: 'U',
  group: 'G',
  event: 'E',
  amendment: 'A',
  blog: 'B',
};

const GROUP_NODE_VISUALS: Record<GroupNodeVisualVariant, NodeVisualTokens> = {
  current: {
    symbol: '●',
    backgroundColor: CIVIC_NODE_SURFACE,
    borderColor: 'var(--entity-group-border)',
    textColor: 'var(--entity-group-fg)',
  },
  parent: {
    symbol: '▲',
    backgroundColor: CIVIC_NODE_SURFACE,
    borderColor: 'var(--badge-success-border)',
    textColor: 'var(--badge-success-fg)',
  },
  child: {
    symbol: '▼',
    backgroundColor: CIVIC_NODE_SURFACE,
    borderColor: 'var(--badge-warning-border)',
    textColor: 'var(--badge-warning-fg)',
  },
  'sibling-open': {
    symbol: '◎',
    backgroundColor: CIVIC_NODE_SURFACE,
    borderColor: 'var(--badge-neutral-border)',
    textColor: 'var(--badge-neutral-fg)',
  },
  'sibling-elected': {
    symbol: '◆',
    backgroundColor: CIVIC_NODE_SURFACE,
    borderColor: 'var(--badge-danger-border)',
    textColor: 'var(--badge-danger-fg)',
  },
  'sibling-parliament': {
    symbol: '⬢',
    backgroundColor: CIVIC_NODE_SURFACE,
    borderColor: 'var(--badge-accent-border)',
    textColor: 'var(--badge-accent-fg)',
  },
};

const PROCESS_STATUS_VISUALS: Record<ProcessStatusVisualState, NodeVisualTokens> = {
  approved: {
    symbol: '✓',
    backgroundColor: CIVIC_NODE_SURFACE,
    borderColor: 'var(--badge-success-border)',
    textColor: 'var(--badge-success-fg)',
  },
  'active-next': {
    symbol: '→',
    backgroundColor: CIVIC_NODE_SURFACE,
    borderColor: 'var(--badge-info-border)',
    textColor: 'var(--badge-info-fg)',
  },
  pending: {
    symbol: '…',
    backgroundColor: CIVIC_NODE_SURFACE,
    borderColor: 'var(--badge-neutral-border)',
    textColor: 'var(--badge-neutral-fg)',
  },
  rejected: {
    symbol: '×',
    backgroundColor: CIVIC_NODE_SURFACE,
    borderColor: 'var(--badge-danger-border)',
    textColor: 'var(--badge-danger-fg)',
  },
};

function getEntityVisualTokens(entityType: PrimaryEntityTone): NodeVisualTokens {
  return {
    symbol: ENTITY_NODE_SYMBOLS[entityType],
    backgroundColor: CIVIC_NODE_SURFACE,
    borderColor: `var(--entity-${entityType}-border)`,
    textColor: `var(--entity-${entityType}-fg)`,
  };
}

function getWorkflowStepVisualVariant(role: WorkflowStepVisualRole): GroupNodeVisualVariant {
  switch (role) {
    case 'start':
      return 'current';
    case 'end':
      return 'child';
    case 'intermediate':
    default:
      return 'parent';
  }
}

function getCivicNetworkVisualTokens(kind: CivicNetworkNodeKind): NodeVisualTokens {
  switch (kind.type) {
    case 'entity':
      return getEntityVisualTokens(kind.entityType);
    case 'workflow':
      return GROUP_NODE_VISUALS[getWorkflowStepVisualVariant(kind.role)];
    case 'process':
      return PROCESS_STATUS_VISUALS[kind.state];
    case 'group':
    default:
      return GROUP_NODE_VISUALS[kind.visualVariant];
  }
}

function getCivicNodeAccentShadow(accentColor: string, emphasis = 20) {
  return `0 0 0 1px color-mix(in oklab, ${accentColor} ${emphasis}%, transparent), ${CIVIC_NODE_SHADOW}`;
}

function getCivicNodeSurface(kind: CivicNetworkNodeKind, visual: NodeVisualTokens) {
  if (kind.type === 'group' || kind.type === 'workflow') {
    return `color-mix(in oklab, ${visual.borderColor} 10%, ${CIVIC_NODE_SURFACE})`;
  }

  return visual.backgroundColor;
}

export function getCivicNetworkNodeStyle(
  kind: CivicNetworkNodeKind,
  options: EntityNetworkNodeStyleOptions = {}
): CSSProperties {
  const visual = getCivicNetworkVisualTokens(kind);
  const isPrimary =
    (kind.type === 'group' && kind.visualVariant === 'current') ||
    (kind.type === 'workflow' && kind.role === 'start') ||
    (kind.type === 'process' && kind.state === 'active-next');
  const borderWidth =
    options.borderWidth ?? (kind.type === 'group' || kind.type === 'workflow' || isPrimary ? 2 : 1);

  return {
    background: getCivicNodeSurface(kind, visual),
    color: kind.type === 'group' || kind.type === 'workflow' ? visual.textColor : CIVIC_NODE_TEXT,
    border: `${borderWidth}px solid ${visual.borderColor ?? CIVIC_NODE_MUTED_BORDER}`,
    borderColor: visual.borderColor ?? CIVIC_NODE_MUTED_BORDER,
    borderStyle: 'solid',
    borderWidth,
    borderRadius: options.borderRadius ?? '10px',
    padding: options.padding ?? '12px',
    fontSize: options.fontSize ?? '12px',
    fontWeight: options.fontWeight ?? (isPrimary ? '700' : '600'),
    width: options.width ?? 180,
    height: options.height,
    textAlign: options.textAlign ?? 'center',
    cursor: options.cursor,
    display: options.display,
    alignItems: options.alignItems,
    justifyContent: options.justifyContent,
    boxShadow:
      options.boxShadow ?? getCivicNodeAccentShadow(visual.borderColor, isPrimary ? 28 : 18),
  };
}

export function getCivicNetworkNodeLegendItem({
  id,
  label,
  kind,
}: {
  id: string;
  label: string;
  kind: CivicNetworkNodeKind;
}) {
  return {
    id,
    label,
    swatch: renderCivicNetworkSwatch(getCivicNetworkVisualTokens(kind)),
  };
}

export function getCivicNetworkMiniMapNodeColor(node: { data?: unknown; type?: string }): string {
  const data = node.data as Record<string, unknown> | undefined;
  const entityType = data?.entityType;
  const visualVariant = data?.visualVariant;
  const processState = data?.processState ?? data?.status;
  const nodeType = data?.type ?? node.type;

  if (isPrimaryEntityTone(entityType)) {
    return `var(--entity-${entityType}-border)`;
  }

  if (nodeType === 'user' || nodeType === 'user-center') {
    return 'var(--entity-user-border)';
  }

  if (nodeType === 'event' || nodeType === 'event-center') {
    return 'var(--entity-event-border)';
  }

  if (nodeType === 'amendment') {
    return 'var(--entity-amendment-border)';
  }

  if (isGroupNodeVisualVariant(visualVariant)) {
    return GROUP_NODE_VISUALS[visualVariant].borderColor;
  }

  if (isProcessStatusVisualState(processState)) {
    return PROCESS_STATUS_VISUALS[processState].borderColor;
  }

  return 'var(--entity-group-border)';
}

function isPrimaryEntityTone(value: unknown): value is PrimaryEntityTone {
  return (
    value === 'user' ||
    value === 'group' ||
    value === 'event' ||
    value === 'amendment' ||
    value === 'blog'
  );
}

function isGroupNodeVisualVariant(value: unknown): value is GroupNodeVisualVariant {
  return (
    value === 'current' ||
    value === 'parent' ||
    value === 'child' ||
    value === 'sibling-open' ||
    value === 'sibling-elected' ||
    value === 'sibling-parliament'
  );
}

function isProcessStatusVisualState(value: unknown): value is ProcessStatusVisualState {
  return (
    value === 'approved' || value === 'active-next' || value === 'pending' || value === 'rejected'
  );
}

export function getGroupNodeVisualVariant({
  role,
  siblingMembershipMode,
}: {
  role: GroupNodeVisualRole;
  siblingMembershipMode?: string | null;
}): GroupNodeVisualVariant {
  if (role === 'current' || role === 'parent' || role === 'child') {
    return role;
  }

  if (siblingMembershipMode === 'elected') {
    return 'sibling-elected';
  }

  if (siblingMembershipMode === 'parliament') {
    return 'sibling-parliament';
  }

  return 'sibling-open';
}

export function getGroupNodeVisualTokens(visualVariant: GroupNodeVisualVariant): NodeVisualTokens {
  return { ...GROUP_NODE_VISUALS[visualVariant] };
}

export function getEntityNetworkNodeStyle(
  entityType: PrimaryEntityTone,
  options: EntityNetworkNodeStyleOptions = {}
): CSSProperties {
  return getCivicNetworkNodeStyle({ type: 'entity', entityType }, options);
}

export function getEntityNetworkEdgeColor(entityType: PrimaryEntityTone): string {
  return `var(--entity-${entityType}-border)`;
}

export function getNetworkSelectionStyle(isSelected: boolean): CSSProperties {
  return isSelected
    ? {
        boxShadow: '0 0 0 3px var(--ring), var(--shadow-floating)',
      }
    : {};
}

export function createEntityNodeLegendItem({
  id,
  label,
  entityType,
}: {
  id: string;
  label: string;
  entityType: PrimaryEntityTone;
}) {
  return getCivicNetworkNodeLegendItem({
    id,
    label,
    kind: { type: 'entity', entityType },
  });
}

export function getWorkflowStepNodeStyle(
  role: WorkflowStepVisualRole,
  options: Parameters<typeof getGroupNodeStyle>[1] = {}
): CSSProperties {
  return getCivicNetworkNodeStyle(
    { type: 'workflow', role },
    {
      width: 190,
      textAlign: 'center',
      ...options,
    }
  );
}

export function createWorkflowStepLegendItem({
  id,
  label,
  role,
}: {
  id: string;
  label: string;
  role: WorkflowStepVisualRole;
}) {
  return getCivicNetworkNodeLegendItem({
    id,
    label,
    kind: { type: 'workflow', role },
  });
}

export function getProcessStatusVisualTokens(state: ProcessStatusVisualState): NodeVisualTokens {
  return { ...PROCESS_STATUS_VISUALS[state] };
}

export function getProcessStatusNodeAccent(state: ProcessStatusVisualState): NodeVisualTokens {
  return getProcessStatusVisualTokens(state);
}

export function createProcessStatusLegendItem({
  id,
  label,
  state,
}: {
  id: string;
  label: string;
  state: ProcessStatusVisualState;
}) {
  return getCivicNetworkNodeLegendItem({
    id,
    label,
    kind: { type: 'process', state },
  });
}

export function getGroupNodeDisplayLabel(
  name: string | null | undefined,
  visualVariant: GroupNodeVisualVariant
): string {
  return `${GROUP_NODE_VISUALS[visualVariant].symbol} ${name ?? ''}`;
}

export function getGroupNodeStyle(
  visualVariant: GroupNodeVisualVariant,
  options: {
    width?: CSSProperties['width'];
    fontSize?: CSSProperties['fontSize'];
    fontWeight?: CSSProperties['fontWeight'];
    padding?: CSSProperties['padding'];
    borderRadius?: CSSProperties['borderRadius'];
    borderWidth?: number;
    textAlign?: CSSProperties['textAlign'];
    cursor?: CSSProperties['cursor'];
    boxShadow?: CSSProperties['boxShadow'];
  } = {}
): CSSProperties {
  return getCivicNetworkNodeStyle({ type: 'group', visualVariant }, options);
}

export function getGroupNodeLegendSwatch(visualVariant: GroupNodeVisualVariant): ReactNode {
  return renderCivicNetworkSwatch(GROUP_NODE_VISUALS[visualVariant]);
}

export function createGroupNodeLegendItem({
  id,
  label,
  visualVariant,
}: {
  id: string;
  label: string;
  visualVariant: GroupNodeVisualVariant;
}) {
  return getCivicNetworkNodeLegendItem({
    id,
    label,
    kind: { type: 'group', visualVariant },
  });
}

function renderCivicNetworkSwatch(visual: NodeVisualTokens): ReactNode {
  return (
    <span
      aria-hidden="true"
      className="bg-card flex h-6 w-6 items-center justify-center rounded-md border text-sm font-bold shadow-sm"
      style={{
        borderColor: visual.borderColor,
        color: visual.textColor,
      }}
    >
      {visual.symbol}
    </span>
  );
}

export function getGroupDisplayLabel(
  name: string | null | undefined,
  groupType?: string | null
): string {
  const normalizedType = (groupType ?? '').toLowerCase();
  if (normalizedType === 'hierarchical') {
    return `🏛 ${name ?? ''}`;
  }
  if (normalizedType === 'base') {
    return `◉ ${name ?? ''}`;
  }
  if (normalizedType === 'sibling') {
    return `◎ ${name ?? ''}`;
  }
  return name ?? '';
}

export function renderRightsEdgeLabel(rights: string[]) {
  return (
    <div className="border-border/60 bg-background/95 flex flex-wrap gap-0.5 rounded-md border px-1.5 py-1 shadow-sm backdrop-blur-sm">
      {rights.map(right => (
        <RightBadge key={right} right={right} size="compact" />
      ))}
    </div>
  );
}
