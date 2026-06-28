import { CircleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

import { useTranslation } from '@/features/shared/hooks/use-translation';
import { Alert, AlertDescription, AlertTitle } from '@/features/shared/ui/ui/alert';
import { cn } from '@/features/shared/utils/utils';

interface CreateSubmitInvalidNoticeProps {
  reason: ReactNode;
  className?: string;
}

export function CreateSubmitInvalidNotice({ reason, className }: CreateSubmitInvalidNoticeProps) {
  const { t } = useTranslation();

  return (
    <Alert variant="destructive" className={cn('text-left', className)}>
      <CircleAlert className="h-4 w-4" />
      <AlertTitle>{t('pages.create.validation.blockedTitle')}</AlertTitle>
      <AlertDescription>{reason}</AlertDescription>
    </Alert>
  );
}
