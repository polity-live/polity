import type { PlateElementProps } from 'platejs/react';

import { useEmojiInputElementController } from '@/features/shared/hooks/useEmojiInputElementController';
import { EmojiInputElementView } from './EmojiInputElementView';

export function EmojiInputElement(props: PlateElementProps) {
  return <EmojiInputElementView {...props} {...useEmojiInputElementController()} />;
}
