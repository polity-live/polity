import { createElement, useEffect } from 'react';
import { toast } from 'sonner';

import { useTranslation } from '@/features/shared/hooks/use-translation.ts';
import { AlphaWarningToastContent } from '../ui/AlphaWarningToastContent';

const ALPHA_WARNING_TOAST_ID = 'alpha-warning';

export function useAlphaWarningDialogController() {
  const { t } = useTranslation();

  useEffect(() => {
    toast.warning(
      createElement(AlphaWarningToastContent, {
        title: t('common.alphaWarning.title'),
        version: '0.3',
      }),
      {
        id: ALPHA_WARNING_TOAST_ID,
        description: t('common.alphaWarning.description'),
        action: {
          label: t('common.alphaWarning.confirm'),
          onClick: () => toast.dismiss(ALPHA_WARNING_TOAST_ID),
        },
      }
    );
  }, [t]);
}
