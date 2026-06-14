import * as React from 'react';
import type { Value } from 'platejs';
import { Plate, usePlateEditor } from 'platejs/react';
import { EMPTY_RICH_TEXT_VALUE, toRichTextValue } from '@/features/shared/logic/richText';
import { EditorKit } from '@/features/shared/ui/kit-platejs/editor-kit';
import { Editor, EditorContainer } from '@/features/shared/ui/ui-platejs/editor';
import { FixedToolbarButtons } from '@/features/shared/ui/ui-platejs/fixed-toolbar-buttons';
import { Toolbar } from '@/features/shared/ui/layout/Toolbar';
import { cn } from '@/features/shared/utils/utils';

interface SimpleRichTextEditorProps {
  value: Value;
  onChange: (value: Value) => void;
  placeholder?: string;
  className?: string;
  editorClassName?: string;
  id?: string;
}

const SIMPLE_EDITOR_KIT = EditorKit.filter(plugin => {
  const key = String(plugin.key);

  return key !== 'fixed-toolbar' && key !== 'floating-toolbar';
});

export function SimpleRichTextEditor({
  value,
  onChange,
  placeholder,
  className,
  editorClassName,
  id,
}: SimpleRichTextEditorProps) {
  const normalizedValue = React.useMemo(() => toRichTextValue(value), [value]);
  const onChangeRef = React.useRef(onChange);
  const initialValueRef = React.useRef<Value>(normalizedValue);
  const previousValueKeyRef = React.useRef(JSON.stringify(normalizedValue));
  const isApplyingExternalValue = React.useRef(false);

  React.useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const editor = usePlateEditor({
    plugins: SIMPLE_EDITOR_KIT,
    value: initialValueRef.current.length > 0 ? initialValueRef.current : EMPTY_RICH_TEXT_VALUE,
  });

  React.useEffect(() => {
    const nextValueKey = JSON.stringify(normalizedValue);

    if (previousValueKeyRef.current === nextValueKey) {
      return;
    }

    previousValueKeyRef.current = nextValueKey;
    isApplyingExternalValue.current = true;
    editor.selection = null;
    editor.children = normalizedValue;
    (editor as unknown as { onChange?: () => void }).onChange?.();
    isApplyingExternalValue.current = false;
  }, [editor, normalizedValue]);

  const handleChange = React.useCallback(({ value: nextValue }: { value: Value }) => {
    if (isApplyingExternalValue.current) {
      return;
    }

    previousValueKeyRef.current = JSON.stringify(nextValue);
    onChangeRef.current(nextValue);
  }, []);

  return (
    <Plate editor={editor} onChange={handleChange}>
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
