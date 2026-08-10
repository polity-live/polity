import { Bell, Check, Eye, X } from 'lucide-react';

import { featureThemeClassName } from '@/features/shared/theme';
import { BadgeControl } from '@/features/shared/ui/status';
import { Alert, AlertDescription, AlertTitle } from '@/features/shared/ui/ui/alert';
import { Button } from '@/features/shared/ui/ui/button';

interface ConfirmationRequestNoticeViewProps {
  labels: {
    title: string;
    description: string;
    untitled: string;
    changeRequest: string;
    viewChanges: string;
    confirm: string;
    decline: string;
  };
  pendingConfirmations: {
    id: string;
    amendment?: { id?: string | null; title?: string | null } | null;
  }[];
  processingId: string | null;
  onConfirmClick: (confirmationId: string) => void;
  onDeclineClick: (confirmationId: string) => void;
  onViewChanges?: (confirmationId: string, amendmentId: string) => void;
}

export function ConfirmationRequestNoticeView({
  labels,
  pendingConfirmations,
  processingId,
  onConfirmClick,
  onDeclineClick,
  onViewChanges,
}: ConfirmationRequestNoticeViewProps) {
  if (pendingConfirmations.length === 0) {
    return null;
  }

  return (
    <Alert className={featureThemeClassName('featureThemeWarningSurface')}>
      <Bell className={featureThemeClassName('featureThemeWarningIcon')} />
      <AlertTitle className={featureThemeClassName('featureThemeWarningText')}>
        {labels.title}
        <BadgeControl variant="secondary" className="ml-2">
          {pendingConfirmations.length}
        </BadgeControl>
      </AlertTitle>
      <AlertDescription className="mt-3">
        <p className={featureThemeClassName('featureThemeWarningTextAlpha')}>
          {labels.description}
        </p>

        <div className="space-y-2">
          {pendingConfirmations.map((confirmation: any) => (
            <div
              key={confirmation.id}
              className={featureThemeClassName('featureThemeNeutralContrastSurface')}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {confirmation.amendment?.title ?? labels.untitled}
                </p>
                {(confirmation as { changeRequest?: { title?: string } }).changeRequest?.title && (
                  <p className="text-muted-foreground truncate text-xs">
                    {labels.changeRequest}:{' '}
                    {(confirmation as { changeRequest?: { title?: string } }).changeRequest?.title}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-1">
                <Button
                  data-action-id="amendments.confirmation.navigate.changes"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onViewChanges?.(confirmation.id, confirmation.amendment?.id ?? '')}
                  title={labels.viewChanges}
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  data-action-id="amendments.confirmation.accept.request"
                  variant="ghost"
                  size="icon"
                  className={featureThemeClassName('featureThemeSuccessBackground')}
                  onClick={() => onConfirmClick(confirmation.id)}
                  disabled={processingId === confirmation.id}
                  title={labels.confirm}
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  data-action-id="amendments.confirmation.decline.request"
                  variant="ghost"
                  size="icon"
                  className={featureThemeClassName('featureThemeDangerBackground')}
                  onClick={() => onDeclineClick(confirmation.id)}
                  disabled={processingId === confirmation.id}
                  title={labels.decline}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </AlertDescription>
    </Alert>
  );
}
