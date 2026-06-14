'use client';

import { useState, useRef, useEffect } from 'react';
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
export function useHashtagInputController({
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
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const trimmed = inputValue.trim().replace(/^#/, '');
  const filteredSuggestions = trimmed
    ? suggestions.filter(s => s.toLowerCase().includes(trimmed.toLowerCase()) && !value.includes(s))
    : suggestions.filter(s => !value.includes(s));
  const resolvedInputId = inputId ?? 'hashtag-input';

  const addHashtag = (tag?: string) => {
    const tagToAdd = tag ?? trimmed;
    if (tagToAdd && !value.includes(tagToAdd)) {
      if (!maxTags || value.length < maxTags) {
        onChange([...value, tagToAdd]);
        setInputValue('');
        setShowSuggestions(false);
        setSelectedIndex(0);
      }
    }
  };

  const removeHashtag = (tag: string) => {
    onChange(value.filter(t => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showSuggestions && filteredSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, filteredSuggestions.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        addHashtag(filteredSuggestions[selectedIndex]);
        return;
      }
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      addHashtag();
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      onChange(value.slice(0, -1));
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  return {
    value,
    onChange,
    label,
    showLabel,
    placeholder,
    maxTags,
    suggestions,
    inputId,
    inputClassName,
    inputValue,
    setInputValue,
    showSuggestions,
    setShowSuggestions,
    selectedIndex,
    setSelectedIndex,
    containerRef,
    trimmed,
    filteredSuggestions,
    resolvedInputId,
    addHashtag,
    removeHashtag,
    handleKeyDown,
  };
}
