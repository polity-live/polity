'use client';

import { useState } from 'react';
import { MapPinned } from 'lucide-react';
import { BadgeControl } from '@/features/shared/ui/status';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { CivicTimelineMap } from '@/features/timeline/ui/CivicTimelineMap';
import { CivicTimelineRail } from '@/features/timeline/ui/CivicTimelineRail';
import {
  landingActivityTimelineItems,
  landingActivityTimelineSections,
} from '@/features/public-landing/logic/landingActivityPreview';

export function LandingActivityStripPreview() {
  const { t } = useTranslation();
  const [activeItemId, setActiveItemId] = useState<string | null>('landing-activity-hearing');

  return (
    <div className="bg-card space-y-4 rounded-lg border p-5 shadow-sm">
      <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
        <BadgeControl variant="outline" shape="rounded">
          <MapPinned className="mr-1.5 h-3.5 w-3.5" />
          {t('features.timeline.around.mappedCount', {
            count: landingActivityTimelineItems.length,
            defaultValue: '{{count}} mapped',
          })}
        </BadgeControl>
        <BadgeControl variant="outline" shape="rounded">
          {t('pages.home.publicLanding.timeline.badge')}
        </BadgeControl>
      </div>
      <div
        className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-[minmax(280px,0.82fr)_minmax(0,1.18fr)]"
        data-slot="landing-activity-grid"
      >
        <div
          className="max-w-full min-w-0 [&_.leaflet-container]:!h-80"
          data-slot="landing-activity-map-column"
        >
          <CivicTimelineMap
            items={landingActivityTimelineItems}
            activeItemId={activeItemId}
            onActiveItemChange={setActiveItemId}
            onItemSelect={item => setActiveItemId(item.id)}
          />
        </div>
        <div className="max-w-full min-w-0" data-slot="landing-activity-rail-column">
          <CivicTimelineRail
            sections={landingActivityTimelineSections}
            activeItemId={activeItemId}
            onActiveItemChange={setActiveItemId}
            onItemSelect={item => setActiveItemId(item.id)}
          />
        </div>
      </div>
    </div>
  );
}
