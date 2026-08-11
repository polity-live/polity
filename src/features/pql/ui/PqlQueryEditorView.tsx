import { featureThemeClassName } from '@/features/shared/theme';
import type { ChangeEvent, KeyboardEvent, RefObject } from 'react';

import { BadgeControl } from '@/features/shared/ui/status/StatusBadges';
import { FormControlTextarea } from '@/features/shared/ui/form';
import { Button } from '@/features/shared/ui/ui/button';
import { cn } from '@/features/shared/utils/utils';
import type { PqlFieldDefinition } from '../logic/applyPqlFilter';
import type { PqlQueryIssue, PqlSuggestion } from '../logic/pqlQueryLanguage';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface PqlQueryEditorViewProps<TItem, TFieldKey extends string> {
  className?: string;
  fields: readonly PqlFieldDefinition<TItem, TFieldKey>[];
  issues: readonly PqlQueryIssue[];
  onBlur: () => void;
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  onClick: () => void;
  onFocus: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onKeyUp: () => void;
  onSelect: () => void;
  onSuggestionHover: (index: number) => void;
  onSuggestionSelect: (suggestion: PqlSuggestion) => void;
  placeholder?: string;
  selectedSuggestionIndex: number;
  suggestions: readonly PqlSuggestion[];
  suggestionsOpen: boolean;
  textareaClassName?: string;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
}

export function PqlQueryEditorView<TItem, TFieldKey extends string>({
  className,
  fields,
  issues,
  onBlur,
  onChange,
  onClick,
  onFocus,
  onKeyDown,
  onKeyUp,
  onSelect,
  onSuggestionHover,
  onSuggestionSelect,
  placeholder,
  selectedSuggestionIndex,
  suggestions,
  suggestionsOpen,
  textareaClassName,
  textareaRef,
  value,
}: PqlQueryEditorViewProps<TItem, TFieldKey>) {
  const visibleFields = fields.slice(0, 10);

  return (
    <div className={cn('space-y-3', className)}>
      <div className="relative">
        <FormControlTextarea
          data-action-id="pql.query-editor.query.change"
          ref={textareaRef}
          value={value}
          placeholder={placeholder}
          onChange={onChange}
          onFocus={onFocus}
          onBlur={onBlur}
          onClick={onClick}
          onKeyUp={onKeyUp}
          onSelect={onSelect}
          onKeyDown={onKeyDown}
          className={cn('min-h-32 font-mono text-sm', textareaClassName)}
          spellCheck={false}
        />

        {suggestionsOpen && suggestions.length > 0 ? (
          <div className="bg-popover absolute z-50 mt-2 w-full rounded-md border p-1 shadow-md">
            {suggestions.map((suggestion: any, index: number) => (
              <Button
                key={`${suggestion.kind}-${suggestion.label}-${suggestion.insertText}`}
                type="button"
                data-action-id="pql.query-editor.suggestion.select"
                variant="ghost"
                className={cn(
                  'h-auto w-full justify-start rounded-sm px-3 py-2 text-left text-sm whitespace-normal',
                  index === selectedSuggestionIndex
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-accent/50'
                )}
                onMouseDown={event => {
                  event.preventDefault();
                  onSuggestionSelect(suggestion);
                }}
                onMouseEnter={() => onSuggestionHover(index)}
              >
                <BadgeControl
                  variant="outline"
                  className={featureThemeClassName('pqlPqlQueryEditorThemedText')}
                >
                  {suggestion.kind}
                </BadgeControl>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{suggestion.label}</div>
                  {suggestion.detail ? (
                    <div className="text-muted-foreground truncate text-xs">
                      {suggestion.detail}
                    </div>
                  ) : null}
                </div>
              </Button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {visibleFields.map((field: any) => (
          <BadgeControl key={field.key} variant="secondary" size="xs" textStyle="mono">
            {field.key}
          </BadgeControl>
        ))}
        {fields.length > visibleFields.length ? (
          <BadgeControl variant="outline" size="xs" textStyle="mono">
            +{fields.length - visibleFields.length}
            {translateText('generated.inline.0142_more_e7c95b4c')}
          </BadgeControl>
        ) : null}
      </div>

      <p className="text-muted-foreground text-xs">
        {translateText(
          'generated.inline.1094_suggestions_support_fields_in_contains_and_or_72aca790'
        )}
      </p>

      {issues.length > 0 ? (
        <div className="border-destructive/40 bg-destructive/5 text-destructive rounded-md border px-3 py-2 text-sm">
          {issues.slice(0, 3).map((issue: any) => (
            <p key={`${issue.start}-${issue.end}-${issue.message}`}>{issue.message}</p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
