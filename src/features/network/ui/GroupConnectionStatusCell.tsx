'use client';

import { Button } from '@/features/shared/ui/ui/button';
import { Check, AlertTriangle } from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/features/shared/ui/ui/tooltip';

interface GroupConnectionStatusCellProps {
  canLink: boolean;
  hasHierarchyCheck: boolean;
  onWarningClick?: () => void;
}

export function GroupConnectionStatusCell({
  canLink,
  hasHierarchyCheck,
  onWarningClick,
}: GroupConnectionStatusCellProps) {
  const { t } = useTranslation();

  if (!hasHierarchyCheck) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-muted-foreground inline-flex" aria-hidden>
              —
            </span>
          </TooltipTrigger>
          <TooltipContent>{t('common.network.linkStatusNotApplicable')}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (canLink) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className="inline-flex text-emerald-600"
              aria-label={t('common.network.linkPossible')}
            >
              <Check className="h-5 w-5" />
            </span>
          </TooltipTrigger>
          <TooltipContent>{t('common.network.linkPossible')}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {onWarningClick ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive h-8 w-8"
              aria-label={t('common.network.linkConflict')}
              onClick={onWarningClick}
            >
              <AlertTriangle className="h-5 w-5" />
            </Button>
          ) : (
            <span
              className="text-destructive inline-flex"
              aria-label={t('common.network.linkConflict')}
            >
              <AlertTriangle className="h-5 w-5" />
            </span>
          )}
        </TooltipTrigger>
        <TooltipContent>{t('common.network.linkConflict')}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
