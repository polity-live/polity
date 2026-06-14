import type { Value } from 'platejs';

import { useSimpleRichTextEditorController } from '@/features/shared/hooks/useSimpleRichTextEditorController';
import { SimpleRichTextEditorView } from './SimpleRichTextEditorView';

interface SimpleRichTextEditorProps {
  value: Value;
  onChange: (value: Value) => void;
  placeholder?: string;
  className?: string;
  editorClassName?: string;
  id?: string;
}

export function SimpleRichTextEditor({
  value,
  onChange,
  placeholder,
  className,
  editorClassName,
  id,
}: SimpleRichTextEditorProps) {
  return (
    <SimpleRichTextEditorView
      placeholder={placeholder}
      className={className}
      editorClassName={editorClassName}
      id={id}
      {...useSimpleRichTextEditorController({ value, onChange })}
    />
  );
}
