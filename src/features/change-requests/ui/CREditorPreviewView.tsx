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
import type { ReactNode } from 'react';
import type { EditingMode } from '@/zero/amendments/editing-mode-policy';
export interface CREditorPreviewViewProps {
  documentContent: any;
  suggestionIds: any;
  editingMode?: EditingMode | null;
  amendmentId: any;
  userId: any;
  userRecord?: any;
  agendaItemId: any;
  editor: any;
  isInteractive: any;
  isOpen: any;
  onOpenChange: any;
  toolbarEnd?: ReactNode;
}

export function CREditorPreviewView({
  editingMode,
  amendmentId,
  userId,
  userRecord,
  agendaItemId,
  editor,
  isInteractive,
  isOpen,
  onOpenChange,
  toolbarEnd,
}: CREditorPreviewViewProps) {
  return (
    <Collapsible open={isOpen} onOpenChange={onOpenChange}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" presentation="mutedTiny" className="gap-1">
            {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {translateText('generated.inline.0288_document_preview_88c64603')}
          </Button>
        </CollapsibleTrigger>
        {toolbarEnd ? (
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">{toolbarEnd}</div>
        ) : null}
      </div>
      <CollapsibleContent>
        {isInteractive && amendmentId ? (
          <div className="mt-2">
            <InlineAmendmentEditor
              amendmentId={amendmentId}
              userId={userId}
              userRecord={userRecord}
              agendaItemId={agendaItemId}
              editingMode={editingMode}
            />
          </div>
        ) : (
          editor && (
            <div className="bg-muted/30 mt-2 rounded-lg border">
              <EditorStatic editor={editor} variant="preview" />
            </div>
          )
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
