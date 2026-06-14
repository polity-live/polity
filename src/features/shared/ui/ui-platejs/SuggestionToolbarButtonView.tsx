import { PencilLineIcon } from 'lucide-react';

import { cn } from '@/features/shared/utils/utils.ts';

import { ToolbarButton } from '@/features/shared/ui/layout';
export interface SuggestionToolbarButtonViewProps {
  setOption: any;
  isSuggesting: any;
  t: any;
}

export function SuggestionToolbarButtonView({
  setOption,
  isSuggesting,
  t,
}: SuggestionToolbarButtonViewProps) {
  return (
    <ToolbarButton
      className={cn(isSuggesting && 'text-brand/80 hover:text-brand/80')}
      onClick={() => setOption('isSuggesting', !isSuggesting)}
      onMouseDown={e => e.preventDefault()}
      tooltip={
        isSuggesting ? t('plateJs.toolbar.turnOffSuggesting') : t('plateJs.toolbar.suggestionEdits')
      }
    >
      <PencilLineIcon />
    </ToolbarButton>
  );
}
