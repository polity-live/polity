import { BadgeControl } from '@/features/shared/ui/status';
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
import { cn } from '@/features/shared/utils/utils';
import { Check, Eye, Layers } from 'lucide-react';

import type { EditorViewMode } from './EditorViewModeToggle';

interface ChangeRequestOption {
  id: string;
  crId: string;
  title: string;
  type: string;
}

interface EditorViewModeToggleViewProps {
  mode: EditorViewMode;
  selectedCRId: string | null;
  changeRequests: ChangeRequestOption[];
  open: boolean;
  selectedCR?: ChangeRequestOption;
  onModeToggle: () => void;
  onOpenChange: (open: boolean) => void;
  onSelectCR: (crId: string) => void;
}

export function EditorViewModeToggleView({
  mode,
  selectedCRId,
  changeRequests,
  open,
  selectedCR,
  onModeToggle,
  onOpenChange,
  onSelectCR,
}: EditorViewModeToggleViewProps) {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant={mode === 'all' ? 'default' : 'outline'}
        size="sm"
        onClick={onModeToggle}
        className="gap-1.5"
      >
        {mode === 'all' ? (
          <>
            <Layers className="h-3.5 w-3.5" />
            {translateText('generated.inline.0289_all_suggestions_bd02123a')}
          </>
        ) : (
          <>
            <Eye className="h-3.5 w-3.5" />
            {translateText('generated.inline.0290_single_suggestion_8f3a3351')}
          </>
        )}
      </Button>

      {mode === 'single' && (
        <Popover open={open} onOpenChange={onOpenChange}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              {selectedCR ? (
                <>
                  <BadgeControl variant="secondary" size="xs" textStyle="mono">
                    {selectedCR.crId}
                  </BadgeControl>
                  <span className="max-w-[150px] truncate">{selectedCR.title}</span>
                </>
              ) : (
                translateText('generated.inline.0040_select_cr_26009d13')
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[250px] p-0" align="start">
            <Command>
              <CommandInput
                placeholder={translateText('generated.inline.0291_search_change_requests_336c14a7')}
              />
              <CommandList>
                <CommandEmpty>
                  {translateText('generated.inline.0292_no_change_requests_found_05062147')}
                </CommandEmpty>
                <CommandGroup>
                  {changeRequests.map(cr => (
                    <CommandItem
                      key={cr.id}
                      value={`${cr.crId} ${cr.title}`}
                      onSelect={() => onSelectCR(cr.id)}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          selectedCRId === cr.id ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      <BadgeControl variant="secondary" size="xs" textStyle="mono" className="mr-2">
                        {cr.crId}
                      </BadgeControl>
                      <span className="truncate">{cr.title}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
