import { featureThemeClassName } from '@/features/shared/theme';
import { BadgeControl } from '@/features/shared/ui/status';
import { Card, CardContent, CardHeader, CardTitle } from '@/features/shared/ui/ui/card';
import { Button } from '@/features/shared/ui/ui/button';
import { Avatar, AvatarFallback } from '@/features/shared/ui/ui/avatar';
import { ShieldCheck, CheckCircle2, Users, XCircle, RotateCcw } from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { SectionSkeleton } from '@/features/shared/ui/feedback';
import { VotePasswordInput } from '@/features/vote-cast/ui/VotePasswordInput';
import type { AccreditationSectionController } from '../hooks/useAccreditationSectionController';

interface AccreditationSectionViewProps {
  controller: AccreditationSectionController;
}

export function AccreditationSectionView({ controller }: AccreditationSectionViewProps) {
  const { t } = useTranslation();
  const {
    accreditationsByAgendaItem,
    isAccredited,
    accreditationStatus,
    accreditedCount,
    isLoading,
    canManageAccreditations,
    showPasswordInput,
    isConfirming,
    passwordError,
    noVotingPasswordSettingsHref,
    handleConfirmClick,
    handlePasswordSubmit,
    approveAccreditation,
    rejectAccreditation,
    revokeAccreditation,
  } = controller;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <SectionSkeleton rows={2} density="compact" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            <CardTitle>{t('features.events.agenda.accreditation.title')}</CardTitle>
          </div>
          <BadgeControl variant="secondary">
            <Users className="mr-1 h-3 w-3" />
            {accreditedCount} {t('features.events.agenda.accreditation.accredited', 'accredited')}
          </BadgeControl>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isAccredited ? (
          <div className={featureThemeClassName('agendaAccreditationSectionSuccessSurface')}>
            <CheckCircle2
              className={featureThemeClassName('agendaAccreditationSectionSuccessIcon')}
            />
            <span className={featureThemeClassName('agendaAccreditationSectionSuccessText')}>
              {t('features.events.agenda.accreditation.confirmed')}
            </span>
          </div>
        ) : accreditationStatus === 'pending' ? (
          <div className="rounded-md border p-3 text-sm">
            {t('common.accreditation.pending', 'Awaiting organizer confirmation')}
          </div>
        ) : (
          <div className="space-y-3">
            {!showPasswordInput ? (
              <Button onClick={handleConfirmClick} className="w-full">
                <ShieldCheck className="mr-2 h-4 w-4" />
                {t('features.events.agenda.accreditation.confirmAttendance')}
              </Button>
            ) : (
              <div className="space-y-2">
                <p className="text-muted-foreground text-sm">
                  {t('features.events.agenda.accreditation.enterPassword')}
                </p>
                <VotePasswordInput
                  onSubmit={handlePasswordSubmit}
                  error={passwordError}
                  noVotingPasswordSettingsHref={noVotingPasswordSettingsHref}
                  isLoading={isConfirming}
                />
              </div>
            )}
          </div>
        )}

        {accreditationsByAgendaItem.length > 0 && (
          <div className="space-y-2">
            <p className="text-muted-foreground text-sm font-medium">
              {t('features.events.agenda.accreditation.participants')}
            </p>
            <div className="flex flex-wrap gap-2">
              {accreditationsByAgendaItem.map((acc: any) => (
                <div
                  key={acc.id}
                  className="flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm"
                >
                  <Avatar className="h-5 w-5">
                    <AvatarFallback
                      className={featureThemeClassName('agendaAccreditationSectionThemedText')}
                    >
                      {acc.user_id?.charAt(0)?.toUpperCase() ?? '?'}
                    </AvatarFallback>
                  </Avatar>
                  <CheckCircle2
                    className={featureThemeClassName('agendaAccreditationSectionSuccessIconAlpha')}
                  />
                  <span>{acc.status}</span>
                  {canManageAccreditations && acc.status === 'pending' ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => approveAccreditation({ accreditation_id: acc.id })}
                      >
                        <CheckCircle2 className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => rejectAccreditation({ accreditation_id: acc.id })}
                      >
                        <XCircle className="h-3 w-3" />
                      </Button>
                    </>
                  ) : null}
                  {canManageAccreditations && acc.status === 'approved' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => revokeAccreditation({ accreditation_id: acc.id })}
                    >
                      <RotateCcw className="h-3 w-3" />
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
