import { useEffect, useRef, useState } from 'react';
import type { StudioDocumentV3 } from '@/features/communication-studio/logic/document-v3';

/** Animate live tally bars while keeping canonical documents and exports static. */
export function useAnimatedStudioDocument(document: StudioDocumentV3 | null) {
  const previous = useRef<StudioDocumentV3 | null>(null);
  const [displayed, setDisplayed] = useState(document);
  useEffect(() => {
    if (!document) {
      setDisplayed(null);
      previous.current = null;
      return;
    }
    const old = previous.current;
    previous.current = document;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplayed(document);
      return;
    }
    const changes = document.nodes.flatMap(node => {
      if (node.type !== 'chart' || !node.liveBinding) return [];
      const before = old?.nodes.find(n => n.id === node.id);
      const from =
        before?.type === 'chart' &&
        JSON.stringify(before.data.labels) === JSON.stringify(node.data.labels)
          ? before.data.series
          : [];
      if (
        JSON.stringify(from.map(s => s.values)) ===
        JSON.stringify(node.data.series.map(s => s.values))
      )
        return [];
      return [
        {
          id: node.id,
          from: node.data.series.map((s, i) => s.values.map((_, j) => from[i]?.values[j] ?? 0)),
        },
      ];
    });
    if (!changes.length) {
      setDisplayed(document);
      return;
    }
    let animation = 0;
    const start = performance.now();
    const step = () => {
      const progress = Math.min(1, (performance.now() - start) / 650);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = structuredClone(document);
      for (const change of changes) {
        const node = next.nodes.find(n => n.id === change.id);
        if (node?.type === 'chart')
          node.data.series.forEach((s, i) => {
            s.values = s.values.map((v, j) =>
              v === null ? null : change.from[i][j] + (v - change.from[i][j]) * eased
            );
          });
      }
      setDisplayed(next);
      if (progress < 1) animation = requestAnimationFrame(step);
    };
    animation = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animation);
  }, [document]);
  return displayed;
}
