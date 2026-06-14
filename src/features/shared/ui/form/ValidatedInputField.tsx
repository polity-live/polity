import { type ReactNode } from 'react';
import { Input } from '@/features/shared/ui/ui/input';

export interface ValidatedInputSuggestion {
  value: string;
  label?: string;
}

interface ValidatedInputFieldProps extends Omit<
  React.ComponentProps<typeof Input>,
  'value' | 'onChange'
> {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  validator?: (value: string) => boolean;
  valid?: boolean;
  invalid?: boolean;
  icon?: ReactNode;
  suggestions?: ValidatedInputSuggestion[];
  showHint?: 'focus' | 'always';
}
import { useValidatedInputFieldController } from './useValidatedInputFieldController';
import { ValidatedInputFieldView } from './ValidatedInputFieldView';

export function ValidatedInputField({
  id,
  label,
  value,
  onChange,
  hint,
  validator,
  valid,
  invalid,
  icon,
  suggestions = [],
  showHint = 'focus',
  className,
  onFocus,
  onBlur,
  onKeyDown,
  ...inputProps
}: ValidatedInputFieldProps) {
  const viewProps = useValidatedInputFieldController({
    id,
    label,
    value,
    onChange,
    hint,
    validator,
    valid,
    invalid,
    icon,
    suggestions,
    showHint,
    className,
    onFocus,
    onBlur,
    onKeyDown,
    ...inputProps,
  });

  return <ValidatedInputFieldView {...viewProps} />;
}
