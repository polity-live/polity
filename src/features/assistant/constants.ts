import { translate as translateText } from '@/features/shared/hooks/use-translation';
/**
 * Assistant Constants
 * System-level constants for the Aria & Kai personal assistant
 */

/**
 * Aria & Kai - Personal Assistant Duo
 * A special system user that provides onboarding and help to new users
 */
export const ARIA_KAI_USER_ID = 'a12a0000-0000-4000-a000-000000000001';
export const ARIA_KAI_EMAIL = 'aria-kai-assistants@polity.com';
export const ARIA_KAI_AVATAR_URL = '/avatars/aria-kai-avatar-256.webp';
export const ARIA_KAI_WELCOME_MESSAGE =
  'Hey, we are Assistent Aria & Kai! Welcome to Polity! We would love to show you around in the app. Shall we?';

/**
 * Educational content for the interactive tutorial
 */
export const ENTITY_DESCRIPTIONS = {
  overview: {
    title: translateText('generated.inline.0022_welcome_to_polity_1b9e7a4c'),
    message: translateText(
      'generated.inline.0023_we_re_excited_to_help_you_get_started_polity__b88c3cd9'
    ),
  },
  groups: {
    title: translateText('generated.inline.0024_groups_ae9629f4'),
    message: translateText(
      'generated.inline.0025_groups_are_the_foundation_of_collaboration_on_27481b4c'
    ),
  },
  events: {
    title: translateText('generated.inline.0026_events_c5497bca'),
    message: translateText(
      'generated.inline.0027_events_help_you_organize_meetings_conferences_177aaa8c'
    ),
  },
  amendments: {
    title: translateText('generated.inline.0028_amendments_change_requests_9bbe783a'),
    message: translateText(
      'generated.inline.0029_amendments_and_change_requests_enable_collabo_603fdecf'
    ),
  },
  blogs: {
    title: translateText('generated.inline.0030_blogs_5ef44397'),
    message: translateText(
      'generated.inline.0031_blogs_let_you_share_ideas_updates_and_announc_1a1d1885'
    ),
  },
  elections: {
    title: translateText('generated.inline.0032_elections_roles_eeca29d2'),
    message: translateText(
      'generated.inline.0033_elections_and_roles_bring_democratic_governan_81f6bd17'
    ),
  },
} as const;

export const ENTITY_TUTORIAL_ACTIONS = {
  overview: {
    labelKey: 'components.ariaKaiActions.showMe',
    tutorial_step: 1,
  },
  groups: {
    labelKey: 'components.ariaKaiActions.groups',
    tutorial_step: 2,
  },
  events: {
    labelKey: 'components.ariaKaiActions.events',
    tutorial_step: 3,
  },
  amendments: {
    labelKey: 'components.ariaKaiActions.amendments',
    tutorial_step: 4,
  },
  blogs: {
    labelKey: 'components.ariaKaiActions.blogs',
    tutorial_step: 5,
  },
  elections: {
    labelKey: 'components.ariaKaiActions.elections',
    tutorial_step: 6,
  },
} as const;

export const ENTITY_TUTORIAL_TOPICS = [
  'groups',
  'events',
  'amendments',
  'blogs',
  'elections',
] as const;

export type EntityTopic = keyof typeof ENTITY_DESCRIPTIONS;
export type EntityTutorialTopic = (typeof ENTITY_TUTORIAL_TOPICS)[number];
