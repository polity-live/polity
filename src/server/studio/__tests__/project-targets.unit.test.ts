import { describe, expect, it } from 'vitest';
import {
  createStudioDocumentV5,
  createFrameNode,
} from '@/features/communication-studio/logic/document-v3';
import {
  compileStudioAiPlan,
  studioAiPlanSchema,
} from '@/features/communication-studio/logic/ai-design';
import { applyStudioTextEdits } from '../ai-suggestions';
import {
  resolveStudioTargets,
  requestedTextRole,
  studioTargetSchema,
  studioProjectGenerationSchema,
} from '../project-targets';

function fixture() {
  const document = compileStudioAiPlan({
    document: createStudioDocumentV5('t2', 'single'),
    plan: studioAiPlanSchema.parse({
      title: 't2',
      frames: [{ headline: 't2', body: 'Euren Inhalt hier ergänzen.' }],
    }),
    mode: 'template',
    format: 'portrait',
    kind: 'single',
    allowedNodeIds: new Set(),
    assetIds: new Set(),
  });
  const title = document.nodes.find(node => node.name === 'Headline')!;
  title.name = 'Titel';
  const subtitle = document.nodes.find(node => node.name === 'Body')!;
  subtitle.name = 'Subtitel';
  const frame = document.nodes.find(node => node.type === 'frame')!;
  return { document, title, subtitle, frame };
}
describe('Studio project target resolution', () => {
  it.each([
    ['Change the title to "subtitle"', 'title'],
    ['Update CTA: now', 'cta'],
    ['Ändere den Fließtext.', 'body'],
    ['Replace arbitrary copy with „headline“', undefined],
  ])(
    'recognizes the resource role in %s without parsing quoted replacement copy',
    (instruction, expected) => {
      expect(requestedTextRole(instruction)).toBe(expected);
    }
  );
  it('selects explicit nodes, frame contents and frame references from the current snapshot', () => {
    const { document, title, subtitle, frame } = fixture();
    const explicit = resolveStudioTargets(
      document,
      studioTargetSchema.parse({ nodeIds: [title.id] })
    );
    expect(explicit).toEqual({ nodeIds: [title.id], frameIds: [frame.id] });
    const contents = document.nodes
      .filter(node => node.parentFrameId === frame.id)
      .map(node => node.id);
    expect(
      resolveStudioTargets(document, studioTargetSchema.parse({ frameIds: [frame.id] })).nodeIds
    ).toEqual(contents);
    expect(
      resolveStudioTargets(document, studioTargetSchema.parse({}), {
        surface: 'studio',
        references: [{ id: frame.id, kind: 'frame', label: 'Main', origin: 'automatic' }],
      }).nodeIds
    ).toEqual(contents);
    expect(
      resolveStudioTargets(document, studioTargetSchema.parse({}), {
        surface: 'studio',
        elementIds: [subtitle.id],
      })
    ).toEqual({ nodeIds: [subtitle.id], frameIds: [frame.id] });
  });
  it('matches normalized names without a role or frame and ignores a mismatched frame', () => {
    const { document, title, frame } = fixture();
    expect(
      resolveStudioTargets(document, studioTargetSchema.parse({ name: ' TITEL ' })).nodeIds
    ).toEqual([title.id]);
    const other = createFrameNode('square');
    document.nodes.push(other);
    expect(() =>
      resolveStudioTargets(
        document,
        studioTargetSchema.parse({ name: 'Titel', frameIds: [other.id] })
      )
    ).toThrow('No text element');
    expect(() =>
      resolveStudioTargets(
        document,
        studioTargetSchema.parse({ role: 'cta', frameIds: [frame.id] })
      )
    ).toThrow('No text element');
  });
  it('rejects missing frame IDs, frame-as-element targets and stale editor selection', () => {
    const { document, title, frame } = fixture();
    expect(() =>
      resolveStudioTargets(document, studioTargetSchema.parse({ frameIds: [crypto.randomUUID()] }))
    ).toThrow('frame ID');
    expect(() =>
      resolveStudioTargets(document, studioTargetSchema.parse({ nodeIds: [frame.id] }))
    ).toThrow('element ID');
    for (const elementId of [crypto.randomUUID(), frame.id]) {
      expect(() =>
        resolveStudioTargets(document, studioTargetSchema.parse({}), {
          surface: 'studio',
          elementIds: [elementId],
        })
      ).toThrow('no longer exists');
    }
    title.locked = true;
    expect(() =>
      resolveStudioTargets(document, studioTargetSchema.parse({ nodeIds: [title.id] }))
    ).toThrow('locked');
    expect(() => resolveStudioTargets(document, studioTargetSchema.parse({}))).toThrow(
      'Choose a frame'
    );
    expect(() =>
      resolveStudioTargets(document, studioTargetSchema.parse({}), {
        surface: 'studio',
        references: [],
      })
    ).toThrow('Choose a frame');
  });
  it('resolves nested text through its frame ancestors and terminates stale or cyclic parent references', () => {
    const { document, title, frame } = fixture();
    const nested = createFrameNode('square', { parentFrameId: frame.id });
    document.nodes.push(nested);
    title.parentFrameId = nested.id;
    expect(
      resolveStudioTargets(
        document,
        studioTargetSchema.parse({ role: 'title', frameIds: [frame.id] })
      ).nodeIds
    ).toEqual([title.id]);
    nested.locked = true;
    expect(() =>
      resolveStudioTargets(document, studioTargetSchema.parse({ nodeIds: [title.id] }))
    ).toThrow('locked');
    nested.locked = false;
    frame.parentFrameId = nested.id;
    expect(
      resolveStudioTargets(document, studioTargetSchema.parse({ nodeIds: [title.id] })).nodeIds
    ).toEqual([title.id]);
    title.parentFrameId = crypto.randomUUID();
    expect(
      resolveStudioTargets(document, studioTargetSchema.parse({ nodeIds: [title.id] })).nodeIds
    ).toEqual([title.id]);
    title.parentFrameId = null;
    expect(
      resolveStudioTargets(document, studioTargetSchema.parse({ nodeIds: [title.id] }))
    ).toEqual({ nodeIds: [title.id], frameIds: [] });
  });
  it('resolves the requested subtitle ahead of a selected title', () => {
    const { document, title, subtitle, frame } = fixture();
    const role = requestedTextRole('Ändere den subtitle des frames in "test"');
    expect(role).toBe('subtitle');
    expect(
      resolveStudioTargets(document, studioTargetSchema.parse({ role }), {
        surface: 'studio',
        pageId: frame.id,
        elementIds: [title.id],
      }).nodeIds
    ).toEqual([subtitle.id]);
    const edited = applyStudioTextEdits(document, [{ nodeId: subtitle.id, text: 'test' }]);
    const next = edited.nodes.find(node => node.id === subtitle.id)!;
    expect(next.type).toBe('richText');
    if (next.type !== 'richText' || subtitle.type !== 'richText') throw new Error('Expected text');
    expect(next.content[0].children[0]).toMatchObject({ text: 'test' });
    expect({ ...next, content: subtitle.content }).toEqual(subtitle);
    expect(edited.nodes.filter(node => node.id !== subtitle.id)).toEqual(
      document.nodes.filter(node => node.id !== subtitle.id)
    );
    expect(document.nodes).toContainEqual(subtitle);
  });
  it('retains semantic roles when element names contain the actual text', () => {
    const { document, subtitle, frame } = fixture();
    subtitle.name = 'A completely different subtitle';
    expect(
      resolveStudioTargets(document, studioTargetSchema.parse({ role: 'subtitle' }), {
        surface: 'studio',
        pageId: frame.id,
      }).nodeIds
    ).toEqual([subtitle.id]);
    if (subtitle.type !== 'richText') throw new Error('Expected text');
    delete subtitle.textRole;
    subtitle.name = 'Euren Inhalt hier ergänzen.';
    expect(
      resolveStudioTargets(document, studioTargetSchema.parse({ role: 'subtitle' }), {
        surface: 'studio',
        pageId: frame.id,
      }).nodeIds
    ).toEqual([subtitle.id]);
    const body = structuredClone(subtitle);
    body.id = crypto.randomUUID();
    body.name = 'Body';
    body.textRole = 'body';
    document.nodes.push(body);
    expect(
      resolveStudioTargets(document, studioTargetSchema.parse({ role: 'subtitle' }), {
        surface: 'studio',
        pageId: frame.id,
      }).nodeIds
    ).toEqual([subtitle.id]);
  });
  it('does not expose model-controlled workspace identifiers', () => {
    const args = studioProjectGenerationSchema.parse({
      action: 'edit',
      sourceWorkspaceId: '00000000-0000-0000-0000-000000000000',
      projectId: crypto.randomUUID(),
      proposalId: crypto.randomUUID(),
    });
    expect(args).not.toHaveProperty('sourceWorkspaceId');
    expect(args).not.toHaveProperty('projectId');
    expect(args).not.toHaveProperty('proposalId');
  });
  it('asks about ambiguous roles and rejects wrong kinds, missing and locked targets', () => {
    const { document, subtitle, title, frame } = fixture();
    expect(() =>
      resolveStudioTargets(document, studioTargetSchema.parse({ frameIds: [title.id] }))
    ).toThrow('frame ID');
    expect(() =>
      resolveStudioTargets(document, studioTargetSchema.parse({ nodeIds: [crypto.randomUUID()] }))
    ).toThrow('element ID');
    document.nodes.push({ ...structuredClone(subtitle), id: crypto.randomUUID() });
    expect(() =>
      resolveStudioTargets(document, studioTargetSchema.parse({ role: 'subtitle' }), {
        surface: 'studio',
        pageId: frame.id,
      })
    ).toThrow('Several');
    frame.locked = true;
    expect(() =>
      resolveStudioTargets(document, studioTargetSchema.parse({ nodeIds: [title.id] }))
    ).toThrow('locked');
  });
});
