import type { Value } from 'platejs';
import type { ReactNode } from 'react';
import { useCREditorPreviewModel } from '../hooks/useCREditorPreviewModel';

interface CREditorPreviewProps {
  documentContent: Value;
  suggestionIds: Set<string>;
  /** Render the inline amendment editor instead of a static preview when event modes allow it. */
  allowInteractiveEditor?: boolean;
  /** Amendment editing mode used when interactive rendering is explicitly enabled. */
  editingMode?: string | null;
  /** Amendment ID — required for interactive mode */
  amendmentId?: string;
  /** Current user ID — required for interactive mode */
  userId?: string;
  userRecord?: {
    id: string;
    name?: string;
    email?: string | null;
    avatar?: string;
  };
  /** Agenda item ID — optional, passed to interactive editor */
  agendaItemId?: string;
  toolbarEnd?: ReactNode;
}
import { CREditorPreviewView } from './CREditorPreviewView';
export function CREditorPreview({
  documentContent,
  suggestionIds,
  allowInteractiveEditor,
  editingMode,
  amendmentId,
  userId,
  userRecord,
  agendaItemId,
  toolbarEnd,
}: CREditorPreviewProps) {
  const { editor, isInteractive, isOpen, onOpenChange } = useCREditorPreviewModel({
    allowInteractiveEditor,
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
      userRecord={userRecord}
      agendaItemId={agendaItemId}
      editor={editor}
      isInteractive={isInteractive}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      toolbarEnd={toolbarEnd}
    />
  );
}
