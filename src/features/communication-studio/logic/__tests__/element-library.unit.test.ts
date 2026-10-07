import { describe, expect, it } from 'vitest';
import { createDocument } from '../templates';
import { element } from '../document';
import { createStudioNodeFromElement } from '../create-studio-node';
import {
  createFrameNode,
  createStudioDocumentV3,
  shapeNodeSchema,
  type StudioNode,
} from '../document-v3';
import { legacyDocumentToV3 } from '../v3-adapter';
import {
  createElementSetSnapshot,
  instantiateElementSet,
  trackElementInstanceOverrides,
  mergeElementSetRevision,
} from '../element-library';

function shape(parentFrameId: string | null = null) {
  return shapeNodeSchema.parse({
    ...createFrameNode('custom'),
    type: 'shape',
    shape: 'rectangle',
    parentFrameId,
    transform: { x: 10, y: 20, width: 40, height: 30 },
  });
}

function linked(nodes: StudioNode[]) {
  const previous = { nodes, width: 300, height: 200, assets: [] };
  const document = createStudioDocumentV3('Linked');
  const root = createFrameNode('square');
  document.nodes.push(root);
  const created = instantiateElementSet(previous, {
    setId: crypto.randomUUID(),
    revisionId: crypto.randomUUID(),
    targetFrameId: root.id,
    x: 500,
    y: 400,
  });
  document.nodes.push(...created.nodes);
  document.componentInstances.push(created.instance);
  return { document, previous, created, root, instance: document.componentInstances[0] };
}

it('retains child local coordinates when saving and inserting a nested frame selection', () => {
  const document = createStudioDocumentV3('Nested');
  const root = createFrameNode('square');
  const frame = createFrameNode('custom');
  frame.parentFrameId = root.id;
  frame.transform = { ...frame.transform, x: 100, y: 200, width: 300, height: 200 };
  const child = shape(frame.id);
  document.nodes.push(child, frame, root);
  const snapshot = createElementSetSnapshot(document, [frame.id]);
  expect(snapshot.nodes.find(node => node.id === child.id)!.transform).toEqual(child.transform);
  expect(snapshot.nodes.find(node => node.id === frame.id)!.transform).toMatchObject({
    x: 0,
    y: 0,
  });
  expect([snapshot.width, snapshot.height]).toEqual([300, 200]);
  const created = instantiateElementSet(snapshot, {
    setId: crypto.randomUUID(),
    revisionId: crypto.randomUUID(),
    targetFrameId: root.id,
    x: 700,
    y: 600,
  });
  expect(created.nodes.find(node => node.componentRef === child.id)!.transform).toEqual(
    child.transform
  );
  expect(created.nodes.find(node => node.componentRef === frame.id)!.transform).toMatchObject({
    x: 700,
    y: 600,
  });
});

it('keeps instance frame, group and binding references when the linked source revision changes', () => {
  const frame = createFrameNode('custom');
  const child = shape(frame.id);
  const group = crypto.randomUUID();
  child.groupIds = [group];
  const arrow = shape(frame.id);
  arrow.startBindingId = child.id;
  arrow.endBindingId = frame.id;
  const { document, instance, previous, created } = linked([frame, child, arrow]);
  const expectedGroupIds = [
    ...created.nodes.find(node => node.componentRef === child.id)!.groupIds,
  ];
  const next = structuredClone(previous);
  next.nodes.find(node => node.id === child.id)!.name = 'Upstream name';
  mergeElementSetRevision(document, instance.id, previous, next, crypto.randomUUID());
  const copiedChild = document.nodes.find(node => node.id === instance.sourceToInstance[child.id])!;
  expect(copiedChild.parentFrameId).toBe(instance.sourceToInstance[frame.id]);
  expect(copiedChild.groupIds).toEqual(expectedGroupIds);
  expect(copiedChild.groupIds).not.toContain(group);
  expect(copiedChild.name).toBe('Upstream name');
  expect(
    document.nodes.find(node => node.id === instance.sourceToInstance[arrow.id])
  ).toMatchObject({
    startBindingId: copiedChild.id,
    endBindingId: instance.sourceToInstance[frame.id],
  });
});

