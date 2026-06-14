import { FormControlCheckbox } from '@/features/shared/ui/form';
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
import { ToggleGroup, ToggleGroupItem } from '@/features/shared/ui/ui/toggle-group';
import { Layers, Filter, Check } from 'lucide-react';

type FilterMode = 'select' | 'choice';

interface SuggestionViewToggleViewProps {
  selectedCrIds: Set<string> | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filterMode: FilterMode;
  crOptions: { crId: string; title: string; userId?: string | null }[];
  isFiltered: boolean;
  buttonLabel: string;
  allSelected: boolean;
  labels: {
    selectMode: string;
    choiceMode: string;
    searchPlaceholder: string;
    noResults: string;
    allSuggestions: string;
    deselectAll: string;
    selectAll: string;
  };
  onModeChange: (mode: string) => void;
  onSelectCr: (crId: string | null) => void;
  onToggleCr: (crId: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

export function SuggestionViewToggleView({
  selectedCrIds,
  open,
  onOpenChange,
  filterMode,
  crOptions,
  isFiltered,
  buttonLabel,
  allSelected,
  labels,
  onModeChange,
  onSelectCr,
  onToggleCr,
  onSelectAll,
  onDeselectAll,
}: SuggestionViewToggleViewProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant={isFiltered ? 'default' : 'outline'} size="sm" className="gap-2">
          {isFiltered ? <Filter className="h-4 w-4" /> : <Layers className="h-4 w-4" />}
          {buttonLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="end">
        <div className="border-b px-3 py-2">
          <ToggleGroup
            type="single"
            value={filterMode}
            onValueChange={onModeChange}
            size="sm"
            className="w-full"
          >
            <ToggleGroupItem value="select" className="flex-1 text-xs">
              {labels.selectMode}
            </ToggleGroupItem>
            <ToggleGroupItem value="choice" className="flex-1 text-xs">
              {labels.choiceMode}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {filterMode === 'select' ? (
          <Command>
            <CommandInput placeholder={labels.searchPlaceholder} />
            <CommandList>
              <CommandEmpty>{labels.noResults}</CommandEmpty>
              <CommandGroup>
                <CommandItem onSelect={() => onSelectCr(null)}>
                  <Layers className="mr-2 h-4 w-4" />
                  {labels.allSuggestions}
                  {selectedCrIds === null && <Check className="ml-auto h-4 w-4" />}
                </CommandItem>
                {crOptions.map((option: any) => (
                  <CommandItem key={option.crId} onSelect={() => onSelectCr(option.crId)}>
                    <Filter className="mr-2 h-4 w-4" />
                    <div className="flex flex-col">
                      <span className="font-mono text-sm">{option.crId}</span>
                      {option.title !== option.crId && (
                        <span className="text-muted-foreground text-xs">{option.title}</span>
                      )}
                    </div>
                    {selectedCrIds?.has(option.crId) && <Check className="ml-auto h-4 w-4" />}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        ) : (
          <Command>
            <CommandInput placeholder={labels.searchPlaceholder} />
            <CommandList>
              <CommandEmpty>{labels.noResults}</CommandEmpty>
              <CommandGroup>
                <CommandItem onSelect={allSelected ? onDeselectAll : onSelectAll}>
                  <FormControlCheckbox checked={allSelected} className="mr-2" tabIndex={-1} />
                  {allSelected ? labels.deselectAll : labels.selectAll}
                </CommandItem>
                {crOptions.map((option: any) => {
                  const isChecked = selectedCrIds?.has(option.crId) ?? false;
                  return (
                    <CommandItem key={option.crId} onSelect={() => onToggleCr(option.crId)}>
                      <FormControlCheckbox checked={isChecked} className="mr-2" tabIndex={-1} />
                      <div className="flex flex-col">
                        <span className="font-mono text-sm">{option.crId}</span>
                        {option.title !== option.crId && (
                          <span className="text-muted-foreground text-xs">{option.title}</span>
                        )}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        )}
      </PopoverContent>
    </Popover>
  );
}
