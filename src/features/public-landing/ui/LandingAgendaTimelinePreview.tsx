'use client';

import { BadgeControl } from '@/features/shared/ui/status';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { AgendaItemTimelineCard } from '@/features/timeline/ui/cards/AgendaItemTimelineCard';
import { LANDING_AGENDA_ITEM_ID } from '@/features/public-landing/logic/landingAmendmentPreview';
import { cn } from '@/features/shared/utils/utils';

export function LandingAgendaTimelinePreview() {
  const { t } = useTranslation();
  const agendaTimelineItems = [
    {
      id: LANDING_AGENDA_ITEM_ID,
      title: t('pages.home.publicLanding.timeline.items.event.title'),
      description: t('pages.home.publicLanding.timeline.items.event.description'),
      type: 'discussion',
      status: 'planned',
      orderIndex: 18,
      scheduledTime: new Date(Date.UTC(2026, 5, 18, 8, 30)),
      durationMinutes: 45,
      eventName: 'Budget Committee',
    },
    {
      id: `${LANDING_AGENDA_ITEM_ID}-review`,
      title: t('pages.home.publicLanding.timeline.items.changeRequest.title'),
      description: t('pages.home.publicLanding.timeline.items.changeRequest.description'),
      type: 'amendment',
      status: 'in-progress',
      orderIndex: 19,
      scheduledTime: new Date(Date.UTC(2026, 5, 18, 9, 30)),
      durationMinutes: 30,
      eventName: 'Budget Committee',
    },
    {
      id: `${LANDING_AGENDA_ITEM_ID}-vote`,
      title: t('pages.home.publicLanding.timeline.items.vote.title'),
      description: t('pages.home.publicLanding.timeline.items.vote.description'),
      type: 'vote',
      status: 'pending',
      orderIndex: 20,
      scheduledTime: new Date(Date.UTC(2026, 5, 18, 10, 15)),
      durationMinutes: 20,
      eventName: 'Budget Committee',
    },
  ];

  return (
    <div className="landing-agenda-preview bg-card overflow-hidden rounded-lg border shadow-sm">
      <div className="border-b px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold">{t('pages.home.publicLanding.timeline.title')}</p>
            <p className="text-muted-foreground text-sm">
              {t('pages.home.publicLanding.timeline.description')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <BadgeControl variant="outline">
              {t('pages.home.publicLanding.timeline.badge')}
            </BadgeControl>
            <BadgeControl variant="secondary" size="tiny" textStyle="mono">
              {LANDING_AGENDA_ITEM_ID}
            </BadgeControl>
          </div>
        </div>
      </div>
      <div className="p-5">
        <div className="landing-agenda-timeline before:bg-border relative space-y-4 pl-6 before:absolute before:top-3 before:bottom-3 before:left-2 before:w-px">
          {agendaTimelineItems.map((item, index) => (
            <div key={item.id} className="landing-agenda-step relative">
              <span className="landing-timeline-dot border-background bg-brand absolute top-5 -left-[22px] h-3 w-3 rounded-full border-2 shadow-sm" />
              <AgendaItemTimelineCard
                agendaItem={item}
                className={cn('landing-agenda-card', index === 0 && 'ring-brand/30 ring-2')}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
