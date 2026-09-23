import type { z } from 'zod';
import {
  ProjectToolError,
  type AmendmentAction,
  type richBlockSchema,
  type EditorContext,
} from './contracts';

export interface TextNode {
  text?: string;
  children?: TextNode[];
  [key: string]: unknown;
}
export interface TextAnchor {
  path: number[];
  start: number;
  end: number;
}
export interface TextReferences {
  blocks: Record<string, number>;
  anchors: Record<string, TextAnchor>;
}

function protectedNode(node: TextNode): boolean {
  return (
    Object.keys(node).some(k => /^(comment|suggestion)/.test(k)) ||
    !!node.children?.some(protectedNode)
  );
}
function writable(node: TextNode) {
  if (protectedNode(node))
    throw new ProjectToolError(
      'protected_annotation',
      'The selection contains an existing comment or suggestion.',
      'ask_user'
    );
}
export function textReferences(content: TextNode[], selection?: EditorContext['selection']) {
  const references: TextReferences = { blocks: {}, anchors: {} };
  const blocks: { ref: string; text: string; anchors: { ref: string; text: string }[] }[] = [];
  content.forEach((block, index) => {
    const ref = `block_${index}`;
    references.blocks[ref] = index;
    const anchors: { ref: string; text: string }[] = [];
    const visit = (node: TextNode, path: number[]) => {
      if (typeof node.text === 'string') {
        const anchorRef = `text_${path.join('_')}`;
        references.anchors[anchorRef] = { path, start: 0, end: node.text.length };
        anchors.push({ ref: anchorRef, text: node.text });
      }
      node.children?.forEach((child, i) => visit(child, [...path, i]));
    };
    visit(block, [index]);
    blocks.push({ ref, text: anchors.map(a => a.text).join(''), anchors });
  });
  const selectionAnchors: { ref: string; text: string }[] = [];
  if (selection) {
    const compare = (
      a: { path: number[]; offset: number },
      b: { path: number[]; offset: number }
    ) => {
      for (let i = 0; i < Math.max(a.path.length, b.path.length); i++) {
        if (a.path[i] !== b.path[i]) return (a.path[i] ?? -1) - (b.path[i] ?? -1);
      }
      return a.offset - b.offset;
    };
    const [start, end] =
      compare(selection.anchor, selection.focus) <= 0
        ? [selection.anchor, selection.focus]
        : [selection.focus, selection.anchor];
    for (const [ref, anchor] of Object.entries(references.anchors)) {
      if (
        compare({ path: anchor.path, offset: anchor.end }, start) <= 0 ||
        compare({ path: anchor.path, offset: 0 }, end) >= 0
      )
        continue;
      const sameStart = anchor.path.join('.') === start.path.join('.'),
        sameEnd = anchor.path.join('.') === end.path.join('.');
      const from = sameStart ? start.offset : 0,
        to = sameEnd ? end.offset : anchor.end;
      if (from < 0 || to > anchor.end || from > to) throw new ProjectToolError('invalid_selection');
      const selectedRef = `selection_${selectionAnchors.length}`;
      references.anchors[selectedRef] = { ...anchor, start: from, end: to };
      const text = blocks.flatMap(b => b.anchors).find(a => a.ref === ref)?.text;
      if (text === undefined) throw new ProjectToolError('invalid_selection');
      selectionAnchors.push({ ref: selectedRef, text: text.slice(from, to) });
    }
  }
  return { references, blocks, selectionAnchors };
}
function encodeBlocks(
  blocks: z.infer<typeof richBlockSchema>[],
  createId: () => string
): TextNode[] {
  const children = (items: { text: string; marks?: Record<string, boolean>; href?: string }[]) =>
    items.map(item => {
      const leaf: TextNode = { text: item.text, ...item.marks };
      return item.href ? { type: 'a', url: item.href, children: [leaf] } : leaf;
    });
  return blocks.flatMap((block): TextNode[] => {
    if (block.kind === 'list')
      return block.items.map((item, index) => ({
        id: createId(),
        type: 'p',
        indent: 1,
        listStyleType: block.ordered ? 'decimal' : 'disc',
        ...(block.ordered ? { listStart: index + 1 } : {}),
        children: children(item),
      }));
    if (block.kind === 'table')
      return [
        {
          id: createId(),
          type: 'table',
          children: block.rows.map(row => ({
            type: 'tr',
            children: row.map(cell => ({
              type: 'td',
              children: [{ type: 'p', children: children(cell) }],
            })),
          })),
        },
      ];
    return [
      {
        id: createId(),
        type:
          block.kind === 'heading'
            ? `h${block.level}`
            : block.kind === 'quote'
              ? 'blockquote'
              : 'p',
        children: children(block.content),
      },
    ];
  });
}

