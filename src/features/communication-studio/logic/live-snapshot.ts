import type { StudioDocumentV3 } from './document-v3';
import type { LiveSource } from './live-contract';
import { liveSourceKey, projectLiveDocument, hydrateLiveSources } from './live-projection';

/** Capture once, including overflow pages, before the export enters the worker queue. */
export function createLiveSnapshot(
  document: StudioDocumentV3,
  sources: readonly LiveSource[],
  options: { now: number; portrait?: boolean; resultsVisible?: boolean }
) {
  const size = 4;
  const byId = new Map(
    hydrateLiveSources(sources).map(s => [liveSourceKey(s.source_type, s.source_id), s])
  );
  const snapshot = projectLiveDocument(document, sources, {
    ...options,
    static: true,
    pageSize: size,
    page: 0,
  });
  const expanded = new Map<string, string[]>();
  for (const frame of document.nodes.filter(
    n => n.type === 'frame' && !n.parentFrameId && n.id !== document.masterLayout.frameId
  )) {
    const descendants = new Set([frame.id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const n of document.nodes)
        if (n.parentFrameId && descendants.has(n.parentFrameId) && !descendants.has(n.id)) {
          descendants.add(n.id);
          changed = true;
        }
    }
    const nodes = document.nodes.filter(n => descendants.has(n.id));
    let pages = 1;
    for (const n of nodes) {
      const b = n.liveBinding;
      if (!b) continue;
      const p = byId.get(liveSourceKey(b.sourceType, b.sourceId))?.payload;
      if (b.field === 'results' && options.resultsVisible !== false)
        pages = Math.max(pages, Math.ceil((p?.results?.options.length ?? 0) / size));
      if (b.field === 'speakers' && Array.isArray(p?.speakers))
        pages = Math.max(pages, Math.ceil(p.speakers.filter(s => !s.completed).length / size));
    }
    const ids = [frame.id];
    for (let page = 1; page < pages; page++) {
      const projected = projectLiveDocument(document, sources, {
        ...options,
        static: true,
        pageSize: size,
        page,
      });
      const copies = structuredClone(projected.nodes.filter(n => descendants.has(n.id)));
      const mapping = new Map(copies.map(n => [n.id, crypto.randomUUID()]));
      for (const n of copies) {
        const old = n.id;
        n.id = mapping.get(old) ?? old;
        if (n.parentFrameId) n.parentFrameId = mapping.get(n.parentFrameId) ?? n.parentFrameId;
        if (n.type === 'frame') {
          delete n.eventSource;
          if (old === frame.id) {
            n.name = `${frame.name} · ${page + 1}/${pages}`;
            n.zIndex = frame.zIndex + page / (pages + 1);
            n.transform.x += page * 2080;
          }
        }
        if (n.type === 'richText')
          for (const paragraph of n.content) {
            paragraph.id = crypto.randomUUID();
            for (const child of paragraph.children)
              if ('id' in child) child.id = crypto.randomUUID();
          }
      }
      ids.push(mapping.get(frame.id) ?? frame.id);
      snapshot.nodes.push(...copies);
    }
    expanded.set(frame.id, ids);
  }
  snapshot.nodes
    .filter(n => n.type === 'frame' && !n.parentFrameId)
    .sort((a, b) => a.zIndex - b.zIndex)
    .forEach((n, i) => {
      n.zIndex = i;
    });
  return {
    document: snapshot,
    frameIds: (selected: string[]) => selected.flatMap(id => expanded.get(id) ?? [id]),
  };
}
