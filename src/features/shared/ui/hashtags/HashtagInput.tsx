'use client';

import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface HashtagInputProps {
  value: string[];
  onChange: (hashtags: string[]) => void;
  label?: string;
  showLabel?: boolean;
  placeholder?: string;
  maxTags?: number;
  suggestions?: string[];
  inputId?: string;
  inputClassName?: string;
}
import { useHashtagInputController } from './useHashtagInputController';
import { HashtagInputView } from './HashtagInputView';

export function HashtagInput({
  value,
  onChange,
  label = 'Hashtags',
  showLabel = true,
  placeholder = translateText('generated.inline.0162_add_a_hashtag_09f298a1'),
  maxTags,
  suggestions = [],
  inputId,
  inputClassName,
}: HashtagInputProps) {
  const viewProps = useHashtagInputController({
    value,
    onChange,
    label,
    showLabel,
    placeholder,
    maxTags,
    suggestions,
    inputId,
    inputClassName,
  });

  return <HashtagInputView {...viewProps} />;
}
