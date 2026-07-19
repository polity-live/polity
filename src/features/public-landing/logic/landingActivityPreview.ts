import type {
  CivicTimelineItem,
  CivicTimelineSection,
} from '@/features/timeline/logic/civicTimeline';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

const landingText = (key: string) => translateText(`pages.home.publicLanding.${key}`);
const landingTags = (key: string) => translateText(`pages.home.publicLanding.${key}`).split('|');

const LANDING_ACTIVITY_BASE_DATE = new Date('2026-06-18T08:30:00.000Z');

export const landingActivityTimelineItems: CivicTimelineItem[] = [
  {
    id: 'landing-activity-hearing',
    entityId: 'event-public-hearing',
    type: 'event',
    title: landingText('timeline.items.event.title'),
    description: landingText('timeline.items.event.description'),
    href: '/event/public-hearing',
    sourceName: landingText('timeline.items.event.source'),
    sourceHref: '/group/budget-committee',
    timestamp: LANDING_ACTIVITY_BASE_DATE,
    startDate: LANDING_ACTIVITY_BASE_DATE,
    status: landingText('timeline.items.event.status'),
    locationLabel: landingText('timeline.items.event.location'),
    coordinates: { latitude: 52.5186, longitude: 13.3762 },
    tags: landingTags('timeline.items.event.tags'),
    statsLabel: landingText('timeline.items.event.stats'),
    reason: 'subscribed',
    distanceKm: 2.4,
  },
  {
    id: 'landing-activity-change-request',
    entityId: 'cr-reporting-milestones',
    type: 'workflow',
    title: landingText('timeline.items.changeRequest.title'),
    description: landingText('timeline.items.changeRequest.description'),
    href: '/amendments/climate-budget/change-requests',
    sourceName: landingText('timeline.items.changeRequest.source'),
    sourceHref: '/group/policy-committee',
    timestamp: new Date('2026-06-18T10:15:00.000Z'),
    status: landingText('timeline.items.changeRequest.status'),
    locationLabel: landingText('timeline.items.changeRequest.location'),
    coordinates: { latitude: 52.3906, longitude: 13.0645 },
    tags: landingTags('timeline.items.changeRequest.tags'),
    statsLabel: landingText('timeline.items.changeRequest.stats'),
    reason: 'active_now',
    distanceKm: 28,
  },
  {
    id: 'landing-activity-final-vote',
    entityId: 'vote-final-climate-budget',
    type: 'vote',
    title: landingText('timeline.items.vote.title'),
    description: landingText('timeline.items.vote.description'),
    href: '/event/public-hearing/agenda/agenda-item-climate-budget-18',
    sourceName: landingText('timeline.items.vote.source'),
    sourceHref: '/group/party-congress',
    timestamp: new Date('2026-06-20T13:00:00.000Z'),
    startDate: new Date('2026-06-20T13:00:00.000Z'),
    status: landingText('timeline.items.vote.status'),
    locationLabel: landingText('timeline.items.vote.location'),
    coordinates: { latitude: 51.3397, longitude: 12.3731 },
    tags: landingTags('timeline.items.vote.tags'),
    statsLabel: landingText('timeline.items.vote.stats'),
    reason: 'urgent_decision',
    distanceKm: 150,
  },
];

export const landingActivityTimelineSections: CivicTimelineSection[] = [
  {
    id: 'today',
    labelKey: 'features.timeline.around.sections.today',
    items: landingActivityTimelineItems,
  },
];
