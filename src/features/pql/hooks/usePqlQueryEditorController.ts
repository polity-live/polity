import type { ChangeEvent, KeyboardEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { PqlFieldDefinition } from '../logic/applyPqlFilter';
import {
  applyPqlSuggestion,
  getPqlSuggestions,
  type PqlSuggestion,
} from '../logic/pqlQueryLanguage';

interface UsePqlQueryEditorControllerOptions<TItem, TFieldKey extends string> {
  fields: readonly PqlFieldDefinition<TItem, TFieldKey>[];
  value: string;
  onChange: (value: string) => void;
}

export function usePqlQueryEditorController<TItem, TFieldKey extends string>({
  fields,
  value,
  onChange,
}: UsePqlQueryEditorControllerOptions<TItem, TFieldKey>) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const blurTimeoutRef = useRef<number | null>(null);
  const [cursorPosition, setCursorPosition] = useState(value.length);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);

  useEffect(() => {
    setCursorPosition(currentPosition => Math.min(currentPosition, value.length));
  }, [value]);

  useEffect(
    () => () => {
      if (blurTimeoutRef.current !== null) {
        window.clearTimeout(blurTimeoutRef.current);
      }
    },
    []
  );

  const suggestions = useMemo(
    () =>
      suggestionsOpen
        ? getPqlSuggestions(value, cursorPosition, fields).slice(0, 8)
        : ([] as PqlSuggestion[]),
    [cursorPosition, fields, suggestionsOpen, value]
  );

  useEffect(() => {
    if (selectedSuggestionIndex < suggestions.length) {
      return;
    }

    setSelectedSuggestionIndex(0);
  }, [selectedSuggestionIndex, suggestions.length]);

  const syncCursorPosition = () => {
    const nextCursorPosition = textareaRef.current?.selectionStart ?? value.length;
    setCursorPosition(nextCursorPosition);
  };

  const clearBlurTimeout = () => {
    if (blurTimeoutRef.current !== null) {
      window.clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
  };

  const closeSuggestionsSoon = () => {
    clearBlurTimeout();
    blurTimeoutRef.current = window.setTimeout(() => {
      setSuggestionsOpen(false);
    }, 120);
  };

  const handleSuggestionSelect = (suggestion: PqlSuggestion) => {
    clearBlurTimeout();
    const result = applyPqlSuggestion(value, cursorPosition, suggestion);
    onChange(result.value);
    setSuggestionsOpen(true);
    setSelectedSuggestionIndex(0);

    requestAnimationFrame(() => {
      if (!textareaRef.current) {
        return;
      }

      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(result.caretPosition, result.caretPosition);
      setCursorPosition(result.caretPosition);
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (suggestions.length === 0) {
      if (event.key === 'ArrowDown') {
        const nextSuggestions = getPqlSuggestions(value, cursorPosition, fields);
        if (nextSuggestions.length > 0) {
          setSuggestionsOpen(true);
          setSelectedSuggestionIndex(0);
          event.preventDefault();
        }
      }

      return;
    }

    if (event.key === 'ArrowDown') {
      setSelectedSuggestionIndex(currentIndex =>
        currentIndex >= suggestions.length - 1 ? 0 : currentIndex + 1
      );
      event.preventDefault();
      return;
    }

    if (event.key === 'ArrowUp') {
      setSelectedSuggestionIndex(currentIndex =>
        currentIndex <= 0 ? suggestions.length - 1 : currentIndex - 1
      );
      event.preventDefault();
      return;
    }

    if (event.key === 'Enter' || event.key === 'Tab') {
      const selectedSuggestion = suggestions[selectedSuggestionIndex];
      if (selectedSuggestion) {
        handleSuggestionSelect(selectedSuggestion);
        event.preventDefault();
      }
      return;
    }

    if (event.key === 'Escape') {
      setSuggestionsOpen(false);
    }
  };

  return {
    onBlur: closeSuggestionsSoon,
    onChange: (event: ChangeEvent<HTMLTextAreaElement>) => {
      onChange(event.target.value);
      setCursorPosition(event.target.selectionStart ?? event.target.value.length);
      setSuggestionsOpen(true);
      setSelectedSuggestionIndex(0);
    },
    onClick: syncCursorPosition,
    onFocus: () => {
      clearBlurTimeout();
      syncCursorPosition();
      setSuggestionsOpen(true);
    },
    onKeyDown: handleKeyDown,
    onKeyUp: syncCursorPosition,
    onSelect: syncCursorPosition,
    onSuggestionHover: setSelectedSuggestionIndex,
    onSuggestionSelect: handleSuggestionSelect,
    selectedSuggestionIndex,
    suggestions,
    suggestionsOpen,
    textareaRef,
  };
}
