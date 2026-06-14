'use client';

import { HashtagInput } from './HashtagInput';

interface HashtagEditorProps {
  value: string[];
  onChange: (hashtags: string[]) => void;
  label?: string;
  showLabel?: boolean;
  placeholder?: string;
  maxTags?: number;
  suggestions?: string[];
}

export function HashtagEditor({
  value,
  onChange,
  label,
  showLabel,
  placeholder,
  maxTags,
  suggestions = [],
}: HashtagEditorProps) {
  return (
    <HashtagInput
      value={value}
      onChange={onChange}
      label={label}
      showLabel={showLabel}
      placeholder={placeholder}
      maxTags={maxTags}
      suggestions={suggestions}
    />
  );
}
