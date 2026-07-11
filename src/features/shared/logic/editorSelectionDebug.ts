const EDITOR_SELECTION_DEBUG_STORAGE_KEY = 'polity:editor-selection-debug';
const DEBUG_PREFIX = '[polity:editor-selection-debug]';

type DebugData = Record<string, unknown>;

interface SlatePointLike {
  offset?: unknown;
  path?: unknown;
}

interface SlateRangeLike {
  anchor?: SlatePointLike;
  focus?: SlatePointLike;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function summarizePath(path: unknown) {
  return Array.isArray(path) ? path.filter(segment => typeof segment === 'number') : null;
}

function summarizePoint(point: SlatePointLike | undefined) {
  if (!point) return null;

  return {
    offset: typeof point.offset === 'number' ? point.offset : null,
    path: summarizePath(point.path),
  };
}

function getTextLength(node: Record<string, unknown>) {
  return typeof node.text === 'string' ? node.text.length : 0;
}

function collectValueStats(value: unknown) {
  const stats = {
    maxDepth: 0,
    nodeCount: 0,
    rootBlockCount: Array.isArray(value) ? value.length : 0,
    textLeafCount: 0,
    textLength: 0,
    typeCounts: {} as Record<string, number>,
  };

  const visit = (node: unknown, depth: number) => {
    if (!isRecord(node)) return;

    stats.nodeCount += 1;
    stats.maxDepth = Math.max(stats.maxDepth, depth);

    if (typeof node.type === 'string') {
      stats.typeCounts[node.type] = (stats.typeCounts[node.type] ?? 0) + 1;
    }

    const textLength = getTextLength(node);
    if (textLength > 0 || typeof node.text === 'string') {
      stats.textLeafCount += 1;
      stats.textLength += textLength;
    }

    if (Array.isArray(node.children)) {
      node.children.forEach(child => visit(child, depth + 1));
    }
  };

  if (Array.isArray(value)) {
    value.forEach(node => visit(node, 1));
  }

  return stats;
}

export function isEditorSelectionDebugEnabled() {
  if (typeof window === 'undefined') return false;

  try {
    return window.localStorage.getItem(EDITOR_SELECTION_DEBUG_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function editorSelectionDebugLog(event: string, data: DebugData = {}) {
  if (!isEditorSelectionDebugEnabled()) return;

  const debugWindow = window as typeof window & {
    __polityEditorSelectionDebug?: {
      data: DebugData;
      event: string;
      timestamp: number;
    }[];
  };
  const entries = debugWindow.__polityEditorSelectionDebug ?? [];
  entries.push({ data, event, timestamp: Date.now() });
  debugWindow.__polityEditorSelectionDebug = entries.slice(-250);

  console.debug(DEBUG_PREFIX, event, data);
}

function summarizeDiscussionValue(value: unknown) {
  if (!isRecord(value)) {
    return {
      changeRequestEntityId: null,
      changeRequestStatus: null,
      commentCount: null,
      confirmationStatus: null,
      crId: null,
      id: null,
      status: null,
      valueType: typeof value,
      votingStatus: null,
      votesAbstain: null,
      votesAgainst: null,
      votesFor: null,
    };
  }

  return {
    changeRequestEntityId:
      typeof value.changeRequestEntityId === 'string' ? value.changeRequestEntityId : null,
    changeRequestStatus:
      typeof value.changeRequestStatus === 'string' ? value.changeRequestStatus : null,
    commentCount: Array.isArray(value.comments) ? value.comments.length : null,
    confirmationStatus:
      typeof value.confirmationStatus === 'string' ? value.confirmationStatus : null,
    crId: typeof value.crId === 'string' ? value.crId : null,
    id: typeof value.id === 'string' ? value.id : null,
    status: typeof value.status === 'string' ? value.status : null,
    valueType: 'object',
    votingStatus: typeof value.votingStatus === 'string' ? value.votingStatus : null,
    votesAbstain: typeof value.votesAbstain === 'number' ? value.votesAbstain : null,
    votesAgainst: typeof value.votesAgainst === 'number' ? value.votesAgainst : null,
    votesFor: typeof value.votesFor === 'number' ? value.votesFor : null,
  };
}

export function summarizeDiscussion(discussion: unknown) {
  return summarizeDiscussionValue(discussion);
}

export function summarizeDiscussions(discussions: unknown) {
  if (!Array.isArray(discussions)) {
    return {
      count: 0,
      items: [],
      type: typeof discussions,
    };
  }

  const items = discussions.map(summarizeDiscussionValue);

  return {
    count: discussions.length,
    crIds: items.map(item => item.crId).filter(Boolean),
    ids: items.map(item => item.id).filter(Boolean),
    items: items.slice(0, 25),
    missingChangeRequestEntityCount: items.filter(item => item.crId && !item.changeRequestEntityId)
      .length,
    withChangeRequestEntityCount: items.filter(item => item.changeRequestEntityId).length,
  };
}

export function summarizeSelection(selection: unknown) {
  if (!selection) return null;
  if (!isRecord(selection)) return { type: typeof selection };

  const range = selection as SlateRangeLike;
  const anchor = summarizePoint(range.anchor);
  const focus = summarizePoint(range.focus);

  return {
    anchor,
    focus,
    isCollapsed:
      anchor?.offset === focus?.offset &&
      JSON.stringify(anchor?.path) === JSON.stringify(focus?.path),
  };
}

export function summarizeRichTextValue(value: unknown) {
  const stats = collectValueStats(value);
  const rootTypes = Array.isArray(value)
    ? value.map(node => (isRecord(node) && typeof node.type === 'string' ? node.type : 'unknown'))
    : [];

  return {
    ...stats,
    firstRootType: rootTypes[0] ?? null,
    lastRootType: rootTypes.at(-1) ?? null,
    rootTypes: rootTypes.slice(0, 12),
  };
}

export function getActiveElementDebugInfo() {
  if (typeof document === 'undefined' || typeof HTMLElement === 'undefined') return null;

  const element = document.activeElement;
  if (!(element instanceof HTMLElement)) return null;

  return {
    className: typeof element.className === 'string' ? element.className.slice(0, 160) : null,
    dataSlateEditor: element.getAttribute('data-slate-editor'),
    dataSlateNode: element.getAttribute('data-slate-node'),
    id: element.id || null,
    isContentEditable: element.isContentEditable,
    isInSlateEditor: Boolean(element.closest('[data-slate-editor="true"]')),
    role: element.getAttribute('role'),
    tagName: element.tagName.toLowerCase(),
  };
}

function getSlateDomNodeDebugInfo(node: Node | null) {
  if (!node || typeof HTMLElement === 'undefined') return null;

  const element = node instanceof HTMLElement ? node : node.parentElement;
  if (!element) return null;
  const slateNode = element.closest('[data-slate-node]');
  const suggestionNode = element.closest('[data-suggestion-id]');

  return {
    dataSlateLeaf: Boolean(element.closest('[data-slate-leaf="true"]')),
    dataSlateNode: slateNode?.getAttribute('data-slate-node') ?? null,
    suggestionId: suggestionNode?.getAttribute('data-suggestion-id') ?? null,
    suggestionType: suggestionNode?.getAttribute('data-suggestion-type') ?? null,
    textLength: node.textContent?.length ?? null,
  };
}

export function getDomSelectionDebugInfo() {
  if (typeof window === 'undefined') return null;

  const selection = window.getSelection();
  if (!selection) return null;

  return {
    anchorNode: getSlateDomNodeDebugInfo(selection.anchorNode),
    anchorOffset: selection.anchorOffset,
    focusNode: getSlateDomNodeDebugInfo(selection.focusNode),
    focusOffset: selection.focusOffset,
    isCollapsed: selection.isCollapsed,
    rangeCount: selection.rangeCount,
  };
}

export function isActiveElementInSlateEditor() {
  if (typeof document === 'undefined' || typeof HTMLElement === 'undefined') return false;

  const element = document.activeElement;
  return element instanceof HTMLElement && Boolean(element.closest('[data-slate-editor="true"]'));
}
