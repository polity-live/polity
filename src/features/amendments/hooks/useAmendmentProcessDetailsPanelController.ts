import { useState } from 'react';

import { useTranslation } from '@/features/shared/hooks/use-translation';

export function useAmendmentProcessDetailsPanelController(defaultOpen: boolean) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(defaultOpen);

  return {
    open,
    onOpenChange: setOpen,
    labels: {
      amendmentDetails: t('features.events.agenda.amendmentDetails'),
      viewAmendment: t('features.events.agenda.viewAmendment'),
      title: t('common.title'),
      reason: t('features.amendments.reason'),
      preamble: t('features.amendments.preamble'),
      pathVisualization: t('features.amendments.process.pathVisualization'),
    },
  };
}
