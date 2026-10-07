import { describe, expect, it } from 'vitest';
import { compileStudioAiPlan, studioAiPlanSchema } from '../ai-design';
import { createStudioDocumentV5, shapeNodeSchema, studioDocumentV5Schema } from '../document-v3';

const empty = () => createStudioDocumentV5('Draft', 'presentation');

describe('Studio AI design compiler', () => {
  it('creates ordered editable presentation frames and native text nodes', () => {
    const plan = studioAiPlanSchema.parse({
      title: 'Nachbarschaftstreffen',
      frames: Array.from({ length: 3 }, (_, index) => ({
        eyebrow: 'Einladung',
        headline: `Folie ${index + 1}`,
        body: 'Gemeinsam Ideen sammeln',
        cta: 'Mitmachen',
        variant: 'invitation',
      })),
    });
    const result = compileStudioAiPlan({
      document: empty(),
      plan,
      mode: 'template',
      format: 'widescreen',
      kind: 'presentation',
      allowedNodeIds: new Set(),
      assetIds: new Set(),
    });
    expect(studioDocumentV5Schema.safeParse(result).success).toBe(true);
    expect(result.deliverables[0].frameIds).toHaveLength(3);
    expect(result.nodes.filter(node => node.type === 'richText')).toHaveLength(12);
    expect(
      result.nodes
        .filter(node => node.type === 'frame')
        .every(frame => frame.transform.width === 1920)
    ).toBe(true);
    expect(result.nodes.filter(node => node.type === 'richText').every(node => !node.locked)).toBe(
      true
    );
  });

  it('converts free layout elements and an authorized library set into native nodes', () => {
    const setId = crypto.randomUUID();
    const assetId = crypto.randomUUID();
    const libraryNode = shapeNodeSchema.parse({
      id: crypto.randomUUID(),
      type: 'shape',
      shape: 'ellipse',
      name: 'Badge',
      parentFrameId: null,
      transform: { x: 0, y: 0, width: 80, height: 80 },
      zIndex: 0,
      style: { fill: '#ff0000', stroke: null, strokeWidth: 0, opacity: 1 },
    });
    expect(() =>
      studioAiPlanSchema.parse({
        title: 'Invalid',
        frames: [
          { elements: [{ kind: 'arrow', box: { x: 0.2, y: 0.4, width: 0.3, height: 0.1 } }] },
        ],
      })
    ).toThrow();
    const plan = studioAiPlanSchema.parse({
      title: 'Post',
      frames: [
        {
          elements: [
            {
              kind: 'text',
              text: 'Willkommen',
              box: { x: 0.08, y: 0.1, width: 0.7, height: 0.18 },
              size: 64,
            },
            { kind: 'shape', shape: 'arrow', box: { x: 0.2, y: 0.4, width: 0.3, height: 0.1 } },
            { kind: 'media', assetId, box: { x: 0.55, y: 0.4, width: 0.3, height: 0.3 } },
            { kind: 'library', setId, box: { x: 0.08, y: 0.72, width: 0.15, height: 0.15 } },
          ],
        },
      ],
    });
    const result = compileStudioAiPlan({
      document: createStudioDocumentV5('Draft', 'single'),
      plan,
      mode: 'free',
      format: 'square',
      kind: 'single',
      allowedNodeIds: new Set(),
      assetIds: new Set([assetId]),
      libraries: new Map([
        [
          setId,
          {
            revisionId: crypto.randomUUID(),
            snapshot: { nodes: [libraryNode], width: 80, height: 80, assets: [] },
            assetIds: {},
          },
        ],
      ]),
    });
    expect(result.componentInstances).toHaveLength(1);
    expect(result.nodes.some(node => node.type === 'media' && node.assetId === assetId)).toBe(true);
    expect(result.nodes.some(node => node.type === 'shape' && node.shape === 'arrow')).toBe(true);
    expect(studioDocumentV5Schema.safeParse(result).success).toBe(true);
  });

  it('rejects edits to locked nodes and overflowing text', () => {
    const initial = compileStudioAiPlan({
      document: createStudioDocumentV5('Draft', 'single'),
      plan: studioAiPlanSchema.parse({
        title: 'Post',
        frames: [{ headline: 'Titel', body: 'Text' }],
      }),
      mode: 'template',
      format: 'portrait',
      kind: 'single',
      allowedNodeIds: new Set(),
      assetIds: new Set(),
    });
    const title = initial.nodes.find(node => node.type === 'richText' && node.name === 'Headline');
    expect(title).toBeDefined();
    const locked = structuredClone(initial);
    const lockedTitle = locked.nodes.find(node => node.id === title!.id)!;
    lockedTitle.locked = true;
    const edit = studioAiPlanSchema.parse({
      title: 'Post',
      edits: [{ nodeId: title!.id, text: 'Anderer Titel' }],
    });
    expect(() =>
      compileStudioAiPlan({
        document: locked,
        plan: edit,
        mode: 'template',
        format: 'portrait',
        kind: 'single',
        allowedNodeIds: new Set([title!.id]),
        assetIds: new Set(),
      })
    ).toThrow('locked');
    expect(() =>
      compileStudioAiPlan({
        document: initial,
        plan: studioAiPlanSchema.parse({
          title: 'Post',
          edits: [{ nodeId: title!.id, text: 'Eine Zeile\n'.repeat(40) }],
        }),
        mode: 'template',
        format: 'portrait',
        kind: 'single',
        allowedNodeIds: new Set([title!.id]),
        assetIds: new Set(),
      })
    ).toThrow('too long');
  });

  it('limits follow-up additions, recoloring and removal to the selected frame', () => {
    const initial = compileStudioAiPlan({
      document: createStudioDocumentV5('Draft', 'single'),
      plan: studioAiPlanSchema.parse({
        title: 'Post',
        frames: [{ headline: 'Titel', body: 'Alt' }],
      }),
      mode: 'template',
      format: 'portrait',
      kind: 'single',
      allowedNodeIds: new Set(),
      assetIds: new Set(),
    });
    const frameId = initial.deliverables[0].frameIds[0];
    const headline = initial.nodes.find(
      node => node.type === 'richText' && node.name === 'Headline'
    )!;
    const body = initial.nodes.find(node => node.type === 'richText' && node.name === 'Body')!;
    const plan = studioAiPlanSchema.parse({
      title: 'Post',
      edits: [{ nodeId: headline.id, color: 'accent' }],
      additions: [
        {
          frameId,
          element: {
            kind: 'shape',
            shape: 'arrow',
            box: { x: 0.1, y: 0.7, width: 0.3, height: 0.1 },
          },
        },
      ],
      deletions: [body.id],
    });
    const changed = compileStudioAiPlan({
      document: initial,
      plan,
      mode: 'template',
      format: 'portrait',
      kind: 'single',
      allowedNodeIds: new Set([headline.id, body.id]),
      allowedFrameIds: new Set([frameId]),
      assetIds: new Set(),
    });
    expect(changed.nodes.some(node => node.id === body.id)).toBe(false);
    expect(changed.nodes.find(node => node.id === headline.id)?.style.fillBinding).toBe(
      'accentForeground'
    );
    expect(changed.nodes.some(node => node.type === 'shape' && node.shape === 'arrow')).toBe(true);
    expect(() =>
      compileStudioAiPlan({
        document: initial,
        plan,
        mode: 'template',
        format: 'portrait',
        kind: 'single',
        allowedNodeIds: new Set([headline.id]),
        assetIds: new Set(),
      })
    ).toThrow('unselected');
  });
});
