import { useMemo } from 'react';
import { createSlateEditor } from 'platejs';
import { EditorStatic, editorVariants } from '@/features/shared/ui/ui-platejs/editor-static';
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

  if (!hasContent) {
    if (!emptyText) {
      return null;
    }

    return <p className={cn('text-muted-foreground', className)}>{emptyText}</p>;
  }

  return (
    <div className={cn('w-full text-sm', className)} aria-label={plainText}>
      {typeof content === 'string' && !content.trimStart().startsWith('[') ? (
        <div className={editorVariants({ variant: 'none' })}>
          {value.map((block, index) => (
            <p key={index} className="m-0 px-0 py-1">
              {richTextToPlainText([block])}
            </p>
          ))}
        </div>
      ) : (
        <StructuredPreview value={value} />
      )}
    </div>
  );
}

// Structured data (including serialized JSON arrays) keeps all Plate formatting,
// links and media. Plain descriptions and empty fallbacks need no editor instance.
function StructuredPreview({ value }: { value: ReturnType<typeof toRichTextValue> }) {
  const editor = useMemo(() => createSlateEditor({ plugins: BaseEditorKit, value }), [value]);
  return <EditorStatic editor={editor} variant="none" />;
}
