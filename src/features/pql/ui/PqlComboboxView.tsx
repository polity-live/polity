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
import { translate as translateText } from '@/features/shared/hooks/use-translation';

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
      <div className="flex w-full gap-1">
        <PopoverTrigger asChild>
          <Button
            type="button"
            data-action-id="pql.combobox.open"
            variant="outline"
            role="combobox"
            className="min-w-0 flex-1 justify-between"
            disabled={disabled}
          >
            <span className="truncate text-left">{selectedOption?.label ?? placeholder}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        {allowClear && selectedOption ? (
          <Button
            type="button"
            data-action-id="pql.combobox.selection.clear"
            variant="ghost"
            size="icon"
            aria-label={translateText('common.accessibility.removeNamed', {
              name: selectedOption.label,
            })}
            className="shrink-0"
            disabled={disabled}
            onClick={onClearSelection}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>
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
                    data-action-id="pql.combobox.option.select"
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
