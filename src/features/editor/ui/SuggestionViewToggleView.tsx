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
  crOptions: {
    crId: string;
    displayCrId: string;
    title: string;
    userId: string;
    aliases: string[];
  }[];
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

function isOptionSelected(
  selectedCrIds: Set<string> | null,
  option: SuggestionViewToggleViewProps['crOptions'][number]
) {
  return Boolean(selectedCrIds && option.aliases.some(alias => selectedCrIds.has(alias)));
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
        <Button
          variant={isFiltered ? 'default' : 'outline'}
          size="sm"
          className="gap-2"
          data-action-id="editor.suggestion-filter.open"
        >
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
            <ToggleGroupItem
              value="select"
              className="flex-1 text-xs"
              data-action-id="editor.suggestion-filter.mode.select"
            >
              {labels.selectMode}
            </ToggleGroupItem>
            <ToggleGroupItem
              value="choice"
              className="flex-1 text-xs"
              data-action-id="editor.suggestion-filter.mode.choice"
            >
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
                <CommandItem
                  data-action-id="editor.suggestion-filter.selection.clear"
                  onSelect={() => onSelectCr(null)}
                >
                  <Layers className="mr-2 h-4 w-4" />
                  {labels.allSuggestions}
                  {selectedCrIds === null && <Check className="ml-auto h-4 w-4" />}
                </CommandItem>
                {crOptions.map(option => (
                  <CommandItem
                    key={option.crId}
                    data-action-id="editor.suggestion-filter.selection.select"
                    onSelect={() => onSelectCr(option.crId)}
                  >
                    <Filter className="mr-2 h-4 w-4" />
                    <div className="flex flex-col">
                      <span className="font-mono text-sm">{option.displayCrId ?? option.crId}</span>
                      {option.title !== (option.displayCrId ?? option.crId) && (
                        <span className="text-muted-foreground text-xs">{option.title}</span>
                      )}
                    </div>
                    {isOptionSelected(selectedCrIds, option) && (
                      <Check className="ml-auto h-4 w-4" />
                    )}
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
                <CommandItem
                  data-action-id="editor.suggestion-filter.choice.toggle-all"
                  onSelect={allSelected ? onDeselectAll : onSelectAll}
                >
                  <span
                    aria-hidden="true"
                    className="border-primary mr-2 inline-flex size-4 items-center justify-center rounded border"
                  >
                    {allSelected ? <Check className="size-3" /> : null}
                  </span>
                  {allSelected ? labels.deselectAll : labels.selectAll}
                </CommandItem>
                {crOptions.map(option => {
                  const isChecked = isOptionSelected(selectedCrIds, option);
                  return (
                    <CommandItem
                      key={option.crId}
                      data-action-id="editor.suggestion-filter.choice.toggle"
                      onSelect={() => onToggleCr(option.crId)}
                    >
                      <span
                        aria-hidden="true"
                        className="border-primary mr-2 inline-flex size-4 items-center justify-center rounded border"
                      >
                        {isChecked ? <Check className="size-3" /> : null}
                      </span>
                      <div className="flex flex-col">
                        <span className="font-mono text-sm">
                          {option.displayCrId ?? option.crId}
                        </span>
                        {option.title !== (option.displayCrId ?? option.crId) && (
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
