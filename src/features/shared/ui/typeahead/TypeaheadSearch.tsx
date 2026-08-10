'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTypeaheadSearch } from '@/features/shared/hooks/useTypeaheadSearch';
import {
  addUniqueTypeaheadValue,
  DEFAULT_TYPEAHEAD_SEARCH_KEYS,
  filterItems,
  removeTypeaheadValue,
  sortByRelevance,
  type EntityType,
  type TypeaheadItem,
} from '@/features/shared/logic/typeaheadHelpers';
import { TypeaheadSearchBaseView } from './TypeaheadSearchBaseView';

interface TypeaheadSearchBaseProps {
  entityTypes?: EntityType[];
  onInteract?: () => void;
  placeholder?: string;
  filterFn?: (item: TypeaheadItem) => boolean;
  /** When provided, these items are used instead of the internal search hook results. */
  items?: readonly TypeaheadItem[];
  className?: string;
  label?: string;
  /** Render dropdown inline instead of via portal. Use inside dialogs where portals escape the focus trap. */
  disablePortal?: boolean;
  /** Render all filtered results instead of truncating the list to the default preview size. */
  showAllResults?: boolean;
  /** When true, opening the field with an empty query shows all available items immediately. */
  showAllOnFocus?: boolean;
  disabled?: boolean;
  ariaRequired?: boolean;
}

export interface TypeaheadSingleProps extends TypeaheadSearchBaseProps {
  multiple?: false;
  value?: string;
  onChange: (item: TypeaheadItem | null) => void;
  values?: never;
  onValuesChange?: never;
}

export interface TypeaheadMultiProps extends TypeaheadSearchBaseProps {
  multiple: true;
  values: readonly string[];
  onValuesChange: (nextIds: string[]) => void;
  value?: never;
  onChange?: never;
}

export type TypeaheadSearchProps = TypeaheadSingleProps | TypeaheadMultiProps;
export type TypeaheadComboboxProps = TypeaheadSearchProps & {
  items: readonly TypeaheadItem[];
};

type TypeaheadSearchBaseComponentProps = TypeaheadSearchProps & {
  query: string;
  setQuery: (value: string) => void;
  sourceItems: readonly TypeaheadItem[];
  searchResults: readonly TypeaheadItem[];
};

export function TypeaheadSearch(props: TypeaheadSearchProps) {
  if (props.items) {
    return <TypeaheadCombobox {...props} items={props.items} />;
  }

  return <TypeaheadSearchWithData {...props} />;
}

export function TypeaheadCombobox(props: TypeaheadComboboxProps) {
  const [query, setQuery] = useState('');
  const sourceItems = props.items;
  const searchResults = useMemo(() => {
    const filteredItems = filterItems(sourceItems, query, DEFAULT_TYPEAHEAD_SEARCH_KEYS);
    return sortByRelevance(filteredItems, query);
  }, [query, sourceItems]);

  return (
    <TypeaheadSearchBaseContainer
      {...props}
      query={query}
      setQuery={setQuery}
      sourceItems={sourceItems}
      searchResults={searchResults}
    />
  );
}

export function TypeaheadSearchWithData(props: TypeaheadSearchProps) {
  const { entityTypes = [] } = props;
  const { query, setQuery, items: sourceItems, results } = useTypeaheadSearch({ entityTypes });

  return (
    <TypeaheadSearchBaseContainer
      {...props}
      query={query}
      setQuery={setQuery}
      sourceItems={sourceItems}
      searchResults={results}
    />
  );
}

