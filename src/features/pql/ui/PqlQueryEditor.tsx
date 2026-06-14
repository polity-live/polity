import type { PqlFieldDefinition } from '../logic/applyPqlFilter';
import type { PqlQueryIssue } from '../logic/pqlQueryLanguage';
import { usePqlQueryEditorController } from '../hooks/usePqlQueryEditorController';
import { PqlQueryEditorView } from './PqlQueryEditorView';

interface PqlQueryEditorProps<TItem, TFieldKey extends string> {
  fields: readonly PqlFieldDefinition<TItem, TFieldKey>[];
  value: string;
  onChange: (value: string) => void;
  issues?: readonly PqlQueryIssue[];
  placeholder?: string;
  className?: string;
  textareaClassName?: string;
}

export function PqlQueryEditor<TItem, TFieldKey extends string>({
  fields,
  value,
  onChange,
  issues = [],
  placeholder,
  className,
  textareaClassName,
}: PqlQueryEditorProps<TItem, TFieldKey>) {
  return (
    <PqlQueryEditorView
      className={className}
      fields={fields}
      issues={issues}
      placeholder={placeholder}
      textareaClassName={textareaClassName}
      value={value}
      {...usePqlQueryEditorController({ fields, value, onChange })}
    />
  );
}
