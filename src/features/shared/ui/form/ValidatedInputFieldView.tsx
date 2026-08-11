import { Input } from '@/features/shared/ui/ui/input';
import { Label } from '@/features/shared/ui/ui/label';
import { getSemanticToneClasses } from '@/features/shared/theme';
import { cn } from '@/features/shared/utils/utils';

export interface ValidatedInputSuggestion {
  value: string;
  label?: string;
}
export interface ValidatedInputFieldViewProps {
  id: any;
  label: any;
  value: any;
  onChange: any;
  hint: any;
  validator: any;
  valid: any;
  invalid: any;
  icon: any;
  suggestions: any[];
  showHint: any;
  className: any;
  onFocus: any;
  onBlur: any;
  onKeyDown: any;
  inputProps: any;
  generatedId: any;
  inputId: any;
  suggestionsId: any;
  hasEdited: any;
  setHasEdited: any;
  isFocused: any;
  setIsFocused: any;
  isSuggestionMenuOpen: any;
  setIsSuggestionMenuOpen: any;
  selectedSuggestionIndex: any;
  setSelectedSuggestionIndex: any;
  debouncedValue: any;
  immediateValue: any;
  evaluationValue: any;
  hasValue: any;
  visibleSuggestions: ValidatedInputSuggestion[];
  computedValid: any;
  computedInvalid: any;
  showSuggestions: any;
  applySuggestion: any;
  handleKeyDown: any;
}

export function ValidatedInputFieldView({
  label,
  value,
  onChange,
  hint,
  icon,
  showHint,
  className,
  onFocus,
  onBlur,
  inputProps,
  inputId,
  suggestionsId,
  hasEdited,
  setHasEdited,
  isFocused,
  setIsFocused,
  setIsSuggestionMenuOpen,
  selectedSuggestionIndex,
  setSelectedSuggestionIndex,
  visibleSuggestions,
  computedValid,
  computedInvalid,
  showSuggestions,
  applySuggestion,
  handleKeyDown,
}: ValidatedInputFieldViewProps) {
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
          role="combobox"
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
            {visibleSuggestions.map((option: ValidatedInputSuggestion, index: number) => {
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
      {hint && (showHint === 'always' || (hasEdited && isFocused)) ? (
        <p
          className={cn(
            'text-muted-foreground text-xs',
            computedInvalid && 'text-destructive',
            computedValid && getSemanticToneClasses('success').text
          )}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}
