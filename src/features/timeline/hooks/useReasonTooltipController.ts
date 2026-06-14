import { useState } from 'react';

import { useTranslation } from '@/features/shared/hooks/use-translation';

import { getReasonConfig, type ReasonCategory } from '../logic/reasonDisplay';

interface UseReasonTooltipControllerProps {
  category: ReasonCategory;
  context?: string;
}

export function useReasonTooltipController({ category, context }: UseReasonTooltipControllerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const config = getReasonConfig(category);

  let reasonText = t(config.labelKey);
  if (context && config.contextPrefix) {
    reasonText = `${reasonText} ${config.contextPrefix}${context}`;
  } else if (context) {
    reasonText = `${reasonText}: ${context}`;
  }

  return {
    config,
    open,
    reasonText,
    whySeeingLabel: t('timeline.explore.whySeeing'),
    onOpenChange: setOpen,
    onTriggerClick: () => setOpen(value => !value),
  };
}
