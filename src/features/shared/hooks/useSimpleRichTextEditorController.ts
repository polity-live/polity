import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { Value } from 'platejs';
import { usePlateEditor } from 'platejs/react';

import { toRichTextValue } from '@/features/shared/logic/richText';
import { EditorKit } from '@/features/shared/ui/kit-platejs/editor-kit';

const SIMPLE_EDITOR_KIT = EditorKit.filter(plugin => {
  const key = String(plugin.key);

  return key !== 'fixed-toolbar' && key !== 'floating-toolbar';
});

interface UseSimpleRichTextEditorControllerOptions {
  value: Value;
  onChange: (value: Value) => void;
}

export function useSimpleRichTextEditorController({
  value,
  onChange,
}: UseSimpleRichTextEditorControllerOptions) {
  const normalizedValue = useMemo(() => toRichTextValue(value), [value]);
  const onChangeRef = useRef(onChange);
  const initialValueRef = useRef<Value>(normalizedValue);
  const previousValueKeyRef = useRef(JSON.stringify(normalizedValue));
  const isApplyingExternalValue = useRef(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const editor = usePlateEditor({
    plugins: SIMPLE_EDITOR_KIT,
    value: initialValueRef.current,
  });

  useEffect(() => {
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

  const handleChange = useCallback(({ value: nextValue }: { value: Value }) => {
    if (isApplyingExternalValue.current) {
      return;
    }

    previousValueKeyRef.current = JSON.stringify(nextValue);
    onChangeRef.current(nextValue);
  }, []);

  return {
    editor,
    onChange: handleChange,
  };
}
