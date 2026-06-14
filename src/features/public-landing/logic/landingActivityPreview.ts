import type {
  CivicTimelineItem,
  CivicTimelineSection,
} from '@/features/timeline/logic/civicTimeline';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

const LANDING_ACTIVITY_BASE_DATE = new Date('2026-06-18T08:30:00.000Z');

export const landingActivityTimelineItems: CivicTimelineItem[] = [
  {
    id: 'landing-activity-hearing',
    entityId: 'event-public-hearing',
    type: 'event',
    title: translateText('generated.inline.0485_public_committee_hearing_scheduled_a5cd3ff0'),
    description: translateText(
      'generated.inline.0486_the_parliamentary_group_added_a_public_consul_0a988ee8'
    ),
    href: '/event/public-hearing',
    sourceName: 'Budget Committee',
    sourceHref: '/group/budget-committee',
    timestamp: LANDING_ACTIVITY_BASE_DATE,
    startDate: LANDING_ACTIVITY_BASE_DATE,
    status: 'scheduled',
    locationLabel: 'Berlin, Parliament',
    coordinates: { latitude: 52.5186, longitude: 13.3762 },
    tags: ['hearing', 'budget', 'climate'],
    statsLabel: '128 participants',
    reason: 'subscribed',
    distanceKm: 2.4,
  },
  {
    id: 'landing-activity-change-request',
    entityId: 'cr-reporting-milestones',
    type: 'workflow',
    title: translateText('generated.inline.0487_change_request_opened_79db3d8c'),
    description: translateText(
      'generated.inline.0488_a_working_group_proposed_measurable_quarterly_e4148ffc'
    ),
    href: '/amendments/climate-budget/change-requests',
    sourceName: 'Policy Committee',
    sourceHref: '/group/policy-committee',
    timestamp: new Date('2026-06-18T10:15:00.000Z'),
    status: 'vote_event',
    locationLabel: 'Potsdam',
    coordinates: { latitude: 52.3906, longitude: 13.0645 },
    tags: ['amendment', 'workflow'],
    statsLabel: '2 comments',
    reason: 'active_now',
    distanceKm: 28,
  },
  {
    id: 'landing-activity-final-vote',
    entityId: 'vote-final-climate-budget',
    type: 'vote',
    title: translateText('generated.inline.0489_final_vote_approaching_5fce0714'),
    description: translateText(
      'generated.inline.0490_members_review_the_latest_version_and_prepare_13eb2f3d'
    ),
    href: '/event/public-hearing/agenda/agenda-item-climate-budget-18',
    sourceName: 'Party Congress',
    sourceHref: '/group/party-congress',
    timestamp: new Date('2026-06-20T13:00:00.000Z'),
    startDate: new Date('2026-06-20T13:00:00.000Z'),
    status: 'opening_soon',
    locationLabel: 'Leipzig',
    coordinates: { latitude: 51.3397, longitude: 12.3731 },
    tags: ['vote', 'agenda'],
    statsLabel: '74% support',
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
