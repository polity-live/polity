'use client';

import { BadgeControl } from '@/features/shared/ui/status';
import {
  FormControlTextarea,
  FormControlLabel,
  FormControlSelect,
  FormControlCheckbox,
  FormControlSelectContent,
  FormControlSelectItem,
  FormControlSelectTrigger,
  FormControlSelectValue,
} from '@/features/shared/ui/form';
import { ScrollableDialogContent } from '@/features/shared/ui/dialog';
/**
 * CancelEventDialog Component
 *
 * Dialog for cancelling an event with options to reassign agenda items
 * to another event.
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/features/shared/ui/ui/dialog';
import { Button } from '@/features/shared/ui/ui/button';
import { ScrollArea } from '@/features/shared/ui/ui/scroll-area';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useCancelEvent } from '../hooks/useCancelEvent';
import { useEventsByGroup } from '@/zero/events/useEventState';
import { AlertTriangle, CalendarX, ArrowRight, FileText, Vote } from 'lucide-react';

interface CancelEventDialogProps {
  eventId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId?: string;
}

export function CancelEventDialog({
  eventId,
  open,
  onOpenChange,
  groupId,
}: CancelEventDialogProps) {
  const { t } = useTranslation();
  const { isLoading, agendaItems, cancelEvent } = useCancelEvent(eventId);

  const [reason, setReason] = useState('');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [targetEventId, setTargetEventId] = useState<string>('');

  // Query other events in the group for reassignment
  const { events: availableEvents } = useEventsByGroup(groupId, eventId);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setReason('');
      setSelectedItems([]);
      setTargetEventId('');
    }
  }, [open]);

  const handleItemToggle = (itemId: string) => {
    setSelectedItems(prev =>
      prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
    );
  };

  const handleSelectAll = () => {
    if (selectedItems.length === agendaItems.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(agendaItems.map(item => item.id));
    }
  };

  const handleCancel = async () => {
    if (!reason.trim()) {
      return;
    }

    await cancelEvent({
      eventId,
      reason: reason.trim(),
      reassignToEventId: targetEventId || undefined,
      itemsToReassign: selectedItems.length > 0 ? selectedItems : undefined,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ScrollableDialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-destructive flex items-center gap-2">
            <CalendarX className="h-5 w-5" />
            {t('features.events.cancel.title')}
          </DialogTitle>
          <DialogDescription>{t('features.events.cancel.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Warning */}
          <div className="border-destructive/20 bg-destructive/10 flex items-start gap-3 rounded-lg border p-4">
            <AlertTriangle className="text-destructive mt-0.5 h-5 w-5" />
            <div>
              <p className="text-destructive font-medium">
                {t('features.events.cancel.warning.title')}
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                {t('features.events.cancel.warning.description')}
              </p>
            </div>
          </div>

          {/* Reason input */}
          <div className="space-y-2">
            <FormControlLabel htmlFor="reason">
              {t('features.events.cancel.reason.label')}
            </FormControlLabel>
            <FormControlTextarea
              id="reason"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder={t('features.events.cancel.reason.placeholder')}
              className="min-h-[100px]"
            />
          </div>

          {/* Agenda items to reassign */}
          {agendaItems.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <FormControlLabel>{t('features.events.cancel.reassign.label')}</FormControlLabel>
                <Button variant="ghost" size="sm" onClick={handleSelectAll}>
                  {selectedItems.length === agendaItems.length
                    ? t('common.deselectAll')
                    : t('common.selectAll')}
                </Button>
              </div>

              <ScrollArea className="h-48 rounded-md border p-2">
                <div className="space-y-2">
                  {agendaItems.map(item => (
                    <div
                      key={item.id}
                      className="hover:bg-muted flex items-center gap-3 rounded-lg p-2"
                    >
                      <FormControlCheckbox
                        checked={selectedItems.includes(item.id)}
                        onCheckedChange={() => handleItemToggle(item.id)}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {item.amendment ? (
                            <FileText className="h-4 w-4 text-blue-500" />
                          ) : item.election ? (
                            <Vote className="h-4 w-4 text-purple-500" />
                          ) : null}
                          <span className="truncate font-medium">{item.title}</span>
                        </div>
                        {item.amendment && (
                          <p className="text-muted-foreground text-xs">
                            {t('features.events.cancel.reassign.amendment')}: {item.amendment.title}
                          </p>
                        )}
                        {item.election?.role && (
                          <p className="text-muted-foreground text-xs">
                            {t('features.events.cancel.reassign.election')}:{' '}
                            {item.election.role.name}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Target event selection */}
          {selectedItems.length > 0 && (
            <div className="space-y-2">
              <FormControlLabel>
                {t('features.events.cancel.reassign.targetEvent')}
              </FormControlLabel>
              <FormControlSelect value={targetEventId} onValueChange={setTargetEventId}>
                <FormControlSelectTrigger>
                  <FormControlSelectValue
                    placeholder={t('features.events.cancel.reassign.selectEvent')}
                  />
                </FormControlSelectTrigger>
                <FormControlSelectContent>
                  {availableEvents.length === 0 ? (
                    <div className="text-muted-foreground p-4 text-center text-sm">
                      {t('features.events.cancel.reassign.noEvents')}
                    </div>
                  ) : (
                    availableEvents.map(event => (
                      <FormControlSelectItem key={event.id} value={event.id}>
                        <div className="flex items-center gap-2">
                          <span>{event.title}</span>
                          <BadgeControl variant="outline" className="text-xs">
                            {event.start_date
                              ? new Date(event.start_date).toLocaleDateString()
                              : ''}
                          </BadgeControl>
                        </div>
                      </FormControlSelectItem>
                    ))
                  )}
                </FormControlSelectContent>
              </FormControlSelect>

              {targetEventId && (
                <div className="text-muted-foreground mt-2 flex items-center gap-2 text-sm">
                  <BadgeControl variant="secondary">{selectedItems.length}</BadgeControl>
                  <span>{t('features.events.cancel.reassign.itemCount')}</span>
                  <ArrowRight className="h-4 w-4" />
                  <span>{availableEvents.find(e => e.id === targetEventId)?.title}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={handleCancel}
            disabled={isLoading || !reason.trim()}
          >
            {isLoading ? t('common.loading') : t('features.events.cancel.confirm')}
          </Button>
        </DialogFooter>
      </ScrollableDialogContent>
    </Dialog>
  );
}
