'use client';

import { featureThemeClassName } from '@/features/shared/theme';
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

import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/features/shared/ui/ui/dialog';
import { Button } from '@/features/shared/ui/ui/button';
import { ScrollArea } from '@/features/shared/ui/ui/scroll-area';
import { AlertTriangle, CalendarX, ArrowRight, FileText, Vote } from 'lucide-react';
export interface CancelEventDialogViewProps {
  eventId: any;
  open: any;
  onOpenChange: any;
  groupId: any;
  t: any;
  isLoading: any;
  agendaItems: any[];
  cancelEvent: any;
  reason: any;
  setReason: any;
  selectedItems: any[];
  setSelectedItems: any;
  targetEventId: any;
  setTargetEventId: any;
  availableEvents: any[];
  handleItemToggle: any;
  handleSelectAll: any;
  handleCancel: any;
}

export function CancelEventDialogView({
  open,
  onOpenChange,
  t,
  isLoading,
  agendaItems,
  reason,
  setReason,
  selectedItems,
  targetEventId,
  setTargetEventId,
  availableEvents,
  handleItemToggle,
  handleSelectAll,
  handleCancel,
}: CancelEventDialogViewProps) {
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
                  {agendaItems.map((item: any) => (
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
                            <FileText
                              className={featureThemeClassName('eventCancelEventDialogInfoIcon')}
                            />
                          ) : item.election ? (
                            <Vote
                              className={featureThemeClassName('eventCancelEventDialogAccentIcon')}
                            />
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
                    availableEvents.map((event: any) => (
                      <FormControlSelectItem key={event.id} value={event.id}>
                        <div className="flex items-center gap-2">
                          <span>{event.title}</span>
                          <BadgeControl variant="outline" size="xs">
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
                  <span>
                    {t('features.events.cancel.reassign.itemCount', {
                      count: selectedItems.length,
                    })}
                  </span>
                  <ArrowRight className="h-4 w-4" />
                  <span>{availableEvents.find((e: any) => e.id === targetEventId)?.title}</span>
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
            {isLoading ? t('common.loading.general') : t('features.events.cancel.confirm')}
          </Button>
        </DialogFooter>
      </ScrollableDialogContent>
    </Dialog>
  );
}
