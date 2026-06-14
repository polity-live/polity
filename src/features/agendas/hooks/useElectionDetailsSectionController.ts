import { useState } from 'react';

import { useTranslation } from '@/features/shared/hooks/use-translation';

export function useElectionDetailsSectionController() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return {
    open,
    onOpenChange: setOpen,
    labels: {
      roleDetails: t('features.events.agenda.roleDetails'),
      viewGroup: t('features.events.agenda.viewGroup'),
      role: t('features.events.agenda.role'),
      description: t('common.description'),
      term: t('features.events.agenda.term'),
    },
  };
}
