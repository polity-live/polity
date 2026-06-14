import type { Emoji } from '@platejs/emoji';
import { insertEmoji } from '@platejs/emoji';
import type { PlateElementProps } from 'platejs/react';
import { PlateElement } from 'platejs/react';

import { translate as translateText } from '@/features/shared/hooks/use-translation';
import {
  InlineCombobox,
  InlineComboboxContent,
  InlineComboboxEmpty,
  InlineComboboxGroup,
  InlineComboboxInput,
  InlineComboboxItem,
} from '@/features/shared/ui/rich-text';

interface EmojiInputElementViewProps extends PlateElementProps {
  value: string;
  setValue: (value: string) => void;
  isPending: boolean;
  filteredEmojis: Emoji[];
}

export function EmojiInputElementView({
  value,
  setValue,
  isPending,
  filteredEmojis,
  ...props
}: EmojiInputElementViewProps) {
  const { children, editor, element } = props;

  return (
    <PlateElement as="span" {...props}>
      <InlineCombobox
        value={value}
        element={element}
        filter={false}
        setValue={setValue}
        trigger=":"
        hideWhenNoValue
      >
        <InlineComboboxInput />

        <InlineComboboxContent>
          {!isPending && (
            <InlineComboboxEmpty>
              {translateText('generated.inline.1147_no_results_b993b0c5')}
            </InlineComboboxEmpty>
          )}

          <InlineComboboxGroup>
            {filteredEmojis.map((emoji: any) => (
              <InlineComboboxItem
                key={emoji.id}
                value={emoji.name}
                onClick={() => insertEmoji(editor, emoji)}
              >
                {emoji.skins[0].native} {emoji.name}
              </InlineComboboxItem>
            ))}
          </InlineComboboxGroup>
        </InlineComboboxContent>
      </InlineCombobox>

      {children}
    </PlateElement>
  );
}
