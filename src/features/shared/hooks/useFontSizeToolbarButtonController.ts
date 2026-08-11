import * as React from 'react';

import { toUnitLess } from '@platejs/basic-styles';
import { FontSizePlugin } from '@platejs/basic-styles/react';
import type { TElement } from 'platejs';
import { KEYS } from 'platejs';
import { useEditorPlugin, useEditorSelector } from 'platejs/react';
import { useTranslation } from '@/features/shared/hooks/use-translation';

const DEFAULT_FONT_SIZE = '16';

const FONT_SIZE_MAP = {
  h1: '36',
  h2: '24',
  h3: '20',
} as const;

const FONT_SIZES = [
  '8',
  '9',
  '10',
  '12',
  '14',
  '16',
  '18',
  '24',
  '30',
  '36',
  '48',
  '60',
  '72',
  '96',
] as const;

export function useFontSizeToolbarButtonController() {
  const [inputValue, setInputValue] = React.useState(DEFAULT_FONT_SIZE);
  const [isFocused, setIsFocused] = React.useState(false);
  const { editor, tf } = useEditorPlugin(FontSizePlugin);
  const { t } = useTranslation();

  const cursorFontSize = useEditorSelector(editor => {
    const fontSize = editor.api.marks()?.[KEYS.fontSize];

    if (fontSize) {
      return toUnitLess(fontSize as string);
    }

    const [block] = editor.api.block<TElement>() || [];

    if (!block?.type) return DEFAULT_FONT_SIZE;

    return block.type in FONT_SIZE_MAP
      ? FONT_SIZE_MAP[block.type as keyof typeof FONT_SIZE_MAP]
      : DEFAULT_FONT_SIZE;
  }, []);

  const displayValue = isFocused ? inputValue : cursorFontSize;

  const handleInputChange = () => {
    const newSize = toUnitLess(inputValue);

    if (Number.parseInt(newSize) < 1 || Number.parseInt(newSize) > 100) {
      editor.tf.focus();
      return;
    }

    if (newSize !== toUnitLess(cursorFontSize)) {
      tf.fontSize.addMark(`${newSize}px`);
    }

    editor.tf.focus();
  };

  const handleFontSizeChange = (delta: number) => {
    const newSize = Number(displayValue) + delta;
    tf.fontSize.addMark(`${newSize}px`);
    editor.tf.focus();
  };

  const handleSelectFontSize = (size: string) => {
    tf.fontSize.addMark(`${size}px`);
    setIsFocused(false);
  };

  return {
    displayValue,
    fontSizes: FONT_SIZES,
    isFocused,
    label: t('plateJs.toolbar.fontSize'),
    onBlur: () => {
      setIsFocused(false);
      handleInputChange();
    },
    onDecrease: () => handleFontSizeChange(-1),
    onFocus: () => {
      setIsFocused(true);
      setInputValue(toUnitLess(cursorFontSize));
    },
    onIncrease: () => handleFontSizeChange(1),
    onInputChange: setInputValue,
    onInputCommit: handleInputChange,
    onSelectFontSize: handleSelectFontSize,
  };
}
