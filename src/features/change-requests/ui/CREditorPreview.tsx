import type { Value } from 'platejs';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/features/shared/ui/ui/collapsible';
import { Button } from '@/features/shared/ui/ui/button';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { EditorStatic } from '@/features/shared/ui/ui-platejs/editor-static';
import { InlineAmendmentEditor } from '@/features/editor/ui/InlineAmendmentEditor';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
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
}

export function CREditorPreview({
  documentContent,
  suggestionIds,
  editingMode,
  amendmentId,
  userId,
  agendaItemId,
}: CREditorPreviewProps) {
  const { editor, isInteractive, isOpen, onOpenChange } = useCREditorPreviewModel({
    amendmentId,
    documentContent,
    editingMode,
    suggestionIds,
  });

  return (
    <Collapsible open={isOpen} onOpenChange={onOpenChange}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" presentation="mutedTiny" className="gap-1">
          {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          {translateText('generated.inline.0288_document_preview_88c64603')}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {isInteractive && amendmentId ? (
          <div className="mt-2">
            <InlineAmendmentEditor
              amendmentId={amendmentId}
              userId={userId}
              agendaItemId={agendaItemId}
              editingMode={editingMode}
            />
          </div>
        ) : (
          editor && (
            <div className="bg-muted/30 mt-2 rounded-lg border p-4">
              <EditorStatic editor={editor} variant="none" />
            </div>
          )
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
