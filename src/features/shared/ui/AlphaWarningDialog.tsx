'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';
import { useTranslation } from '@/features/shared/hooks/use-translation.ts';
import { Badge } from '@/features/shared/ui/ui/badge.tsx';

const ALPHA_WARNING_TOAST_ID = 'alpha-warning';

export function AlphaWarningDialog() {
  const { t } = useTranslation();

  useEffect(() => {
    toast.warning(
      <span className="flex items-center gap-2">
        <span>{t('common.alphaWarning.title')}</span>
        <Badge className="border-0 bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400 font-bold text-slate-950 shadow-sm">
          0.3
        </Badge>
      </span>,
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

  return null;
}
