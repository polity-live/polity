import { useMemo, useState } from 'react';
import type { Value } from 'platejs';
import { createSlateEditor } from 'platejs';

import { BaseEditorKit } from '@/features/shared/ui/kit-platejs/editor-base-kit';
import {
  filterDocumentToSuggestions,
  type SuggestionPreviewResolutionMap,
} from '../logic/filterDocumentToSingleSuggestion';
import type { EditingMode } from '@/zero/amendments/editing-mode-policy';

interface UseCREditorPreviewModelOptions {
  allowInteractiveEditor?: boolean;
  amendmentId?: string;
  documentContent: Value;
  editingMode?: EditingMode | null;
  suggestionIds: Set<string>;
  suggestionResolutions?: SuggestionPreviewResolutionMap;
}

export function useCREditorPreviewModel({
  allowInteractiveEditor = false,
  amendmentId,
  documentContent,
  editingMode,
  suggestionIds,
  suggestionResolutions,
}: UseCREditorPreviewModelOptions) {
  const [isOpen, setIsOpen] = useState(false);
  const isInteractive = allowInteractiveEditor && editingMode === 'suggest_event' && !!amendmentId;

  const suggestionIdsKey = useMemo(() => [...suggestionIds].sort().join(','), [suggestionIds]);
  const suggestionResolutionsKey = useMemo(
    () =>
      suggestionResolutions
        ? [...suggestionResolutions.entries()]
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([id, resolution]) => `${id}:${resolution}`)
            .join(',')
        : '',
    [suggestionResolutions]
  );

  const editor = useMemo(() => {
    if (!isOpen || isInteractive) return null;

    const filteredContent = filterDocumentToSuggestions(
      documentContent,
      suggestionIds,
      suggestionResolutions
    );

    return createSlateEditor({
      plugins: BaseEditorKit,
      value: filteredContent,
    });
  }, [
    documentContent,
    isInteractive,
    isOpen,
    suggestionIds,
    suggestionIdsKey,
    suggestionResolutions,
    suggestionResolutionsKey,
  ]);

  return {
    editor,
    isInteractive,
    isOpen,
    onOpenChange: setIsOpen,
  };
}
