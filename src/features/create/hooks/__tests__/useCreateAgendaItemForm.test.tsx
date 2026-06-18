/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCreateAgendaItemForm } from '../useCreateAgendaItemForm';
import type { CreateFormFieldDescriptor } from '../../types/create-form.types';

let events: {
  id: string;
  title: string;
  group_id: string | null;
  description?: string | null;
}[] = [];
let participations: { event_id: string; status: string | null }[] = [];
let activeGroupIds = new Set<string>();

vi.mock('@tanstack/react-router', () => ({
  useSearch: () => ({}),
}));

vi.mock('@rocicorp/zero/react', () => ({
  useQuery: () => [[], { type: 'complete' }],
  useZero: () => ({ mutate: vi.fn() }),
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/features/shared/logic/richText', () => ({
  richTextToPlainText: (value: unknown) => (typeof value === 'string' ? value : ''),
}));

vi.mock('@/zero/events/useEventState', () => ({
  useAllEvents: () => ({ events }),
  useAllAmendments: () => ({ amendments: [] }),
  useEventAgenda: () => ({ agendaItems: [] }),
  useRolesWithGroups: () => ({ roles: [] }),
  useUserEventParticipations: () => ({ participations }),
}));

vi.mock('@/zero/groups/useGroupState', () => ({
  useAssignableGroupMembersByGroupIds: () => ({ members: [], isLoading: false }),
  useCurrentUserActiveGroupIds: () => ({ activeGroupIds }),
  useGroupById: () => ({ group: null }),
}));

vi.mock('@/zero/mutate-with-server-check', () => ({
  serverConfirmed: vi.fn(),
}));

function findField<TKind extends CreateFormFieldDescriptor['kind']>(
  fields: CreateFormFieldDescriptor[],
  key: string,
  kind: TKind
): Extract<CreateFormFieldDescriptor, { kind: TKind }> {
  const field = fields.find(candidate => candidate.key === key && candidate.kind === kind);
  if (!field) {
    throw new Error(`Field ${key} not found`);
  }
  return field as Extract<CreateFormFieldDescriptor, { kind: TKind }>;
}

describe('useCreateAgendaItemForm', () => {
  beforeEach(() => {
    activeGroupIds = new Set(['group-1']);
    participations = [{ event_id: 'event-participant', status: 'confirmed' }];
    events = [
      { id: 'event-member', title: 'Member group event', group_id: 'group-1' },
      { id: 'event-participant', title: 'Participating event', group_id: 'group-2' },
      { id: 'event-unrelated', title: 'Unrelated event', group_id: 'group-2' },
    ];
  });

  it('orders title and description before event choice and filters selectable events', () => {
    const { result } = renderHook(() => useCreateAgendaItemForm());
    const fields = result.current.steps[0].fields ?? [];

    expect(fields.slice(0, 3).map(field => field.key)).toEqual(['title', 'description', 'event']);

    const eventField = findField(fields, 'event', 'typeahead');
    const eventIds = (
      eventField.props as unknown as { items: readonly { id: string }[] }
    ).items.map(item => item.id);

    expect(eventIds.sort()).toEqual(['event-member', 'event-participant']);
  });
});
