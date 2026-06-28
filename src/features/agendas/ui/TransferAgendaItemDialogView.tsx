import { featureThemeClassName } from '@/features/shared/theme';
import type { ReactNode } from 'react';

import { ScrollableDialogContent } from '@/features/shared/ui/dialog';
import { SectionSkeleton } from '@/features/shared/ui/feedback';
import { FormControlLabel } from '@/features/shared/ui/form';
import { Button } from '@/features/shared/ui/ui/button';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/features/shared/ui/ui/dialog';
import { TypeaheadSearch } from '@/features/shared/ui/typeahead/TypeaheadSearch';
import { toTypeaheadItems } from '@/features/shared/ui/typeahead/toTypeaheadItems';
import type { TypeaheadItem } from '@/features/shared/logic/typeaheadHelpers';
import { Card, CardContent } from '@/features/shared/ui/ui/card';
import { ArrowRight, Calendar, AlertTriangle, Loader2 } from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import type {
  EventWithAgendaPermission,
  TransferAgendaItemDialogController,
} from '../hooks/useTransferAgendaItemDialogController';

interface TransferAgendaItemDialogViewProps {
  agendaItemTitle: string;
  currentEventTitle: string;
  trigger?: ReactNode;
  controller: TransferAgendaItemDialogController;
}

export function TransferAgendaItemDialogView({
  agendaItemTitle,
  currentEventTitle,
  trigger,
  controller,
}: TransferAgendaItemDialogViewProps) {
  const { t } = useTranslation();
  const {
    open,
    setOpen,
    selectedEventId,
    setSelectedEventId,
    selectedEvent,
    eventsWithPermission,
    participationsLoading,
    transferLoading,
    handleConfirmTransfer,
  } = controller;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <ArrowRight className="mr-2 h-4 w-4" />
            {t('features.events.agenda.moveToEvent')}
          </Button>
        )}
      </DialogTrigger>
      <ScrollableDialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('features.events.agenda.transferItem')}</DialogTitle>
          <DialogDescription>
            {t('features.events.agenda.selectDestinationEvent')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <FormControlLabel>{t('features.events.agenda.currentEvent')}</FormControlLabel>
            <Card surface="muted">
              <CardContent className="flex items-center gap-3 p-4">
                <Calendar className="text-muted-foreground h-5 w-5" />
                <div>
                  <p className="font-medium">{currentEventTitle}</p>
                  <p className="text-muted-foreground text-sm">{agendaItemTitle}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-center">
            <ArrowRight className="text-muted-foreground h-6 w-6" />
          </div>

          <div className="space-y-2">
            <FormControlLabel>{t('features.events.agenda.destinationEvent')}</FormControlLabel>
            {participationsLoading ? (
              <SectionSkeleton rows={3} density="compact" />
            ) : eventsWithPermission.length === 0 ? (
              <Card surface="muted">
                <CardContent tone="muted" align="center" className="p-6">
                  <p>{t('features.events.agenda.noEventsWithPermission')}</p>
                </CardContent>
              </Card>
            ) : (
              <TypeaheadSearch
                items={toTypeaheadItems(
                  eventsWithPermission,
                  'event',
                  (e: EventWithAgendaPermission) => e.title,
                  (e: EventWithAgendaPermission) => e.group?.name
                )}
                value={selectedEventId}
                onChange={(item: TypeaheadItem | null) => setSelectedEventId(item?.id ?? '')}
                placeholder={t('features.events.agenda.searchEvents')}
              />
            )}
          </div>

          {selectedEvent && (
            <div className={featureThemeClassName('agendaTransferAgendaItemDialogWarningSurface')}>
              <AlertTriangle
                className={featureThemeClassName('agendaTransferAgendaItemDialogWarningIcon')}
              />
              <p className={featureThemeClassName('agendaTransferAgendaItemDialogWarningText')}>
                {t('features.events.agenda.transferWarning')}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={transferLoading}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleConfirmTransfer} disabled={!selectedEventId || transferLoading}>
            {transferLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('features.events.agenda.transferring')}
              </>
            ) : (
              <>
                <ArrowRight className="mr-2 h-4 w-4" />
                {t('features.events.agenda.transferConfirm')}
              </>
            )}
          </Button>
        </DialogFooter>
      </ScrollableDialogContent>
    </Dialog>
  );
}
