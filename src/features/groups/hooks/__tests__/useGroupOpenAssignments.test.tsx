/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GroupOpenAssignment } from '@/features/groups/logic/openAssignments';
import { useGroupOpenAssignments } from '../useGroupOpenAssignments';

const navigateMock = vi.fn();
let roles: {
  id: string;
  title?: string | null;
  assignment_mode?: string | null;
  scope?: string | null;
  elections?: unknown[];
}[] = [];
let events: {
  id: string;
  title?: string | null;
  status?: string | null;
  start_date?: number | null;
  end_date?: number | null;
  group_id?: string | null;
}[] = [];

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('@rocicorp/zero/react', () => ({
  useQuery: () => [[], { type: 'complete' }],
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string) => key,
  }),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));

vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/zero/amendments/useAmendmentActions', () => ({
  useAmendmentActions: () => ({
    completeProcessTaskWithEvent: vi.fn(),
  }),
}));

vi.mock('@/zero/events/useEventState', () => ({
  useGroupEventsForCalendar: () => ({ events }),
}));

vi.mock('@/zero/groups/useGroupState', () => ({
  useGroupById: (groupId: string) => ({ group: { id: groupId, name: 'Source group' } }),
  useGroupRoles: () => ({ roles, isLoading: false }),
}));

describe('useGroupOpenAssignments', () => {
  beforeEach(() => {
    navigateMock.mockClear();
    roles = [
      {
        id: 'chairperson',
        title: 'Chairperson',
        assignment_mode: 'elected',
        scope: 'group',
        elections: [],
      },
    ];
    events = [
      {
        id: 'event-1',
        title: 'Local assembly',
        status: 'planned',
        start_date: Date.now() + 60_000,
        group_id: 'group-1',
      },
    ];
  });

  it('navigates role-renewal scheduling into the create agenda item flow', async () => {
    const assignment: GroupOpenAssignment = {
      id: 'role:chairperson',
      kind: 'role_renewal',
      status: 'open',
      title: 'Role renewal for Chairperson',
      description: 'This role needs a new election once a suitable event is planned.',
      roleId: 'chairperson',
      linkedEvent: null,
    };
    const { result } = renderHook(() => useGroupOpenAssignments('group-1'));

    await act(async () => {
      await result.current.scheduleRoleRenewal(assignment, 'event-1');
    });

    expect(navigateMock).toHaveBeenCalledWith({
      to: '/create/agenda-item',
      search: {
        type: 'election',
        eventId: 'event-1',
        sourceGroupId: 'group-1',
        assignmentId: 'role:chairperson',
      },
    });
  });
});
