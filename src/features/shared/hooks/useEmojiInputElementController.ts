import { useMemo, useState } from 'react';

import { EmojiInlineIndexSearch, type Emoji } from '@platejs/emoji';
import { EmojiPlugin } from '@platejs/emoji/react';
import { usePluginOption } from 'platejs/react';

import { useDebounce } from '@/features/shared/hooks/use-debounce.ts';

export function useEmojiInputElementController() {
  const data = usePluginOption(EmojiPlugin, 'data');
  const [value, setValue] = useState('');
  const debouncedValue = useDebounce(value, 100);
  const isPending = value !== debouncedValue;

  const filteredEmojis = useMemo<Emoji[]>(() => {
    if (debouncedValue.trim().length === 0) return [];

    return EmojiInlineIndexSearch.getInstance(data).search(debouncedValue.replace(/:$/, '')).get();
  }, [data, debouncedValue]);

  return {
    value,
    setValue,
    isPending,
    filteredEmojis,
  };
}
