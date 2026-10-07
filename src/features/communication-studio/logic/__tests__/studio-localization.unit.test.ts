import { afterEach, expect, it } from 'vitest';
import { useLanguageStore } from '@/features/shared/global-state/language.store';
import { translate } from '@/features/shared/hooks/use-translation';
import {
  createFrameNode,
  createStudioDocumentV5,
  framePresetRegistry,
  studioDocumentV5Schema,
} from '../document-v3';
import { canvasElementSchema, canvasSceneSchema } from '../canvas-schema';
import { documentSchema, element, defaultBrand } from '../document';
import { createDocument } from '../templates';
import { createStudioTemplateDocumentV5 } from '../templates-v5';

afterEach(() => {
  useLanguageStore.setState({ language: 'en' });
});

it.each(['en', 'de'] as const)(
  'reads every frame preset label in the current %s language without changing geometry',
  language => {
    useLanguageStore.setState({ language });
    const keys = {
      square: 'squarePost',
      portrait: 'portraitPost',
      story: 'storyReel',
      widescreen: 'widescreen',
      standard: 'presentation',
    };
    for (const [id, key] of Object.entries(keys)) {
      const preset = framePresetRegistry[id as keyof typeof keys];
      expect(preset.label).toBe(translate('features.studio.' + key));
      const frame = createFrameNode(id as keyof typeof keys);
      expect(frame.name).toBe(preset.label);
      expect(frame.transform).toMatchObject({ width: preset.width, height: preset.height });
    }
    expect(framePresetRegistry.square.label).toBe(
      language === 'en' ? 'Square post' : 'Quadratischer Beitrag'
    );
  }
);

it.each(['en', 'de'] as const)(
  'localizes canonical document validation in %s while retaining resource identities',
  language => {
    useLanguageStore.setState({ language });
    const fixture = () => createStudioTemplateDocumentV5('single', 'Validation', defaultBrand);
    const issue = (document: ReturnType<typeof fixture>, key: string, id?: string) => {
      const result = studioDocumentV5Schema.safeParse(document);
      expect(result.success).toBe(false);
      expect(result.error?.issues.map(issue => issue.message)).toContain(
        translate('features.studio.' + key, id ? { id } : undefined)
      );
    };
    let document = fixture();
    document.nodes.push(structuredClone(document.nodes[0]));
    issue(document, 'duplicateStudioNodes');
    document = fixture();
    document.nodes[1].parentFrameId = crypto.randomUUID();
    issue(document, 'unknownParentFrame', document.nodes[1].id);
    document = fixture();
    document.nodes[0].parentFrameId = document.nodes[0].id;
    issue(document, 'circularFrameHierarchy', document.nodes[0].id);
    document = fixture();
    document.deliverables.push(structuredClone(document.deliverables[0]));
    issue(document, 'duplicateDeliverables');
    document = fixture();
    document.deliverables[0].frameIds = [crypto.randomUUID()];
    issue(document, 'unknownDeliverableFrame', document.deliverables[0].id);
    document = fixture();
    document.masterLayout.frameId = crypto.randomUUID();
    issue(document, 'masterRootRequired');
    document = fixture();
    const master = createFrameNode('square');
    document.nodes.push(master);
    document.masterLayout = {
      frameId: master.id,
      placements: { [document.nodes[1].id]: 'foreground' },
    };
    issue(document, 'masterChildRequired');
    document = fixture();
    document.masterLayout.frameId = document.deliverables[0].frameIds[0];
    issue(document, 'masterCannotExport');
  }
);

it.each(['en', 'de'] as const)(
  'localizes duplicate scene and nested document errors in %s',
  language => {
    useLanguageStore.setState({ language });
    const shape = canvasElementSchema.parse({
      id: crypto.randomUUID(),
      type: 'rectangle',
      x: 0,
      y: 0,
      width: 20,
      height: 20,
      angle: 0,
      isDeleted: false,
    });
    const scene = canvasSceneSchema.safeParse({ version: 1, elements: [shape, shape], files: {} });
    expect(scene.error?.issues.map(issue => issue.message)).toContain(
      translate('features.studio.duplicateCanvasElements')
    );
    const document = createDocument('single', 'Nested validation');
    const id = crypto.randomUUID();
    document.pages[0].elements = [
      element('text', {
        richText: [
          { id, type: 'p', children: [{ text: 'First' }] },
          { id, type: 'p', children: [{ text: 'Second' }] },
        ],
      }),
    ];
    expect(documentSchema.safeParse(document).error?.issues.map(issue => issue.message)).toContain(
      translate('features.studio.duplicateNestedIds')
    );
    document.pages[0].elements = [element('rect')];
    document.pages[0].elements[0].type = 'table';
    expect(documentSchema.safeParse(document).error?.issues.map(issue => issue.message)).toContain(
      translate('features.studio.elementDataMissing')
    );
  }
);

it('uses the selected language when a validator and registry were imported before the language changed', () => {
  useLanguageStore.setState({ language: 'en' });
  expect(framePresetRegistry.portrait.label).toBe('Portrait post');
  const document = createStudioDocumentV5('Validation');
  const frame = createFrameNode('square');
  document.nodes = [frame, structuredClone(frame)];
  expect(studioDocumentV5Schema.safeParse(document).error?.issues[0].message).toBe(
    'Duplicate Studio node IDs'
  );
  useLanguageStore.setState({ language: 'de' });
  expect(framePresetRegistry.portrait.label).toBe('Hochformat-Beitrag');
  expect(studioDocumentV5Schema.safeParse(document).error?.issues[0].message).toBe(
    'Doppelte IDs für Studio-Knoten'
  );
});
