import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { Button } from '@/features/shared/ui/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/features/shared/ui/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/features/shared/ui/ui/command';

export interface PqlComboboxOption {
  value: string;
  label: string;
  keywords?: readonly string[];
}

interface PqlComboboxProps {
  value?: string;
  onValueChange: (value: string | undefined) => void;
  options: readonly PqlComboboxOption[];
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  disabled?: boolean;
  allowClear?: boolean;
}

export function PqlCombobox({
  value,
  onValueChange,
  options,
  placeholder,
  searchPlaceholder,
  emptyText,
  disabled = false,
  allowClear = false,
}: PqlComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const normalizedQuery = query.replace(/^@+/, '').trim().toLowerCase();
  const selectedOption = options.find(option => option.value === value);

  const filteredOptions = useMemo(() => {
    if (!normalizedQuery) {
      return options;
    }

    return options.filter(option => {
      const haystack = [option.label, ...(option.keywords ?? [])].join(' ').toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [normalizedQuery, options]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
                  onValueChange(undefined);
                  setQuery('');
                }}
                onKeyDown={event => {
                  if (event.key !== 'Enter' && event.key !== ' ') {
                    return;
                  }

                  event.preventDefault();
                  onValueChange(undefined);
                  setQuery('');
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
          <CommandInput value={query} onValueChange={setQuery} placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {filteredOptions.map(option => {
                const isSelected = option.value === value;
                return (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={() => {
                      onValueChange(option.value);
                      setOpen(false);
                      setQuery('');
                    }}
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