export function TypeaheadSearchBaseContainer(props: TypeaheadSearchBaseComponentProps) {
  const {
    onInteract,
    placeholder = 'Search...',
    filterFn,
    className,
    label,
    disablePortal = false,
    showAllResults = false,
    showAllOnFocus = false,
    disabled = false,
    ariaRequired = false,
    query,
    setQuery,
    sourceItems,
    searchResults,
  } = props;
  const multiple = props.multiple === true;
  const selectedIds = multiple ? props.values : props.value ? [props.value] : [];
  const singleValue = multiple ? undefined : props.value;
  const onSingleChange = multiple ? undefined : props.onChange;
  const multiValues = multiple ? props.values : [];
  const onMultiChange = multiple ? props.onValuesChange : undefined;
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [knownItems, setKnownItems] = useState<Record<string, TypeaheadItem>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const inputWrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownPortalRef = useRef<HTMLDivElement>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [dropdownStyle, setDropdownStyle] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 0,
  });

  useEffect(() => {
    if (sourceItems.length === 0) {
      return;
    }

    setKnownItems(currentItems => {
      let hasChanges = false;
      const nextItems = { ...currentItems };

      for (const item of sourceItems) {
        const existingItem = nextItems[item.id];
        if (
          !existingItem ||
          existingItem.label !== item.label ||
          existingItem.secondaryLabel !== item.secondaryLabel ||
          existingItem.description !== item.description ||
          existingItem.avatar !== item.avatar ||
          existingItem.url !== item.url
        ) {
          nextItems[item.id] = item;
          hasChanges = true;
        }
      }

      return hasChanges ? nextItems : currentItems;
    });
  }, [sourceItems]);

  const itemLookup = useMemo(() => {
    const nextLookup = new Map<string, TypeaheadItem>();

    // First, use all source items - these are the most fresh
    for (const item of sourceItems) {
      nextLookup.set(item.id, item);
    }

    // Then, add known items if they are not in source items
    for (const [id, item] of Object.entries(knownItems)) {
      if (!nextLookup.has(id)) {
        nextLookup.set(id, item);
      }
    }

    return nextLookup;
  }, [knownItems, sourceItems]);

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedItems = useMemo(
    () =>
      selectedIds
        .map((id: string) => itemLookup.get(id))
        .filter((item): item is TypeaheadItem => Boolean(item)),
    [itemLookup, selectedIds]
  );
  const filteredResults = useMemo(() => {
    const baseItems = showAllOnFocus && query.trim().length === 0 ? sourceItems : searchResults;
    const baseResults = filterFn ? baseItems.filter(filterFn) : baseItems;
    return multiple
      ? baseResults.filter((item: TypeaheadItem) => !selectedIdSet.has(item.id))
      : baseResults;
  }, [filterFn, multiple, query, searchResults, selectedIdSet, showAllOnFocus, sourceItems]);
  const visibleResults = useMemo(
    () => (showAllResults ? filteredResults : filteredResults.slice(0, 20)),
    [filteredResults, showAllResults]
  );
  const selectedItem = multiple ? null : singleValue ? (selectedItems[0] ?? null) : null;

  useEffect(() => {
    setSelectedIndex(currentIndex =>
      visibleResults.length === 0 ? 0 : Math.min(currentIndex, visibleResults.length - 1)
    );
  }, [visibleResults.length]);

  useEffect(() => {
    if (disabled) {
      setIsOpen(false);
      return;
    }

    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [disabled, isOpen]);

  useLayoutEffect(() => {
    if (disablePortal) {
      setPortalTarget(null);
      return;
    }

    const container = containerRef.current;
    if (!container) {
      setPortalTarget(document.body);
      return;
    }

    const dialogContent = container.closest('[data-slot="dialog-content"]');
    setPortalTarget(dialogContent instanceof HTMLElement ? dialogContent : document.body);
  }, [disablePortal]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedInsideContainer = containerRef.current?.contains(target);
      const clickedInsideDropdown = dropdownPortalRef.current?.contains(target);

      if (!clickedInsideContainer && !clickedInsideDropdown) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useLayoutEffect(() => {
    if (!isOpen || disablePortal) return;

    const update = () => {
      const element = inputWrapperRef.current ?? containerRef.current;
      if (!element) return;
      const rect = element.getBoundingClientRect();
      // Portal selection is finalized by the preceding layout effect before the menu can open.
      const target = portalTarget;
      if (!target) return;

      if (target === document.body) {
        setDropdownStyle({
          top: rect.bottom + window.scrollY + 4,
          left: rect.left + window.scrollX,
          width: rect.width,
        });
        return;
      }

      const targetRect = target.getBoundingClientRect();
      setDropdownStyle({
        top: rect.bottom - targetRect.top + 4,
        left: rect.left - targetRect.left,
        width: rect.width,
      });
    };

    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [disablePortal, isOpen, portalTarget]);

  const handleSelect = useCallback(
    (item: TypeaheadItem) => {
      if (disabled) {
        return;
      }

      onInteract?.();

      // Add to known items to ensure it stays available during re-renders
      setKnownItems(prev => ({ ...prev, [item.id]: item }));

      if (multiple) {
        onMultiChange?.(addUniqueTypeaheadValue(multiValues, item.id));
      } else if (onSingleChange) {
        onSingleChange(item);
      }
      setIsOpen(false);
      setQuery('');
      setSelectedIndex(0);

      // After selection, keep focus on the container to prevent focus loss and potential scrolling
      setTimeout(() => {
        containerRef.current?.focus();
      }, 0);
    },
    [disabled, multiValues, multiple, onInteract, onMultiChange, onSingleChange, setQuery]
  );

  const handleRemoveSelection = useCallback(
    (itemId: string) => {
      if (disabled) {
        return;
      }

      onInteract?.();
      if (multiple) {
        onMultiChange?.(removeTypeaheadValue(multiValues, itemId));
      } else if (onSingleChange) {
        onSingleChange(null);
        setQuery('');
      }
    },
    [disabled, multiValues, multiple, onInteract, onMultiChange, onSingleChange, setQuery]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (disabled) {
        return;
      }

      if (!isOpen && (event.key === 'ArrowDown' || event.key === 'Enter')) {
        setIsOpen(true);
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex(currentIndex => Math.min(currentIndex + 1, visibleResults.length - 1));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex(currentIndex => Math.max(currentIndex - 1, 0));
      } else if (event.key === 'Enter' && visibleResults[selectedIndex]) {
        event.preventDefault();
        handleSelect(visibleResults[selectedIndex]);
      } else if (event.key === 'Escape') {
        setIsOpen(false);
      }
    },
    [disabled, handleSelect, isOpen, selectedIndex, visibleResults]
  );

  return (
    <TypeaheadSearchBaseView
      className={className}
      containerRef={containerRef}
      disablePortal={disablePortal}
      disabled={disabled}
      dropdownPortalRef={dropdownPortalRef}
      dropdownStyle={dropdownStyle}
      handleKeyDown={handleKeyDown}
      handleRemoveSelection={handleRemoveSelection}
      handleSelect={handleSelect}
      inputRef={inputRef}
      inputWrapperRef={inputWrapperRef}
      isOpen={isOpen}
      label={label}
      multiple={multiple}
      onInteract={onInteract}
      placeholder={placeholder}
      portalTarget={portalTarget}
      query={query}
      selectedIndex={selectedIndex}
      selectedItem={selectedItem}
      selectedItems={selectedItems}
      ariaRequired={ariaRequired}
      setIsOpen={setIsOpen}
      setQuery={setQuery}
      setSelectedIndex={setSelectedIndex}
      visibleResults={visibleResults}
    />
  );
}
