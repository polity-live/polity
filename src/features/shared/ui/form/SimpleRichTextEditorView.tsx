import type { Value } from 'platejs';
import type { PlateEditor } from 'platejs/react';
import { Plate } from 'platejs/react';

import { Toolbar } from '@/features/shared/ui/layout/Toolbar';
import { Editor, EditorContainer } from '@/features/shared/ui/ui-platejs/editor';
import { FixedToolbarButtons } from '@/features/shared/ui/ui-platejs/fixed-toolbar-buttons';
import { cn } from '@/features/shared/utils/utils';

interface SimpleRichTextEditorViewProps {
  editor: PlateEditor;
  onChange: ({ value }: { value: Value }) => void;
  placeholder?: string;
  className?: string;
  editorClassName?: string;
  id?: string;
}

export function SimpleRichTextEditorView({
  editor,
  onChange,
  placeholder,
  className,
  editorClassName,
  id,
}: SimpleRichTextEditorViewProps) {
  return (
    <Plate editor={editor} onChange={onChange}>
      <EditorContainer
        variant="select"
        className={cn('bg-background flex min-h-40 w-full flex-col overflow-hidden', className)}
      >
        <div className="bg-muted/20 shrink-0 border-b">
          <div className="max-w-full overflow-x-auto overflow-y-hidden px-2 py-1">
            <Toolbar className="min-w-max flex-nowrap items-center">
              <FixedToolbarButtons className="min-w-max" showModeToolbarButton={false} />
            </Toolbar>
          </div>
        </div>
        <Editor
          id={id}
          variant="select"
          placeholder={placeholder}
          className={cn('min-h-0 w-full flex-1 text-sm', editorClassName)}
        />
      </EditorContainer>
    </Plate>
  );
}
