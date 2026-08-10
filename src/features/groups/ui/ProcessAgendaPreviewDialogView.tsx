import { Info } from 'lucide-react';
import {
  AgendaCard,
  type AgendaItemStatus,
  type AgendaItemType,
} from '@/features/agendas/ui/AgendaCard';
import { TimelineItem } from '@/features/agendas/ui/TimelineItem';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/features/shared/ui/ui/dialog';
import { ScrollableDialogContent } from '@/features/shared/ui/dialog';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
interface PreviewItem {
  id: string;
  title: string;
  description?: string;
  subtitle: string;
  detailsLink: string;
  type: AgendaItemType;
  status: AgendaItemStatus;
  state: 'scheduled' | 'scheduled_but_not_confirmed';
  order: number;
  duration: number;
  displayStartTime?: number;
  displayEndTime?: number;
}
function formatTime(value?: number | Date | null) {
  if (!value) {
    return '--:--';
  }

  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });
}
function TimelineList({
  items,
  amendmentId,
  amendmentTitle,
}: {
  items: PreviewItem[];
  amendmentId: string;
  amendmentTitle: string;
}) {
  return (
    <div className="space-y-6">
      {items.map((item: any) => (
        <TimelineItem
          key={item.id}
          order={item.order}
          startTime={formatTime(item.displayStartTime)}
          endTime={formatTime(item.displayEndTime)}
          duration={item.duration}
        >
          <AgendaCard
            id={item.id}
            title={item.title}
            subtitle={item.subtitle}
            description={item.description}
            type={item.type}
            status={item.status}
            detailsLink={item.detailsLink}
            amendment={{ id: amendmentId, title: amendmentTitle }}
          />
        </TimelineItem>
      ))}
    </div>
  );
}

export const processAgendaPreviewDialogViewInternals = { formatTime, TimelineList };

export interface ProcessAgendaPreviewDialogViewProps {
  open: any;
  onOpenChange: any;
  amendmentId: any;
  amendmentTitle: any;
  processRunId: any;
  focusStepRunId: any;
  amendmentProcess: any;
  activeRun: any;
  activeBranch: any;
  resolvedAmendmentTitle: any;
  previewItems: any;
  scheduledItems: any;
  scheduledButNotConfirmedItems: any;
}

export function ProcessAgendaPreviewDialogView({
  open,
  onOpenChange,
  amendmentId,
  resolvedAmendmentTitle,
  previewItems,
  scheduledItems,
  scheduledButNotConfirmedItems,
}: ProcessAgendaPreviewDialogViewProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ScrollableDialogContent management className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>
            {translateText('generated.inline.0710_neue_agenda_items_anzeigen_bf362c2d')}
          </DialogTitle>
          <DialogDescription>
            {translateText(
              'generated.inline.0711_timeline_vorschau_der_agenda_items_aus_diesem_af15f8d0'
            )}
          </DialogDescription>
        </DialogHeader>

        {previewItems.length === 0 ? (
          <div className="text-muted-foreground flex items-start gap-3 rounded-xl border border-dashed p-4 text-sm">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>
              {translateText(
                'generated.inline.0712_fuer_diesen_antragsprozess_gibt_es_aktuell_ke_c0f5f0b1'
              )}
            </span>
          </div>
        ) : (
          <div className="space-y-6">
            {scheduledItems.length > 0 ? (
              <div className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold">
                    {translateText('generated.inline.0713_scheduled_1cd1bdad')}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    {translateText(
                      'generated.inline.0714_agenda_items_deren_vorheriger_prozessschritt__6beb4ad4'
                    )}
                  </p>
                </div>

                <TimelineList
                  items={scheduledItems}
                  amendmentId={amendmentId}
                  amendmentTitle={resolvedAmendmentTitle}
                />
              </div>
            ) : null}

            {scheduledButNotConfirmedItems.length > 0 ? (
              <Card borderStyle="dashed">
                <CardHeader>
                  <CardTitle>
                    {translateText('generated.inline.0715_scheduled_but_not_confirmed_512467ae')}
                  </CardTitle>
                  <CardDescription>
                    {translateText(
                      'generated.inline.0716_agenda_items_deren_darunter_liegende_abstimmu_2875f6bf'
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <TimelineList
                    items={scheduledButNotConfirmedItems}
                    amendmentId={amendmentId}
                    amendmentTitle={resolvedAmendmentTitle}
                  />
                </CardContent>
              </Card>
            ) : null}
          </div>
        )}
      </ScrollableDialogContent>
    </Dialog>
  );
}
