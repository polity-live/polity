import { useMemo, useEffect, useState } from 'react';
import { useQuery } from '@/zero/observed-query';
import { queries } from '../queries';
import type { StudioDocumentV3 } from '@/features/communication-studio/logic/document-v3';
import {
  projectLiveDocument,
  resultSourceRefs,
} from '@/features/communication-studio/logic/live-projection';
import type { LiveSource } from '@/features/communication-studio/logic/live-contract';

export function useLiveStudioState(
  document: StudioDocumentV3 | null,
  options: { portrait?: boolean; resultsVisible?: boolean; page?: number; now?: number } = {}
) {
  const refs = useMemo(
    () => [
      ...new Map(
        (document?.nodes ?? []).flatMap(n =>
          n.liveBinding
            ? [
                [
                  `${n.liveBinding.sourceType}:${n.liveBinding.sourceId}`,
                  { type: n.liveBinding.sourceType, id: n.liveBinding.sourceId },
                ] as const,
              ]
            : []
        )
      ).values(),
    ],
    [document]
  );
  const [sources, status] = useQuery(
    refs.length ? queries.studio.liveSources({ refs }) : undefined
  );
  const resultRefs = resultSourceRefs((sources ?? []) as unknown as LiveSource[]);
  const [results] = useQuery(
    resultRefs.length ? queries.studio.liveSources({ refs: resultRefs }) : undefined
  );
  const [now, setNow] = useState(Date.now());
  const clock = document?.nodes.some(
    n => n.liveBinding?.field === 'countdown' || n.liveBinding?.format === 'countdown'
  );
  useEffect(() => {
    if (!clock || options.now !== undefined) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [clock, options.now !== undefined]);
  const liveSources = useMemo(
    () => [...(sources ?? []), ...(results ?? [])] as unknown as LiveSource[],
    [sources, results]
  );
  const projected = useMemo(
    () =>
      document
        ? projectLiveDocument(document, liveSources, { ...options, now: options.now ?? now })
        : null,
    [
      document,
      liveSources,
      now,
      options.now,
      options.portrait,
      options.resultsVisible,
      options.page,
    ]
  );
  return { sources: liveSources, projected, status };
}
