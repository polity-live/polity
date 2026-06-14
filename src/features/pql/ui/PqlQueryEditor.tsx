import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/features/shared/ui/ui/badge';
import { Textarea } from '@/features/shared/ui/ui/textarea';
import { cn } from '@/features/shared/utils/utils';
import type { PqlFieldDefinition } from '../logic/applyPqlFilter';
import {
  applyPqlSuggestion,
  getPqlSuggestions,
  type PqlQueryIssue,
  type PqlSuggestion,
} from '../logic/pqlQueryLanguage';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

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
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const blurTimeoutRef = useRef<number | null>(null);
  const [cursorPosition, setCursorPosition] = useState(value.length);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);

  useEffect(() => {
    setCursorPosition(currentPosition => Math.min(currentPosition, value.length));
  }, [value]);

  useEffect(
    () => () => {
      if (blurTimeoutRef.current !== null) {
        window.clearTimeout(blurTimeoutRef.current);
      }
    },
    []
  );

  const suggestions = useMemo(
    () =>
      suggestionsOpen
        ? getPqlSuggestions(value, cursorPosition, fields).slice(0, 8)
        : ([] as PqlSuggestion[]),
    [cursorPosition, fields, suggestionsOpen, value]
  );

  const visibleFields = fields.slice(0, 10);

  useEffect(() => {
    if (selectedSuggestionIndex < suggestions.length) {
      return;
    }

    setSelectedSuggestionIndex(0);
  }, [selectedSuggestionIndex, suggestions.length]);

  const syncCursorPosition = () => {
    const nextCursorPosition = textareaRef.current?.selectionStart ?? value.length;
    setCursorPosition(nextCursorPosition);
  };

  const clearBlurTimeout = () => {
    if (blurTimeoutRef.current !== null) {
      window.clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
  };

  const closeSuggestionsSoon = () => {
    clearBlurTimeout();
    blurTimeoutRef.current = window.setTimeout(() => {
      setSuggestionsOpen(false);
    }, 120);
  };

  const handleSuggestionSelect = (suggestion: PqlSuggestion) => {
    clearBlurTimeout();
    const result = applyPqlSuggestion(value, cursorPosition, suggestion);
    onChange(result.value);
    setSuggestionsOpen(true);
    setSelectedSuggestionIndex(0);

    requestAnimationFrame(() => {
      if (!textareaRef.current) {
        return;
      }

      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(result.caretPosition, result.caretPosition);
      setCursorPosition(result.caretPosition);
    });
  };

  return (
    <div className={cn('space-y-3', className)}>
      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={value}
          placeholder={placeholder}
          onChange={event => {
            onChange(event.target.value);
            setCursorPosition(event.target.selectionStart ?? event.target.value.length);
            setSuggestionsOpen(true);
            setSelectedSuggestionIndex(0);
          }}
          onFocus={() => {
            clearBlurTimeout();
            syncCursorPosition();
            setSuggestionsOpen(true);
          }}
          onBlur={closeSuggestionsSoon}
          onClick={syncCursorPosition}
          onKeyUp={syncCursorPosition}
          onSelect={syncCursorPosition}
          onKeyDown={event => {
            if (suggestions.length === 0) {
              if (event.key === 'ArrowDown') {
                const nextSuggestions = getPqlSuggestions(value, cursorPosition, fields);
                if (nextSuggestions.length > 0) {
                  setSuggestionsOpen(true);
                  setSelectedSuggestionIndex(0);
                  event.preventDefault();
                }
              }

              return;
            }

            if (event.key === 'ArrowDown') {
              setSelectedSuggestionIndex(currentIndex =>
                currentIndex >= suggestions.length - 1 ? 0 : currentIndex + 1
              );
              event.preventDefault();
              return;
            }

            if (event.key === 'ArrowUp') {
              setSelectedSuggestionIndex(currentIndex =>
                currentIndex <= 0 ? suggestions.length - 1 : currentIndex - 1
              );
              event.preventDefault();
              return;
            }

            if (event.key === 'Enter' || event.key === 'Tab') {
              const selectedSuggestion = suggestions[selectedSuggestionIndex];
              if (selectedSuggestion) {
                handleSuggestionSelect(selectedSuggestion);
                event.preventDefault();
              }
              return;
            }

            if (event.key === 'Escape') {
              setSuggestionsOpen(false);
            }
          }}
          className={cn('min-h-32 font-mono text-sm', textareaClassName)}
          spellCheck={false}
        />

        {suggestionsOpen && suggestions.length > 0 ? (
          <div className="bg-popover absolute z-50 mt-2 w-full rounded-md border p-1 shadow-md">
            {suggestions.map((suggestion, index) => (
              <button
                key={`${suggestion.kind}-${suggestion.label}-${suggestion.insertText}`}
                type="button"
                className={cn(
                  'flex w-full items-center gap-3 rounded-sm px-3 py-2 text-left text-sm',
                  index === selectedSuggestionIndex
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-accent/50'
                )}
                onMouseDown={event => {
                  event.preventDefault();
                  handleSuggestionSelect(suggestion);
                }}
                onMouseEnter={() => setSelectedSuggestionIndex(index)}
              >
                <Badge variant="outline" className="min-w-16 justify-center text-[10px] uppercase">
                  {suggestion.kind}
                </Badge>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{suggestion.label}</div>
                  {suggestion.detail ? (
                    <div className="text-muted-foreground truncate text-xs">
                      {suggestion.detail}
                    </div>
                  ) : null}
                </div>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {visibleFields.map(field => (
          <Badge key={field.key} variant="secondary" className="font-mono text-xs">
            {field.key}
          </Badge>
        ))}
        {fields.length > visibleFields.length ? (
          <Badge variant="outline" className="font-mono text-xs">
            +{fields.length - visibleFields.length}
            {translateText('generated.inline.0142_more_e7c95b4c')}
          </Badge>
        ) : null}
      </div>

      <p className="text-muted-foreground text-xs">
        {translateText(
          'generated.inline.1094_suggestions_support_fields_in_contains_and_or_72aca790'
        )}
      </p>

      {issues.length > 0 ? (
        <div className="border-destructive/40 bg-destructive/5 text-destructive rounded-md border px-3 py-2 text-sm">
          {issues.slice(0, 3).map(issue => (
            <p key={`${issue.start}-${issue.end}-${issue.message}`}>{issue.message}</p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
