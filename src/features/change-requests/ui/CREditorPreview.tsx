import type { Value } from 'platejs';
import type { ReactNode } from 'react';
import { useCREditorPreviewModel } from '../hooks/useCREditorPreviewModel';

interface CREditorPreviewProps {
  documentContent: Value;
  suggestionIds: Set<string>;
  /** Amendment editing mode — when 'suggest_event', renders interactive editor */
  editingMode?: string | null;
  /** Amendment ID — required for interactive mode */
  amendmentId?: string;
  /** Current user ID — required for interactive mode */
  userId?: string;
  /** Agenda item ID — optional, passed to interactive editor */
  agendaItemId?: string;
  toolbarEnd?: ReactNode;
}
import { CREditorPreviewView } from './CREditorPreviewView';
export function CREditorPreview({
  documentContent,
  suggestionIds,
  editingMode,
  amendmentId,
  userId,
  agendaItemId,
  toolbarEnd,
}: CREditorPreviewProps) {
  const { editor, isInteractive, isOpen, onOpenChange } = useCREditorPreviewModel({
    amendmentId,
    documentContent,
    editingMode,
    suggestionIds,
  });
  return (
    <CREditorPreviewView
      documentContent={documentContent}
      suggestionIds={suggestionIds}
      editingMode={editingMode}
      amendmentId={amendmentId}
      userId={userId}
      agendaItemId={agendaItemId}
      editor={editor}
      isInteractive={isInteractive}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      toolbarEnd={toolbarEnd}
    />
  );
}
