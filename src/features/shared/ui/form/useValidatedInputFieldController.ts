import { type ReactNode, useEffect, useId, useState } from 'react';
import { useDebounce } from '@/features/shared/hooks/use-debounce';
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
export function useValidatedInputFieldController({
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
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const suggestionsId = useId();
  const [hasEdited, setHasEdited] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isSuggestionMenuOpen, setIsSuggestionMenuOpen] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);

  const debouncedValue = useDebounce(value.trim());
  const immediateValue = value.trim();
  const evaluationValue = validator ? debouncedValue : immediateValue;
  const hasValue = evaluationValue.length > 0;
  const visibleSuggestions = suggestions.slice(0, 6);

  const computedValid =
    hasValue &&
    (typeof valid === 'boolean' ? valid : validator ? validator(evaluationValue) : false);
  const computedInvalid =
    hasValue &&
    (typeof invalid === 'boolean' ? invalid : validator ? !validator(evaluationValue) : false);

  useEffect(() => {
    if (visibleSuggestions.length === 0) {
      setSelectedSuggestionIndex(0);
      setIsSuggestionMenuOpen(false);
      return;
    }

    setSelectedSuggestionIndex(previousIndex =>
      Math.min(previousIndex, visibleSuggestions.length - 1)
    );
  }, [visibleSuggestions.length]);

  const showSuggestions =
    isFocused && isSuggestionMenuOpen && immediateValue.length > 0 && visibleSuggestions.length > 0;

  const applySuggestion = (suggestion: ValidatedInputSuggestion) => {
    setHasEdited(true);
    onChange(suggestion.value);
    setIsSuggestionMenuOpen(false);
    setSelectedSuggestionIndex(0);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions && event.key === 'ArrowDown' && visibleSuggestions.length > 0) {
      event.preventDefault();
      setIsSuggestionMenuOpen(true);
      setSelectedSuggestionIndex(0);
    } else if (showSuggestions && event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedSuggestionIndex(previousIndex =>
        Math.min(previousIndex + 1, visibleSuggestions.length - 1)
      );
    } else if (showSuggestions && event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedSuggestionIndex(previousIndex => Math.max(previousIndex - 1, 0));
    } else if (
      showSuggestions &&
      event.key === 'Enter' &&
      visibleSuggestions[selectedSuggestionIndex]
    ) {
      event.preventDefault();
      applySuggestion(visibleSuggestions[selectedSuggestionIndex]);
    } else if (showSuggestions && event.key === 'Escape') {
      event.preventDefault();
      setIsSuggestionMenuOpen(false);
      setSelectedSuggestionIndex(0);
    }

    onKeyDown?.(event);
  };
  return {
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
    inputProps,
    generatedId,
    inputId,
    suggestionsId,
    hasEdited,
    setHasEdited,
    isFocused,
    setIsFocused,
    isSuggestionMenuOpen,
    setIsSuggestionMenuOpen,
    selectedSuggestionIndex,
    setSelectedSuggestionIndex,
    debouncedValue,
    immediateValue,
    evaluationValue,
    hasValue,
    visibleSuggestions,
    computedValid,
    computedInvalid,
    showSuggestions,
    applySuggestion,
    handleKeyDown,
  };
}
