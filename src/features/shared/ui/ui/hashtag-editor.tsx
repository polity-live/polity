'use client';

import { useMemo } from 'react';
import { useCommonState } from '@/zero/common/useCommonState.ts';
import { HashtagInput } from './hashtag-input.tsx';

interface HashtagEditorProps {
  value: string[];
  onChange: (hashtags: string[]) => void;
  label?: string;
  showLabel?: boolean;
  placeholder?: string;
  maxTags?: number;
}

/**
 * Connected HashtagInput that fetches all canonical hashtags for typeahead.
 * Use this in edit forms instead of HashtagInput directly.
 */
export function HashtagEditor({
  value,
  onChange,
  label,
  showLabel,
  placeholder,
  maxTags,
}: HashtagEditorProps) {
  const { allHashtags } = useCommonState({ loadAllHashtags: true });

  const suggestions = useMemo(() => (allHashtags ?? []).map(h => h.tag), [allHashtags]);

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
