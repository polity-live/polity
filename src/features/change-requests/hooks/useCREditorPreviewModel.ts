import { useMemo, useState } from 'react';
import type { Value } from 'platejs';
import { createSlateEditor } from 'platejs';

import { BaseEditorKit } from '@/features/shared/ui/kit-platejs/editor-base-kit';
import { filterDocumentToSuggestions } from '../logic/filterDocumentToSingleSuggestion';

interface UseCREditorPreviewModelOptions {
  allowInteractiveEditor?: boolean;
  amendmentId?: string;
  documentContent: Value;
  editingMode?: string | null;
  suggestionIds: Set<string>;
}

export function useCREditorPreviewModel({
  allowInteractiveEditor = false,
  amendmentId,
  documentContent,
  editingMode,
  suggestionIds,
}: UseCREditorPreviewModelOptions) {
  const [isOpen, setIsOpen] = useState(false);
  const isInteractive =
    allowInteractiveEditor &&
    (editingMode === 'suggest_event' || editingMode === 'vote_event') &&
    !!amendmentId;

  const suggestionIdsKey = useMemo(() => [...suggestionIds].sort().join(','), [suggestionIds]);

  const editor = useMemo(() => {
    if (!isOpen || isInteractive) return null;

    const filteredContent = filterDocumentToSuggestions(documentContent, suggestionIds);

    return createSlateEditor({
      plugins: BaseEditorKit,
      value: filteredContent,
    });
  }, [documentContent, isInteractive, isOpen, suggestionIds, suggestionIdsKey]);

  return {
    editor,
    isInteractive,
    isOpen,
    onOpenChange: setIsOpen,
  };
}
