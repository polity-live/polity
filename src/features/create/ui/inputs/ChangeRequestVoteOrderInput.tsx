import { ArrowUp01, ArrowUpAZ, Hash } from 'lucide-react';
import {
  DEFAULT_CHANGE_REQUEST_VOTE_ORDER,
  normalizeChangeRequestVoteOrder,
  type ChangeRequestVoteOrder,
} from '@/features/change-requests/logic/changeRequestVoteOrder';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { FormControlLabel } from '@/features/shared/ui/form';
import { FilterToggleGroupItem } from '@/features/shared/ui/filter-controls';
import { ToggleGroup } from '@/features/shared/ui/ui/toggle-group';
import { cn } from '@/features/shared/utils/utils';

interface ChangeRequestVoteOrderInputProps {
  value?: ChangeRequestVoteOrder | null;
  onChange: (value: ChangeRequestVoteOrder) => void;
  className?: string;
}

export function ChangeRequestVoteOrderInput({
  value = DEFAULT_CHANGE_REQUEST_VOTE_ORDER,
  onChange,
  className,
}: ChangeRequestVoteOrderInputProps) {
  const { t } = useTranslation();
  const normalizedValue = normalizeChangeRequestVoteOrder(value);

  const handleValueChange = (nextValue: string) => {
    if (!nextValue) return;
    onChange(normalizeChangeRequestVoteOrder(nextValue));
  };

  return (
    <div className={cn('space-y-2', className)}>
      <FormControlLabel>
        {t(
          'features.events.agenda.changeRequestVoteOrder.settingsLabel',
          'Change request voting order'
        )}
      </FormControlLabel>
      <ToggleGroup
        type="single"
        value={normalizedValue}
        onValueChange={handleValueChange}
        className="justify-start"
        aria-label={t(
          'features.events.agenda.changeRequestVoteOrder.settingsLabel',
          'Change request voting order'
        )}
      >
        <FilterToggleGroupItem
          value="text_position"
          size="sm"
          className="h-8 px-2"
          title={t('features.events.agenda.changeRequestVoteOrder.textPosition', 'Text position')}
          data-create-option="text_position"
          aria-label={t(
            'features.events.agenda.changeRequestVoteOrder.textPosition',
            'Text position'
          )}
        >
          <ArrowUpAZ className="h-4 w-4" />
          <span className="font-mono text-xs font-semibold">A-Z</span>
        </FilterToggleGroupItem>
        <FilterToggleGroupItem
          value="changed_character_count"
          size="sm"
          className="h-8 px-2"
          title={t(
            'features.events.agenda.changeRequestVoteOrder.changedCharacters',
            'Changed characters'
          )}
          data-create-option="changed_character_count"
          aria-label={t(
            'features.events.agenda.changeRequestVoteOrder.changedCharacters',
            'Changed characters'
          )}
        >
          <Hash className="h-4 w-4" />
          <span className="font-mono text-xs font-semibold">Chars</span>
        </FilterToggleGroupItem>
        <FilterToggleGroupItem
          value="cr_number"
          size="sm"
          className="h-8 px-2"
          title={t('features.events.agenda.changeRequestVoteOrder.crNumber', 'CR number')}
          data-create-option="cr_number"
          aria-label={t('features.events.agenda.changeRequestVoteOrder.crNumber', 'CR number')}
        >
          <ArrowUp01 className="h-4 w-4" />
          <span className="font-mono text-xs font-semibold">1-9</span>
        </FilterToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
