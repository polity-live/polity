'use client';

import { BadgeControl } from '@/features/shared/ui/status';
/**
 * SupportConfirmationPanel Component
 *
 * Displays pending support confirmations for a group and allows
 * group admins to confirm or decline continued support.
 */

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { Button } from '@/features/shared/ui/ui/button';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import { useSupportConfirmation } from '../hooks/useSupportConfirmation';
import { VersionComparisonView } from './VersionComparisonView.tsx';
import { CheckCircle, XCircle, GitCompare, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { de, enUS } from 'date-fns/locale';
import { GRADIENTS } from '@/features/users/state/gradientColors';

interface SupportConfirmationPanelProps {
  groupId: string;
}

export function SupportConfirmationPanel({ groupId }: SupportConfirmationPanelProps) {
  const { t, i18n } = useTranslation();
  const { pendingConfirmations, isLoading, confirmSupport, declineSupport } =
    useSupportConfirmation(groupId);
  const [selectedConfirmation, setSelectedConfirmation] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const dateLocale = i18n.language === 'de' ? de : enUS;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2" />
      </div>
    );
  }

  if (pendingConfirmations.length === 0) {
    return (
      <Card>
        <CardContent tone="muted" align="center" className="py-8">
          <CheckCircle className="mx-auto mb-4 h-12 w-12 opacity-50" />
          <p>{t('features.amendments.supportConfirmation.noPending')}</p>
        </CardContent>
      </Card>
    );
  }

  const handleConfirm = async (confirmationId: string) => {
    setProcessingId(confirmationId);
    try {
      await confirmSupport(confirmationId);
      setSelectedConfirmation(null);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (confirmationId: string) => {
    setProcessingId(confirmationId);
    try {
      await declineSupport(confirmationId);
      setSelectedConfirmation(null);
    } finally {
      setProcessingId(null);
    }
  };

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

      {pendingConfirmations.map((confirmation, index) => (
        <Card
          key={confirmation.id}
          className={`overflow-hidden ${GRADIENTS[index % GRADIENTS.length]}`}
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
                currentVersion={(confirmation.amendment?.documents?.[0]?.content ?? '') as string}
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
