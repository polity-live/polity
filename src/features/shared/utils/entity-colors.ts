/**
 * Shared entity color definitions for use across the codebase.
 * Extracted from content-type-config.ts for reuse outside timeline code.
 */

export type EntityType =
  | 'group'
  | 'event'
  | 'agenda_item'
  | 'amendment'
  | 'vote'
  | 'election'
  | 'todo'
  | 'blog'
  | 'user'
  | 'role';

export interface EntityColorConfig {
  gradient: string;
  gradientDark: string;
  accentColor: string;
  borderColor: string;
  /** Left border color for notification cards */
  notificationBorderLeft: string;
  /** Badge background classes (light + dark) */
  badgeBg: string;
}

export const ENTITY_COLORS: Record<EntityType, EntityColorConfig> = {
  group: {
    gradient: 'from-[var(--entity-group-bg)] to-[var(--background)]',
    gradientDark: '',
    accentColor: 'text-[var(--entity-group-fg)]',
    borderColor: 'border-[var(--entity-group-border)]',
    notificationBorderLeft: 'border-l-[var(--entity-group-base)]',
    badgeBg:
      'border-[var(--entity-group-border)] bg-[var(--entity-group-bg)] text-[var(--entity-group-fg)]',
  },
  event: {
    gradient: 'from-[var(--entity-event-bg)] to-[var(--background)]',
    gradientDark: '',
    accentColor: 'text-[var(--entity-event-fg)]',
    borderColor: 'border-[var(--entity-event-border)]',
    notificationBorderLeft: 'border-l-[var(--entity-event-base)]',
    badgeBg:
      'border-[var(--entity-event-border)] bg-[var(--entity-event-bg)] text-[var(--entity-event-fg)]',
  },
  agenda_item: {
    gradient: 'from-[var(--badge-info-bg)] to-[var(--background)]',
    gradientDark: '',
    accentColor: 'text-[var(--badge-info-fg)]',
    borderColor: 'border-[var(--badge-info-border)]',
    notificationBorderLeft: 'border-l-[var(--badge-info-fg)]',
    badgeBg:
      'border-[var(--badge-info-border)] bg-[var(--badge-info-bg)] text-[var(--badge-info-fg)]',
  },
  amendment: {
    gradient: 'from-[var(--entity-amendment-bg)] to-[var(--background)]',
    gradientDark: '',
    accentColor: 'text-[var(--entity-amendment-fg)]',
    borderColor: 'border-[var(--entity-amendment-border)]',
    notificationBorderLeft: 'border-l-[var(--entity-amendment-base)]',
    badgeBg:
      'border-[var(--entity-amendment-border)] bg-[var(--entity-amendment-bg)] text-[var(--entity-amendment-fg)]',
  },
  vote: {
    gradient: 'from-[var(--badge-danger-bg)] to-[var(--background)]',
    gradientDark: '',
    accentColor: 'text-[var(--badge-danger-fg)]',
    borderColor: 'border-[var(--badge-danger-border)]',
    notificationBorderLeft: 'border-l-[var(--badge-danger-fg)]',
    badgeBg:
      'border-[var(--badge-danger-border)] bg-[var(--badge-danger-bg)] text-[var(--badge-danger-fg)]',
  },
  election: {
    gradient: 'from-[var(--badge-accent-bg)] to-[var(--background)]',
    gradientDark: '',
    accentColor: 'text-[var(--badge-accent-fg)]',
    borderColor: 'border-[var(--badge-accent-border)]',
    notificationBorderLeft: 'border-l-[var(--badge-accent-fg)]',
    badgeBg:
      'border-[var(--badge-accent-border)] bg-[var(--badge-accent-bg)] text-[var(--badge-accent-fg)]',
  },
  todo: {
    gradient: 'from-[var(--badge-success-bg)] to-[var(--background)]',
    gradientDark: '',
    accentColor: 'text-[var(--badge-success-fg)]',
    borderColor: 'border-[var(--badge-success-border)]',
    notificationBorderLeft: 'border-l-[var(--badge-success-fg)]',
    badgeBg:
      'border-[var(--badge-success-border)] bg-[var(--badge-success-bg)] text-[var(--badge-success-fg)]',
  },
  blog: {
    gradient: 'from-[var(--entity-blog-bg)] to-[var(--background)]',
    gradientDark: '',
    accentColor: 'text-[var(--entity-blog-fg)]',
    borderColor: 'border-[var(--entity-blog-border)]',
    notificationBorderLeft: 'border-l-[var(--entity-blog-base)]',
    badgeBg:
      'border-[var(--entity-blog-border)] bg-[var(--entity-blog-bg)] text-[var(--entity-blog-fg)]',
  },
  user: {
    gradient: 'from-[var(--entity-user-bg)] to-[var(--background)]',
    gradientDark: '',
    accentColor: 'text-[var(--entity-user-fg)]',
    borderColor: 'border-[var(--entity-user-border)]',
    notificationBorderLeft: 'border-l-[var(--entity-user-base)]',
    badgeBg:
      'border-[var(--entity-user-border)] bg-[var(--entity-user-bg)] text-[var(--entity-user-fg)]',
  },
  role: {
    gradient: 'from-[var(--badge-neutral-bg)] to-[var(--background)]',
    gradientDark: '',
    accentColor: 'text-[var(--badge-neutral-fg)]',
    borderColor: 'border-[var(--badge-neutral-border)]',
    notificationBorderLeft: 'border-l-[var(--badge-neutral-fg)]',
    badgeBg:
      'border-[var(--badge-neutral-border)] bg-[var(--badge-neutral-bg)] text-[var(--badge-neutral-fg)]',
  },
};
