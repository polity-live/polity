import { describe, expect, it } from 'vitest';
import { createDocument } from '../templates';
import { legacyDocumentToV3 } from '../v3-adapter';
import {
  createElementSetSnapshot,
  instantiateElementSet,
  trackElementInstanceOverrides,
} from '../element-library';

describe('Studio Elements library', () => {
  it('normalizes a selection and instantiates it with fresh node and group ids', () => {
    const document = legacyDocumentToV3(createDocument('single', 'Elements'));
    const nodes = document.nodes.filter(node => node.type !== 'frame').slice(0, 2);
    const groupId = crypto.randomUUID();
    nodes.forEach(node => (node.groupIds = [groupId]));
    const snapshot = createElementSetSnapshot(
      document,
      nodes.map(node => node.id)
    );
    const created = instantiateElementSet(snapshot, {
      setId: crypto.randomUUID(),
      revisionId: crypto.randomUUID(),
      targetFrameId: document.nodes.find(node => node.type === 'frame')?.id,
      x: 400,
      y: 300,
    });
    expect(created.nodes.map(node => node.id)).not.toEqual(nodes.map(node => node.id));
    expect(created.nodes[0].groupIds[0]).toBe(created.nodes[1].groupIds[0]);
    expect(created.instance.sourceToInstance).toHaveProperty(nodes[0].id);
  });

  it('records local overrides and local deletion tombstones on linked instances', () => {
    const document = legacyDocumentToV3(createDocument('single', 'Elements'));
    const source = document.nodes.find(node => node.type !== 'frame');
    if (!source) throw new Error('node fixture missing');
    const snapshot = createElementSetSnapshot(document, [source.id]);
    const created = instantiateElementSet(snapshot, {
      setId: crypto.randomUUID(),
      revisionId: crypto.randomUUID(),
      x: 0,
      y: 0,
    });
    const before = structuredClone(document);
    before.nodes.push(...created.nodes);
    before.componentInstances.push(created.instance);
    const after = structuredClone(before);
    after.nodes.find(node => node.id === created.nodes[0].id)!.name = 'Local name';
    trackElementInstanceOverrides(before, after);
    expect(after.componentInstances[0].localOverrides[source.id]).toContain('name');
    after.nodes = after.nodes.filter(node => node.id !== created.nodes[0].id);
    trackElementInstanceOverrides(before, after);
    expect(after.componentInstances[0].localDeletions).toContain(source.id);
  });
});
