import { useEffect } from 'react';
import { SuggestionPlugin } from '@platejs/suggestion/react';
import { useEditorPlugin, usePlateState } from 'platejs/react';

import type { EditorMode } from '@/features/editor/types';

interface UseModeSyncControllerOptions {
  currentMode?: EditorMode;
  readOnly: boolean;
}

export function useModeSyncController({ currentMode, readOnly }: UseModeSyncControllerOptions) {
  const [, setReadOnly] = usePlateState('readOnly');
  const { setOption } = useEditorPlugin(SuggestionPlugin);

  useEffect(() => {
    if (!currentMode) return;

    const shouldBeReadOnly =
      readOnly ||
      currentMode === 'view' ||
      currentMode === 'vote_internal' ||
      currentMode === 'event_final_closing_vote';
    setReadOnly(shouldBeReadOnly);

    const shouldBeSuggesting =
      currentMode === 'suggest_internal' || currentMode === 'suggest_event';
    setOption('isSuggesting', shouldBeSuggesting);
  }, [currentMode, readOnly, setReadOnly, setOption]);
}
