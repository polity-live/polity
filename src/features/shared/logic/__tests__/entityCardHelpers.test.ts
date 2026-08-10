import {
  Award,
  BookOpen,
  Calendar,
  CheckSquare,
  FileText,
  ListOrdered,
  User,
  UserCheck,
  Users,
  Vote,
} from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => `translated:${key}`,
}));

import { ENTITY_COLORS, type EntityType } from '@/features/shared/utils/entity-colors';
import { formatEntityLabel, getEntityGradient, getEntityIcon } from '../entityCardHelpers';

describe('entityCardHelpers', () => {
  it.each(Object.keys(ENTITY_COLORS) as EntityType[])(
    'builds the configured gradient for %s',
    entityType => {
      expect(getEntityGradient(entityType)).toBe(
        `bg-gradient-to-br ${ENTITY_COLORS[entityType].gradient} ${ENTITY_COLORS[entityType].gradientDark}`
      );
    }
  );

  it.each([
    ['group', Users],
    ['event', Calendar],
    ['agenda_item', ListOrdered],
    ['amendment', FileText],
    ['vote', Vote],
    ['election', Award],
    ['todo', CheckSquare],
    ['blog', BookOpen],
    ['user', User],
    ['role', UserCheck],
    ['unknown', FileText],
  ])('maps %s to its icon', (entityType, icon) => {
    expect(getEntityIcon(entityType)).toBe(icon);
  });

  it.each([
    [{ first_name: 'Ada', last_name: 'Lovelace' }, 'Ada Lovelace'],
    [{ first_name: 'Ada' }, 'Ada'],
    [{ last_name: 'Lovelace' }, 'Lovelace'],
    [{ handle: '@ada', name: 'Ada' }, '@ada'],
    [{ name: 'Ada' }, 'Ada'],
    [{}, 'translated:common.unknownUser'],
  ])('formats user fields %j as %s', (entity, expected) => {
    expect(formatEntityLabel(entity, 'user')).toBe(expected);
  });

  it.each([
    ['agenda_item', { title: 'Agenda title', name: 'Agenda name' }, 'Agenda title'],
    ['agenda_item', { name: 'Agenda name' }, 'Agenda name'],
    ['agenda_item', {}, 'translated:features.search.entityLabels.agenda_item'],
    ['amendment', { code: 'A-1', title: 'Title', name: 'Name' }, 'A-1'],
    ['amendment', { title: 'Title', name: 'Name' }, 'Title'],
    ['amendment', { name: 'Name' }, 'Name'],
    ['amendment', {}, 'translated:features.search.entityLabels.amendment'],
    ['todo', { title: 'Todo title', name: 'Todo name' }, 'Todo title'],
    ['todo', { name: 'Todo name' }, 'Todo name'],
    ['todo', {}, 'translated:features.search.entityLabels.todo'],
    ['event', { name: 'Event name', title: 'Event title' }, 'Event name'],
    ['event', { title: 'Event title' }, 'Event title'],
    ['event', {}, 'translated:common.unknown'],
  ] as const)('formats %s fields %j', (entityType, entity, expected) => {
    expect(formatEntityLabel(entity, entityType)).toBe(expected);
  });
});