/** References are snapshot-local. Keep node identities while applying a batch so
 * inserting/removing an earlier block cannot retarget a later action. */
export function applyTextActions(
  input: TextNode[],
  actions: AmendmentAction[],
  references: TextReferences,
  createId = () => crypto.randomUUID()
) {
  const value = structuredClone(input);
  const original = [...value];
  const metadata: Record<string, unknown> = {};
  const touchedAnchors = new Set<TextNode>();
  const anchorNodes = new Map<string, { root: TextNode; parent: TextNode; leaf: TextNode }>();
  for (const [ref, anchor] of Object.entries(references.anchors)) {
    const root = original[anchor.path[0]];
    let parent = root;
    for (const index of anchor.path.slice(1, -1)) parent = parent?.children?.[index] as TextNode;
    const leaf = parent?.children?.[anchor.path[anchor.path.length - 1]];
    if (root && parent && leaf) anchorNodes.set(ref, { root, parent, leaf });
  }
  const blockFor = (ref: string) => {
    const index = references.blocks[ref];
    const node = original[index];
    if (!node || !value.includes(node)) throw new ProjectToolError('invalid_reference');
    writable(node);
    return node;
  };
  for (const action of actions) {
    if (action.type === 'metadata.patch') {
      Object.assign(metadata, action.patch);
      continue;
    }
    if (action.type === 'blocks.append') {
      value.push(...encodeBlocks(action.blocks, createId));
      continue;
    }
    if (action.type === 'blocks.insert') {
      const node = blockFor(action.anchorBlockRef);
      value.splice(
        value.indexOf(node) + (action.position === 'after' ? 1 : 0),
        0,
        ...encodeBlocks(action.blocks, createId)
      );
      continue;
    }
    if (action.type === 'blocks.remove' || action.type === 'blocks.replace') {
      const nodes = action.blockRefs.map(blockFor);
      const indexes = nodes.map(n => value.indexOf(n));
      if (
        new Set(indexes).size !== indexes.length ||
        indexes.some((n, i) => i > 0 && n !== indexes[i - 1] + 1)
      )
        throw new ProjectToolError('noncontiguous_blocks');
      value.splice(
        indexes[0],
        indexes.length,
        ...(action.type === 'blocks.replace' ? encodeBlocks(action.blocks, createId) : [])
      );
      continue;
    }
    const anchor = references.anchors[action.anchorRef],
      nodes = anchorNodes.get(action.anchorRef);
    if (!anchor || !nodes || touchedAnchors.has(nodes.leaf))
      throw new ProjectToolError('invalid_reference');
    const { root, parent, leaf } = nodes;
    if (!value.includes(root)) throw new ProjectToolError('invalid_reference');
    writable(root);
    const index = parent.children?.indexOf(leaf) ?? -1;
    if (
      index < 0 ||
      typeof leaf.text !== 'string' ||
      anchor.start < 0 ||
      anchor.start > anchor.end ||
      anchor.end > leaf.text.length
    )
      throw new ProjectToolError('invalid_reference');
    const before = leaf.text.slice(0, anchor.start),
      after = leaf.text.slice(anchor.end);
    const middle =
      action.type === 'text.replace'
        ? { ...leaf, text: action.text }
        : { ...leaf, text: leaf.text.slice(anchor.start, anchor.end), ...action.marks };
    touchedAnchors.add(leaf);
    if (!parent.children) throw new ProjectToolError('invalid_reference');
    parent.children.splice(
      index,
      1,
      ...(before ? [{ ...leaf, text: before }] : []),
      middle,
      ...(after ? [{ ...leaf, text: after }] : [])
    );
  }
  if (!value.length) value.push({ id: createId(), type: 'p', children: [{ text: '' }] });
  return { value, metadata };
}

/** Native Plate suggestions, resolvable by the existing governance workflow. */
export function suggestTextChanges(before: TextNode[], after: TextNode[], discussionId: string) {
  let prefix = 0,
    suffix = 0;
  while (
    prefix < Math.min(before.length, after.length) &&
    JSON.stringify(before[prefix]) === JSON.stringify(after[prefix])
  )
    prefix++;
  while (
    suffix < Math.min(before.length, after.length) - prefix &&
    JSON.stringify(before[before.length - 1 - suffix]) ===
      JSON.stringify(after[after.length - 1 - suffix])
  )
    suffix++;
  const removed = before.slice(prefix, before.length - suffix);
  removed.forEach(writable);
  return [
    ...before.slice(0, prefix),
    ...removed.map(n => ({ ...n, suggestion: { id: discussionId, type: 'remove' } })),
    ...after
      .slice(prefix, after.length - suffix)
      .map(n => ({ ...n, suggestion: { id: discussionId, type: 'insert' } })),
    ...before.slice(before.length - suffix),
  ];
}
