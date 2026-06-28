'use client';

import { BadgeControl } from '@/features/shared/ui/status';
/**
 * SupportConfirmationPanel Component
 *
 * Displays pending support confirmations for a group and allows
 * group admins to confirm or decline continued support.
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { Button } from '@/features/shared/ui/ui/button';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { SectionSkeleton } from '@/features/shared/ui/feedback';
import { VersionComparisonView } from './VersionComparisonView.tsx';
import { CheckCircle, XCircle, GitCompare, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { getEntityGradientClasses, getMotionPreset } from '@/features/shared/theme';
import { cn } from '@/features/shared/utils/utils';

export interface SupportConfirmationPanelViewProps {
  groupId: any;
  t: any;
  i18n: any;
  pendingConfirmations: any[];
  isLoading: any;
  confirmSupport: any;
  declineSupport: any;
  selectedConfirmation: any;
  setSelectedConfirmation: any;
  processingId: any;
  setProcessingId: any;
  dateLocale: any;
  status: 'loading' | 'empty' | 'ready';
  handleConfirm: any;
  handleDecline: any;
}

export function SupportConfirmationPanelView({
  t,
  pendingConfirmations,
  selectedConfirmation,
  setSelectedConfirmation,
  processingId,
  dateLocale,
  status,
  handleConfirm,
  handleDecline,
}: SupportConfirmationPanelViewProps) {
  if (status === 'loading') {
    return <SectionSkeleton rows={2} />;
  }

  if (status === 'empty') {
    return (
      <Card>
        <CardContent tone="muted" align="center" className="py-8">
          <CheckCircle className="mx-auto mb-4 h-12 w-12 opacity-50" />
          <p>{t('features.amendments.supportConfirmation.noPending')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">
          {t('features.amendments.supportConfirmation.title')}
        </h2>
        <BadgeControl variant="secondary">
          {pendingConfirmations.length} {t('features.amendments.supportConfirmation.pending')}
        </BadgeControl>
      </div>

      {pendingConfirmations.map((confirmation: any) => (
        <Card
          key={confirmation.id}
          className={cn(
            'overflow-hidden',
            getEntityGradientClasses('amendment'),
            getMotionPreset('colors')
          )}
        >
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-lg">
                  {confirmation.amendment?.title ||
                    translateText('generated.inline.0026_unknown_amendment_c9e89dc8')}
                </CardTitle>
                <CardDescription className="mt-1 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {t('features.amendments.supportConfirmation.requestedAgo', {
                    time: formatDistanceToNow(new Date(confirmation.created_at), {
                      addSuffix: true,
                      locale: dateLocale,
                    }),
                  })}
                </CardDescription>
              </div>
              <BadgeControl variant="outline">
                {t('features.amendments.supportConfirmation.changeRequest')}:{' '}
                {confirmation.amendment?.title ||
                  translateText('generated.inline.0027_change_request_9c839351')}
              </BadgeControl>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">
              {t('features.amendments.supportConfirmation.description')}
            </p>

            {/* Compare button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setSelectedConfirmation(
                  selectedConfirmation === confirmation.id ? null : confirmation.id
                )
              }
            >
              <GitCompare className="mr-2 h-4 w-4" />
              {selectedConfirmation === confirmation.id
                ? t('features.amendments.supportConfirmation.hideChanges')
                : t('features.amendments.supportConfirmation.viewChanges')}
            </Button>

            {/* Version comparison */}
            {selectedConfirmation === confirmation.id && (
              <VersionComparisonView
                originalVersion={''}
                currentVersion={
                  (confirmation.amendment?.document?.content ??
                    confirmation.amendment?.documents?.[0]?.content ??
                    '') as string
                }
                changeRequest={undefined}
              />
            )}

            {/* Action buttons */}
            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => handleConfirm(confirmation.id)}
                disabled={processingId === confirmation.id}
                className="flex-1"
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                {t('features.amendments.supportConfirmation.confirm')}
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleDecline(confirmation.id)}
                disabled={processingId === confirmation.id}
                className="flex-1"
              >
                <XCircle className="mr-2 h-4 w-4" />
                {t('features.amendments.supportConfirmation.decline')}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
