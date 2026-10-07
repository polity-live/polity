import { z } from 'zod';
import type { StudioDocumentV5 } from '@/features/communication-studio/logic/document-v3';
import { ProjectToolError, type EditorContext } from '@/features/project-chat/logic/contracts';
import { studioGenerateSuggestionToolSchema } from './ai-suggestions';

export const studioProjectGenerationSchema = studioGenerateSuggestionToolSchema.omit({
  projectId: true,
  proposalId: true,
  sourceWorkspaceId: true,
});
export const studioTargetSchema = z.object({
  role: z.enum(['title', 'subtitle', 'body', 'cta']).optional(),
  name: z.string().min(1).max(300).optional(),
  nodeIds: z.array(z.string().uuid()).max(50).default([]),
  frameIds: z.array(z.string().uuid()).max(20).default([]),
});
export const studioEditSuggestionSchema = z.object({
  snapshotId: z.string().uuid(),
  summary: z.string().min(1).max(500),
  edits: z
    .array(studioTargetSchema.extend({ text: z.string().max(10000) }))
    .min(1)
    .max(50),
});

const roles = {
  title: ['titel', 'title', 'headline', 'überschrift'],
  subtitle: [
    'subtitel',
    'subtitle',
    'untertitel',
    'subheadline',
    'body',
    'euren inhalt hier ergänzen.',
    'name und anlass ergänzen',
    'datum · uhrzeit\nort oder teilnahmelink\nanmeldung ergänzen',
  ],
  body: ['body', 'text', 'beschreibung', 'fließtext'],
  cta: ['cta', 'call to action'],
};
export type TextRole = keyof typeof roles;
export function requestedTextRole(instruction: string): TextRole | undefined {
  // Roles are resource semantics, not a parser for the requested replacement text.
  const subject = instruction.split(/["„“'‚‘]/)[0].toLowerCase();
  return (['subtitle', 'title', 'cta', 'body'] as const).find(role =>
    roles[role].some(name => new RegExp(`(?:^|\\s)${name}(?:$|\\s|[.,:])`, 'u').test(subject))
  );
}

export function resolveStudioTargets(
  document: StudioDocumentV5,
  target: z.infer<typeof studioTargetSchema>,
  hints?: EditorContext
) {
  const nodes = new Map(document.nodes.map(node => [node.id, node]));
  const ancestors = (id: string) => {
    const parents: string[] = [];
    let parent = nodes.get(id)?.parentFrameId;
    while (parent && !parents.includes(parent)) {
      parents.push(parent);
      parent = nodes.get(parent)?.parentFrameId;
    }
    return parents;
  };
  for (const id of target.nodeIds)
    if (!nodes.has(id) || nodes.get(id)?.type === 'frame')
      throw new ProjectToolError(
        'invalid_target',
        'Use an element ID from the current Studio snapshot.',
        'read_again'
      );
  for (const id of target.frameIds)
    if (nodes.get(id)?.type !== 'frame')
      throw new ProjectToolError(
        'invalid_target',
        'Use a frame ID, not an element ID.',
        'read_again'
      );
  let frameIds = target.frameIds;
  if (!frameIds.length && hints?.pageId) frameIds = [hints.pageId];
  if (!frameIds.length)
    frameIds = hints?.references?.filter(ref => ref.kind === 'frame').map(ref => ref.id) ?? [];
  let selected = target.nodeIds.length ? target.nodeIds : (hints?.elementIds ?? []);
  if (!frameIds.length && selected.length)
    frameIds = [
      ...new Set(
        selected.flatMap(id => {
          const parent = nodes.get(id)?.parentFrameId;
          return parent ? [parent] : [];
        })
      ),
    ];
  if (target.role || target.name) {
    const normalized = target.name?.trim().toLowerCase();
    const names = target.role ? roles[target.role] : [];
    const matches = document.nodes.filter(
      node =>
        node.type === 'richText' &&
        (!frameIds.length || ancestors(node.id).some(parent => frameIds.includes(parent))) &&
        (normalized
          ? node.name.toLowerCase() === normalized
          : node.textRole
            ? node.textRole === target.role
            : names.includes(node.name.toLowerCase()))
    );
    if (matches.length !== 1)
      throw new ProjectToolError(
        'target_ambiguous',
        matches.length
          ? 'Several text elements match. Ask the user which one to change.'
          : 'No text element matches. Ask the user to choose the element.',
        'ask_user'
      );
    selected = matches.map(node => node.id);
  }
  if (!selected.length) {
    if (frameIds.length)
      selected = document.nodes
        .filter(node => !!node.parentFrameId && frameIds.includes(node.parentFrameId))
        .map(node => node.id);
    else
      throw new ProjectToolError(
        'target_ambiguous',
        'Choose a frame or element to change.',
        'ask_user'
      );
  }
  for (const id of selected) {
    const node = nodes.get(id);
    if (!node || node.type === 'frame')
      throw new ProjectToolError('invalid_target', 'The target no longer exists.', 'read_again');
    if (node.locked || ancestors(node.id).some(parent => nodes.get(parent)?.locked))
      throw new ProjectToolError(
        'target_locked',
        'The target element or frame is locked.',
        'ask_user'
      );
  }
  return {
    nodeIds: selected,
    frameIds: [
      ...new Set(
        selected.flatMap(id => {
          const parent = nodes.get(id)?.parentFrameId;
          return parent ? [parent] : [];
        })
      ),
    ],
  };
}
