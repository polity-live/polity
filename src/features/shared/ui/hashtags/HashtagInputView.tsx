'use client';

import { Label } from '@/features/shared/ui/ui/label.tsx';
import { Input } from '@/features/shared/ui/ui/input.tsx';
import { Button } from '@/features/shared/ui/ui/button.tsx';
import { X, Hash } from 'lucide-react';
import { getHashtagGradient } from '@/features/shared/logic/hashtagHelpers';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { cn } from '@/features/shared/utils/utils';
export interface HashtagInputViewProps {
  value: any[];
  onChange: any;
  label: any;
  showLabel: any;
  placeholder: any;
  maxTags: any;
  suggestions: any[];
  inputId: any;
  inputClassName: any;
  inputValue: any;
  setInputValue: any;
  showSuggestions: any;
  setShowSuggestions: any;
  selectedIndex: any;
  setSelectedIndex: any;
  containerRef: any;
  trimmed: any;
  filteredSuggestions: string[];
  resolvedInputId: any;
  addHashtag: any;
  removeHashtag: any;
  handleKeyDown: any;
}

export function HashtagInputView({
  value,
  label,
  showLabel,
  placeholder,
  maxTags,
  inputClassName,
  inputValue,
  setInputValue,
  showSuggestions,
  setShowSuggestions,
  selectedIndex,
  setSelectedIndex,
  containerRef,
  filteredSuggestions,
  resolvedInputId,
  addHashtag,
  removeHashtag,
  handleKeyDown,
}: HashtagInputViewProps) {
  return (
    <div className="space-y-2" ref={containerRef}>
      {showLabel && <Label htmlFor={resolvedInputId}>{label}</Label>}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((tag: string) => (
            <span
              key={tag}
              className={cn(
                'inline-flex items-center gap-1 rounded-md border px-3 py-1 text-sm',
                getHashtagGradient(tag)
              )}
            >
              <Hash className="h-3 w-3" />
              {tag}
              <button
                type="button"
                onClick={() => removeHashtag(tag)}
                className="hover:bg-muted/40 ml-1 rounded-sm"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Hash className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            id={resolvedInputId}
            aria-label={showLabel ? undefined : label}
            placeholder={placeholder}
            value={inputValue}
            onChange={e => {
              setInputValue(e.target.value);
              setShowSuggestions(true);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowSuggestions(true)}
            className={inputClassName ? `pl-9 ${inputClassName}` : 'pl-9'}
          />
          {showSuggestions && filteredSuggestions.length > 0 && (
            <div className="bg-popover absolute z-50 mt-1 w-full rounded-md border p-1 shadow-md">
              {filteredSuggestions.slice(0, 8).map((suggestion: string, idx: number) => (
                <button
                  key={suggestion}
                  type="button"
                  className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm ${
                    idx === selectedIndex
                      ? 'bg-accent text-accent-foreground'
                      : 'hover:bg-accent/50'
                  }`}
                  onMouseDown={e => {
                    e.preventDefault();
                    addHashtag(suggestion);
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <Hash className="text-muted-foreground h-3 w-3" />
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>
        <Button type="button" variant="secondary" onClick={() => addHashtag()}>
          {translateText('generated.inline.0595_add_61cc55aa')}
        </Button>
      </div>
      {maxTags && (
        <p className="text-muted-foreground text-xs">
          {value.length}/{maxTags}
          {translateText('generated.inline.0163_hashtags_7cdf4266')}
        </p>
      )}
    </div>
  );
}
