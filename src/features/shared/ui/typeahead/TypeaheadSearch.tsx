'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search } from 'lucide-react';
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
import { Input } from '@/features/shared/ui/ui/input';
import { cn } from '@/features/shared/utils/utils';
import { TypeaheadDropdown } from './TypeaheadDropdown';
import { TypeaheadSelectedCard } from './TypeaheadSelectedCard';

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

type TypeaheadSearchBaseComponentProps = TypeaheadSearchProps & {
  query: string;
  setQuery: (value: string) => void;
  sourceItems: readonly TypeaheadItem[];
  searchResults: readonly TypeaheadItem[];
};

export function TypeaheadSearch(props: TypeaheadSearchProps) {
  if (props.items) {
    return <TypeaheadSearchWithItems {...props} />;
  }

  return <TypeaheadSearchWithData {...props} />;
}

function TypeaheadSearchWithItems(props: TypeaheadSearchProps) {
  const [query, setQuery] = useState('');
  const sourceItems = props.items ?? [];
  const searchResults = useMemo(() => {
    const filteredItems = filterItems(sourceItems, query, DEFAULT_TYPEAHEAD_SEARCH_KEYS);
    return sortByRelevance(filteredItems, query);
  }, [query, sourceItems]);

  return (
    <TypeaheadSearchBase
      {...props}
      query={query}
      setQuery={setQuery}
      sourceItems={sourceItems}
      searchResults={searchResults}
    />
  );
}

function TypeaheadSearchWithData(props: TypeaheadSearchProps) {
  const { entityTypes = [] } = props;
  const { query, setQuery, items: sourceItems, results } = useTypeaheadSearch({ entityTypes });

  return (
    <TypeaheadSearchBase
      {...props}
      query={query}
      setQuery={setQuery}
      sourceItems={sourceItems}
      searchResults={results}
    />
  );
}

function TypeaheadSearchBase(props: TypeaheadSearchBaseComponentProps) {
  const {
    onInteract,
    placeholder = 'Search...',
    filterFn,
    className,
    label,
    disablePortal = false,
    showAllResults = false,
    showAllOnFocus = false,
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
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

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
      setDropdownStyle({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
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
  }, [disablePortal, isOpen]);

  const handleSelect = useCallback(
    (item: TypeaheadItem) => {
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
    [multiValues, multiple, onInteract, onMultiChange, onSingleChange, setQuery]
  );

  const handleRemoveSelection = useCallback(
    (itemId: string) => {
      onInteract?.();
      if (multiple) {
        onMultiChange?.(removeTypeaheadValue(multiValues, itemId));
      } else if (onSingleChange) {
        onSingleChange(null);
        setQuery('');
      }
    },
    [multiValues, multiple, onInteract, onMultiChange, onSingleChange, setQuery]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
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
    [handleSelect, isOpen, selectedIndex, visibleResults]
  );

  const dropdownContent = (
    <TypeaheadDropdown
      results={visibleResults}
      query={query}
      selectedIndex={selectedIndex}
      onSelect={handleSelect}
      onHoverIndex={setSelectedIndex}
    />
  );

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      className={cn(
        'relative outline-none',
        multiple && selectedItems.length > 0 && 'space-y-3',
        className
      )}
    >
      {label ? <label className="mb-2 block text-sm font-medium">{label}</label> : null}

      {selectedItem && !isOpen ? (
        <TypeaheadSelectedCard
          item={selectedItem}
          variant="compact"
          onRemove={() => handleRemoveSelection(selectedItem.id)}
          onClick={() => {
            onInteract?.();
            setIsOpen(true);
          }}
        />
      ) : (
        <div ref={inputWrapperRef} className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            ref={inputRef}
            placeholder={placeholder}
            value={query}
            onChange={event => {
              onInteract?.();
              setQuery(event.target.value);
              setIsOpen(true);
              setSelectedIndex(0);
            }}
            onFocus={() => {
              onInteract?.();
              setIsOpen(true);
            }}
            onKeyDown={handleKeyDown}
            className="pl-10"
          />
        </div>
      )}

      {multiple && selectedItems.length > 0 ? (
        <div data-slot="typeahead-selected-list" className="space-y-2">
          {selectedItems.map((item: TypeaheadItem) => (
            <TypeaheadSelectedCard
              key={`${item.entityType}:${item.id}`}
              item={item}
              variant="stacked"
              onRemove={() => handleRemoveSelection(item.id)}
              onClick={() => {
                onInteract?.();
                setIsOpen(true);
              }}
            />
          ))}
        </div>
      ) : null}

      {isOpen &&
        (disablePortal ? (
          <div ref={dropdownPortalRef} className="absolute top-full right-0 left-0 z-[9999] mt-1">
            {dropdownContent}
          </div>
        ) : (
          createPortal(
            <div
              ref={dropdownPortalRef}
              data-typeahead-portal
              style={{
                position: 'absolute',
                top: dropdownStyle.top,
                left: dropdownStyle.left,
                width: dropdownStyle.width,
                zIndex: 9999,
              }}
              onPointerDown={event => event.stopPropagation()}
              onMouseDown={event => event.stopPropagation()}
            >
              {dropdownContent}
            </div>,
            document.body
          )
        ))}
    </div>
  );
}
