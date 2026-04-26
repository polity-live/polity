import * as React from 'react';
import type { Value } from 'platejs';
import { SimpleRichTextEditor } from '@/features/shared/ui/form/SimpleRichTextEditor';

interface MiniPlateEditorProps {
  value: Value;
  onChange: (value: Value) => void;
  placeholder?: string;
  className?: string;
  editorClassName?: string;
  id?: string;
}

export function MiniPlateEditor({
  value,
  onChange,
  placeholder,
  className,
  editorClassName,
  id,
}: MiniPlateEditorProps) {
  return (
    <SimpleRichTextEditor
      id={id}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
      editorClassName={editorClassName}
    />
  );
}