describe('Studio Elements library', () => {
  it('rejects empty, missing, root, master and deliverable frame selections', () => {
    const document = legacyDocumentToV3(createDocument('single', 'Elements'));
    expect(() => createElementSetSnapshot(document, [])).toThrow('Select one or more elements');
    expect(() => createElementSetSnapshot(document, [crypto.randomUUID()])).toThrow();
    for (const frame of document.nodes.filter(node => node.type === 'frame'))
      expect(() => createElementSetSnapshot(document, [frame.id])).toThrow();
    const root = document.nodes.find(node => node.type === 'frame')!;
    const master = createFrameNode('square');
    master.parentFrameId = root.id;
    document.masterLayout.frameId = master.id;
    const deliverable = createFrameNode('square');
    deliverable.parentFrameId = root.id;
    document.deliverables[0].frameIds.push(deliverable.id);
    document.nodes.push(master, deliverable);
    expect(() => createElementSetSnapshot(document, [master.id])).toThrow();
    expect(() => createElementSetSnapshot(document, [deliverable.id])).toThrow();
  });

  it('includes only referenced media and chart assets, leaving unrelated assets and inputs untouched', () => {
    const document = createStudioDocumentV3('Assets');
    const media = createStudioNodeFromElement(
      element('image', { assetId: crypto.randomUUID() }),
      crypto.randomUUID(),
      0
    );
    const chart = createStudioNodeFromElement(element('chart'), crypto.randomUUID(), 1);
    if (media.type !== 'media' || chart.type !== 'chart') throw Error('Fixture type');
    chart.sourceAssetId = crypto.randomUUID();
    const noSource = createStudioNodeFromElement(element('chart'), crypto.randomUUID(), 2);
    document.nodes.push(media, chart, noSource);
    const before = structuredClone(document);
    const assets = [
      { id: media.assetId, name: 'Photo', mime: 'image/png' },
      { id: chart.sourceAssetId, name: 'Data', mime: 'image/webp' },
      { id: crypto.randomUUID(), name: 'Unused', mime: 'unsupported' },
    ];
    const snapshot = createElementSetSnapshot(
      document,
      document.nodes.map(node => node.id),
      assets
    );
    expect(snapshot.assets).toEqual(
      assets
        .slice(0, 2)
        .map(asset => ({ sourceAssetId: asset.id, name: asset.name, mime: asset.mime }))
    );
    expect(document).toEqual(before);
    const mappedMedia = crypto.randomUUID(),
      mappedChart = crypto.randomUUID();
    const created = instantiateElementSet(snapshot, {
      setId: crypto.randomUUID(),
      revisionId: crypto.randomUUID(),
      x: 0,
      y: 0,
      zIndex: 7,
      assetIds: { [media.assetId]: mappedMedia, [chart.sourceAssetId]: mappedChart },
    });
    expect(created.nodes[0]).toMatchObject({ assetId: mappedMedia, zIndex: 7 });
    expect(created.nodes[1]).toMatchObject({ sourceAssetId: mappedChart, zIndex: 8 });
    expect(created.nodes[2]).toMatchObject({ sourceAssetId: null });
    const unchanged = instantiateElementSet(snapshot, {
      setId: crypto.randomUUID(),
      revisionId: crypto.randomUUID(),
      x: 0,
      y: 0,
    });
    expect(unchanged.nodes[0]).toMatchObject({ assetId: media.assetId });
    expect(unchanged.nodes[1]).toMatchObject({ sourceAssetId: chart.sourceAssetId });
    expect(() =>
      createElementSetSnapshot(document, [media.id], [{ ...assets[0], mime: 'unsupported' }])
    ).toThrow();
  });

  it('remaps internal bindings and discards dangling bindings on insertion', () => {
    const first = shape(),
      second = shape(),
      dangling = shape();
    first.startBindingId = second.id;
    first.endBindingId = crypto.randomUUID();
    dangling.startBindingId = crypto.randomUUID();
    dangling.endBindingId = second.id;
    first.parentFrameId = crypto.randomUUID();
    const { created, root } = linked([first, second, dangling]);
    expect(created.nodes[0]).toMatchObject({
      parentFrameId: root.id,
      startBindingId: created.nodes[1].id,
      endBindingId: null,
    });
    expect(created.nodes[2]).toMatchObject({
      startBindingId: null,
      endBindingId: created.nodes[1].id,
    });
  });

  it('ignores missing instances and inserts upstream additions when every old instance node is gone', () => {
    const source = shape();
    const { document, previous, instance } = linked([source]);
    const initial = structuredClone(document);
    mergeElementSetRevision(document, crypto.randomUUID(), previous, previous, crypto.randomUUID());
    expect(document).toEqual(initial);
    document.nodes = document.nodes.filter(
      node => node.id !== instance.sourceToInstance[source.id]
    );
    const addition = shape();
    const next = { ...previous, nodes: [source, addition] };
    const revision = crypto.randomUUID();
    mergeElementSetRevision(document, instance.id, previous, next, revision);
    expect(instance.localDeletions).toEqual([source.id]);
    expect(document.nodes.find(node => node.componentRef === addition.id)).toMatchObject({
      parentFrameId: null,
      transform: addition.transform,
    });
    mergeElementSetRevision(document, instance.id, previous, next, revision);
    expect(instance.localDeletions).toEqual([source.id]);
    expect(document.nodes.filter(node => node.componentRef === addition.id)).toHaveLength(1);
  });

  it('detaches locally overridden upstream deletions and removes unchanged upstream deletions', () => {
    const first = shape(),
      second = shape(),
      third = shape();
    const { document, previous, instance } = linked([first, second, third]);
    const copiedFirst = document.nodes.find(
      node => node.id === instance.sourceToInstance[first.id]
    )!;
    copiedFirst.name = 'Keep local';
    instance.localOverrides[first.id] = ['name'];
    const secondId = instance.sourceToInstance[second.id];
    const revision = crypto.randomUUID();
    mergeElementSetRevision(
      document,
      instance.id,
      previous,
      { ...previous, nodes: [third] },
      revision
    );
    expect(document.nodes.find(node => node.id === copiedFirst.id)).toMatchObject({
      name: 'Keep local',
      componentRef: null,
    });
    expect(document.nodes.some(node => node.id === secondId)).toBe(false);
    expect(instance.detachedNodes).toEqual([copiedFirst.id]);
    expect(instance.sourceToInstance).not.toHaveProperty(first.id);
    expect(instance.sourceToInstance).not.toHaveProperty(second.id);
    expect(instance.revisionId).toBe(revision);
  });

  it('preserves implicit and recorded local overrides while applying untouched upstream fields', () => {
    const source = createStudioNodeFromElement(
      element('text', { text: 'Source' }),
      crypto.randomUUID(),
      0
    );
    const { document, previous, instance } = linked([source]);
    const local = document.nodes.find(node => node.id === instance.sourceToInstance[source.id])!;
    if (local.type !== 'richText') throw Error('Text fixture');
    local.content[0].children[0] = { id: crypto.randomUUID(), text: 'Local text' };
    local.name = 'Local name';
    instance.localOverrides[source.id] = ['content'];
    const next = structuredClone(previous);
    next.nodes[0].name = 'Upstream name';
    next.nodes[0].style.fill = '#112233';
    mergeElementSetRevision(document, instance.id, previous, next, crypto.randomUUID());
    expect(local.name).toBe('Local name');
    expect(local.content[0].children[0]).toMatchObject({ text: 'Local text' });
    expect(local.style.fill).toBe('#112233');
    expect(local.transform).toMatchObject({
      x: source.transform.x + 500,
      y: source.transform.y + 400,
    });
  });

  it('remaps new children and arrows against both existing and newly added instance nodes', () => {
    const frame = createFrameNode('custom');
    const oldChild = shape(frame.id);
    const { document, previous, instance } = linked([oldChild, frame]);
    const newFrame = createFrameNode('custom');
    newFrame.parentFrameId = frame.id;
    const newChild = shape(newFrame.id);
    const arrow = shape(frame.id);
    arrow.startBindingId = oldChild.id;
    arrow.endBindingId = newChild.id;
    const next = { ...previous, nodes: [oldChild, frame, newChild, arrow, newFrame] };
    mergeElementSetRevision(document, instance.id, previous, next, crypto.randomUUID());
    expect(
      document.nodes.find(node => node.id === instance.sourceToInstance[newChild.id])
    ).toMatchObject({
      parentFrameId: instance.sourceToInstance[newFrame.id],
      transform: newChild.transform,
    });
    expect(
      document.nodes.find(node => node.id === instance.sourceToInstance[newFrame.id])
    ).toMatchObject({
      parentFrameId: instance.sourceToInstance[frame.id],
      transform: newFrame.transform,
    });
    expect(
      document.nodes.find(node => node.id === instance.sourceToInstance[arrow.id])
    ).toMatchObject({
      parentFrameId: instance.sourceToInstance[frame.id],
      startBindingId: instance.sourceToInstance[oldChild.id],
      endBindingId: instance.sourceToInstance[newChild.id],
    });
  });

  it('reconciles a source absent from the older snapshot without inventing a prior override', () => {
    const first = shape(),
      second = shape();
    first.groupIds = [crypto.randomUUID()];
    second.groupIds = [crypto.randomUUID()];
    const { document, previous, instance } = linked([first, second]);
    const local = document.nodes.find(node => node.id === instance.sourceToInstance[first.id])!;
    local.groupIds = [];
    const localSecond = document.nodes.find(
      node => node.id === instance.sourceToInstance[second.id]
    )!;
    localSecond.groupIds = [];
    const next = structuredClone(previous);
    next.nodes[0].name = 'Recovered source';
    mergeElementSetRevision(
      document,
      instance.id,
      { ...previous, nodes: [second] },
      next,
      crypto.randomUUID()
    );
    expect(local.name).toBe('Recovered source');
    expect(localSecond.groupIds).toEqual([]);
    expect(instance.revisionId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('rejects duplicate source identities before creating an ambiguous linked instance', () => {
    const source = shape();
    expect(() =>
      instantiateElementSet(
        { nodes: [source, structuredClone(source)], width: 100, height: 100, assets: [] },
        { setId: crypto.randomUUID(), revisionId: crypto.randomUUID(), x: 0, y: 0 }
      )
    ).toThrow('Element set node identities must be unique');
  });

  it.each(['image', 'chart'] as const)(
    'retains a copied %s asset identity across linked revisions',
    kind => {
      const source = createStudioNodeFromElement(
        element(kind, kind === 'image' ? { assetId: crypto.randomUUID() } : {}),
        crypto.randomUUID(),
        0
      );
      if (source.type === 'chart') source.sourceAssetId = crypto.randomUUID();
      const { document, previous, instance } = linked([source]);
      const local = document.nodes.find(node => node.id === instance.sourceToInstance[source.id])!;
      const copiedAsset = crypto.randomUUID();
      if (local.type === 'media') local.assetId = copiedAsset;
      if (local.type === 'chart') local.sourceAssetId = copiedAsset;
      const next = structuredClone(previous);
      next.nodes[0].name = 'Updated upstream';
      mergeElementSetRevision(document, instance.id, previous, next, crypto.randomUUID());
      expect(local).toMatchObject({
        name: 'Updated upstream',
        [kind === 'image' ? 'assetId' : 'sourceAssetId']: copiedAsset,
      });
    }
  );

  it('tracks unchanged, new, missing and deleted instance nodes without repeating tombstones', () => {
    const first = shape(),
      second = shape();
    const { document: before, instance } = linked([first, second]);
    const after = structuredClone(before);
    const added = instantiateElementSet(
      { nodes: [shape()], width: 100, height: 100, assets: [] },
      { setId: crypto.randomUUID(), revisionId: crypto.randomUUID(), x: 0, y: 0 }
    );
    after.componentInstances.push(added.instance);
    after.nodes.push(...added.nodes);
    trackElementInstanceOverrides(before, after);
    expect(after.componentInstances[0].localOverrides).toEqual({});
    const missing = crypto.randomUUID();
    before.componentInstances[0].sourceToInstance[missing] = crypto.randomUUID();
    after.componentInstances[0].sourceToInstance[missing] =
      before.componentInstances[0].sourceToInstance[missing];
    after.nodes = after.nodes.filter(node => node.id !== instance.sourceToInstance[first.id]);
    trackElementInstanceOverrides(before, after);
    trackElementInstanceOverrides(before, after);
    expect(after.componentInstances[0].localDeletions).toEqual([first.id]);
    const nextMissing = shape();
    after.componentInstances[0].sourceToInstance[nextMissing.id] = nextMissing.id;
    after.nodes.push(nextMissing);
    trackElementInstanceOverrides(before, after);
    expect(after.componentInstances[0].localOverrides).not.toHaveProperty(nextMissing.id);
    const local = after.nodes.find(node => node.id === instance.sourceToInstance[second.id])!;
    local.name = 'Tracked';
    after.componentInstances[0].localOverrides[second.id] = ['style'];
    trackElementInstanceOverrides(before, after);
    expect(after.componentInstances[0].localOverrides[second.id]).toEqual(['style', 'name']);
  });
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
