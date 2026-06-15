'use client';

import { useMemo } from 'react';

import { HashtagInput } from './HashtagInput';

interface HashtagEditorProps {
  value: string[];
  onChange: (hashtags: string[]) => void;
  label?: string;
  showLabel?: boolean;
  placeholder?: string;
  maxTags?: number;
  suggestions?: string[];
  preferredSuggestions?: string[];
}

export function HashtagEditor({
  value,
  onChange,
  label,
  showLabel,
  placeholder,
  maxTags,
  suggestions = [],
  preferredSuggestions = [],
}: HashtagEditorProps) {
  const prioritizedSuggestions = useMemo(() => {
    const seen = new Set<string>();

    return [...preferredSuggestions, ...suggestions].filter(tag => {
      const key = tag.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [preferredSuggestions, suggestions]);

  return (
    <HashtagInput
      value={value}
      onChange={onChange}
      label={label}
      showLabel={showLabel}
      placeholder={placeholder}
      maxTags={maxTags}
      suggestions={prioritizedSuggestions}
    />
  );
}
