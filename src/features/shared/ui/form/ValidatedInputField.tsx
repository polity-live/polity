import { type ReactNode, useEffect, useId, useState } from 'react';
import { useDebounce } from '@/features/shared/hooks/use-debounce';
import { Input } from '@/features/shared/ui/ui/input';
import { Label } from '@/features/shared/ui/ui/label';
import { cn } from '@/features/shared/utils/utils';

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
}

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

  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>{label}</Label>
      <div className="relative">
        {icon ? (
          <div className="text-muted-foreground pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            {icon}
          </div>
        ) : null}
        <Input
          {...inputProps}
          id={inputId}
          value={value}
          onChange={event => {
            setHasEdited(true);
            setIsSuggestionMenuOpen(true);
            setSelectedSuggestionIndex(0);
            onChange(event.target.value);
          }}
          onFocus={event => {
            setIsFocused(true);
            setIsSuggestionMenuOpen(true);
            onFocus?.(event);
          }}
          onBlur={event => {
            setIsFocused(false);
            setIsSuggestionMenuOpen(false);
            onBlur?.(event);
          }}
          onKeyDown={handleKeyDown}
          aria-invalid={computedInvalid || undefined}
          data-valid={computedValid ? 'true' : undefined}
          aria-autocomplete={visibleSuggestions.length > 0 ? 'list' : undefined}
          aria-expanded={showSuggestions}
          aria-controls={showSuggestions ? suggestionsId : undefined}
          className={cn(icon ? 'pl-10' : undefined, className)}
        />
        {showSuggestions ? (
          <div
            id={suggestionsId}
            role="listbox"
            className="bg-popover absolute top-full right-0 left-0 z-20 mt-1 max-h-64 overflow-y-auto rounded-md border shadow-lg"
          >
            {visibleSuggestions.map((option, index) => {
              const isSelected = index === selectedSuggestionIndex;

              return (
                <button
                  key={`${option.value}-${option.label ?? ''}`}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={cn(
                    'flex w-full flex-col items-start px-3 py-2 text-left transition-colors',
                    isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/70'
                  )}
                  onMouseDown={event => {
                    event.preventDefault();
                    applySuggestion(option);
                  }}
                  onMouseEnter={() => setSelectedSuggestionIndex(index)}
                >
                  <span className="text-sm font-medium">{option.value}</span>
                  {option.label && option.label !== option.value ? (
                    <span className="text-muted-foreground text-xs">{option.label}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
      {hint && hasEdited && isFocused ? (
        <p
          className={cn(
            'text-muted-foreground text-xs',
            computedInvalid && 'text-destructive',
            computedValid && 'text-emerald-600 dark:text-emerald-400'
          )}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}
