import { useMemo } from 'react';
import { createSlateEditor } from 'platejs';
import { EditorStatic } from '@/features/shared/ui/ui-platejs/editor-static';
import { BaseEditorKit } from '@/features/shared/ui/kit-platejs/editor-base-kit';
import {
  hasRichTextContent,
  richTextToPlainText,
  toRichTextValue,
} from '@/features/shared/logic/richText';
import { cn } from '@/features/shared/utils/utils';

interface RichTextPreviewProps {
  content?: unknown;
  emptyText?: string;
  className?: string;
}

export function RichTextPreview({ content, emptyText, className }: RichTextPreviewProps) {
  const hasContent = hasRichTextContent(content);
  const plainText = richTextToPlainText(content);
  const value = useMemo(() => toRichTextValue(content), [content]);
  const editor = useMemo(
    () =>
      createSlateEditor({
        plugins: BaseEditorKit,
        value,
      }),
    [value]
  );

  if (!hasContent) {
    if (!emptyText) {
      return null;
    }

    return <p className={cn('text-muted-foreground', className)}>{emptyText}</p>;
  }

  return (
    <div className={cn('w-full text-sm', className)} aria-label={plainText}>
      <EditorStatic editor={editor} variant="none" />
    </div>
  );
}
