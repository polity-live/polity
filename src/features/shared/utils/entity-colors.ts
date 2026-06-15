import { getEntityGradientClasses, getEntityToneClasses } from '@/features/shared/theme';

/**
 * Shared entity color definitions for use across the codebase.
 * Kept as a compatibility layer over the Civic Atelier token helpers.
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

function createEntityColorConfig(entityType: EntityType): EntityColorConfig {
  const tone = getEntityToneClasses(entityType);
  const isPrimary = ['group', 'event', 'amendment', 'blog', 'user'].includes(entityType);
  const notificationBorderLeft = isPrimary
    ? `border-l-[var(--entity-${entityType}-base)]`
    : SECONDARY_NOTIFICATION_BORDERS[
        entityType as Exclude<EntityType, 'group' | 'event' | 'amendment' | 'blog' | 'user'>
      ];

  return {
    gradient: getEntityGradientClasses(entityType),
    gradientDark: '',
    accentColor: tone.text,
    borderColor: tone.border,
    notificationBorderLeft,
    badgeBg: tone.badge,
  };
}

const SECONDARY_NOTIFICATION_BORDERS: Record<
  Exclude<EntityType, 'group' | 'event' | 'amendment' | 'blog' | 'user'>,
  string
> = {
  agenda_item: 'border-l-[var(--badge-info-fg)]',
  vote: 'border-l-[var(--badge-danger-fg)]',
  election: 'border-l-[var(--badge-accent-fg)]',
  todo: 'border-l-[var(--badge-success-fg)]',
  role: 'border-l-[var(--badge-neutral-fg)]',
};

export const ENTITY_COLORS: Record<EntityType, EntityColorConfig> = {
  group: createEntityColorConfig('group'),
  event: createEntityColorConfig('event'),
  agenda_item: createEntityColorConfig('agenda_item'),
  amendment: createEntityColorConfig('amendment'),
  vote: createEntityColorConfig('vote'),
  election: createEntityColorConfig('election'),
  todo: createEntityColorConfig('todo'),
  blog: createEntityColorConfig('blog'),
  user: createEntityColorConfig('user'),
  role: createEntityColorConfig('role'),
};
