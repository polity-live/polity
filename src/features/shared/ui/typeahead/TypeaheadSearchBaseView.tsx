'use client';

import { createPortal } from 'react-dom';
import { Search } from 'lucide-react';
import { type TypeaheadItem } from '@/features/shared/logic/typeaheadHelpers';
import { Input } from '@/features/shared/ui/ui/input';
import { cn } from '@/features/shared/utils/utils';
import { TypeaheadDropdown } from './TypeaheadDropdown';
import { TypeaheadSelectedCard } from './TypeaheadSelectedCard';

export interface TypeaheadSearchBaseViewProps {
  className: any;
  containerRef: any;
  disablePortal: any;
  dropdownPortalRef: any;
  dropdownStyle: any;
  handleKeyDown: any;
  handleRemoveSelection: any;
  handleSelect: any;
  inputRef: any;
  inputWrapperRef: any;
  isOpen: any;
  label: any;
  multiple: any;
  onInteract: any;
  placeholder: any;
  portalTarget: any;
  query: any;
  selectedIndex: any;
  selectedItem: any;
  selectedItems: any;
  setIsOpen: any;
  setQuery: any;
  setSelectedIndex: any;
  visibleResults: any;
}

export function TypeaheadSearchBaseView({
  className,
  containerRef,
  disablePortal,
  dropdownPortalRef,
  dropdownStyle,
  handleKeyDown,
  handleRemoveSelection,
  handleSelect,
  inputRef,
  inputWrapperRef,
  isOpen,
  label,
  multiple,
  onInteract,
  placeholder,
  portalTarget,
  query,
  selectedIndex,
  selectedItem,
  selectedItems,
  setIsOpen,
  setQuery,
  setSelectedIndex,
  visibleResults,
}: TypeaheadSearchBaseViewProps) {
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
        ) : portalTarget ? (
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
            portalTarget
          )
        ) : null)}
    </div>
  );
}
