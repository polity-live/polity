import { Check, ChevronsUpDown, X } from 'lucide-react';

import { Button } from '@/features/shared/ui/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/features/shared/ui/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/features/shared/ui/ui/popover';

import type { PqlComboboxOption } from './PqlCombobox';

interface PqlComboboxViewProps {
  value?: string;
  options: readonly PqlComboboxOption[];
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  disabled: boolean;
  allowClear: boolean;
  open: boolean;
  query: string;
  selectedOption?: PqlComboboxOption;
  filteredOptions: readonly PqlComboboxOption[];
  onClearSelection: () => void;
  onOpenChange: (open: boolean) => void;
  onQueryChange: (query: string) => void;
  onSelectOption: (value: string) => void;
}

export function PqlComboboxView({
  value,
  placeholder,
  searchPlaceholder,
  emptyText,
  disabled,
  allowClear,
  open,
  query,
  selectedOption,
  filteredOptions,
  onClearSelection,
  onOpenChange,
  onQueryChange,
  onSelectOption,
}: PqlComboboxViewProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          className="w-full justify-between"
          disabled={disabled}
        >
          <span className="truncate text-left">{selectedOption?.label ?? placeholder}</span>
          <div className="ml-2 flex items-center gap-1">
            {allowClear && selectedOption ? (
              <span
                role="button"
                tabIndex={0}
                className="hover:bg-muted rounded-sm p-0.5"
                onClick={event => {
                  event.preventDefault();
                  event.stopPropagation();
                  onClearSelection();
                }}
                onKeyDown={event => {
                  if (event.key !== 'Enter' && event.key !== ' ') {
                    return;
                  }

                  event.preventDefault();
                  onClearSelection();
                }}
              >
                <X className="h-3.5 w-3.5" />
              </span>
            ) : null}
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={onQueryChange}
            placeholder={searchPlaceholder}
          />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {filteredOptions.map((option: any) => {
                const isSelected = option.value === value;
                return (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={() => onSelectOption(option.value)}
                  >
                    <span className="flex-1 truncate">{option.label}</span>
                    {isSelected ? <Check className="text-primary ml-2 h-4 w-4" /> : null}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
