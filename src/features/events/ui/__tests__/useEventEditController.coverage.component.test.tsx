/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useEventEditController } from '../useEventEditController';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  can: vi.fn(),
  manageIds: new Set<string>(),
  groups: [] as any[],
  eventUpdate: {} as any,
  hasOpenSnapshot: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => `t:${key}` }),
}));
vi.mock('@/zero/rbac', () => ({ usePermissions: () => ({ can: mocks.can }) }));
vi.mock('@/zero/groups/useGroupState', () => ({
  useAllGroups: () => ({ groups: mocks.groups }),
  useUserGroupsWithManageEvents: () => ({ manageEventGroupIds: mocks.manageIds }),
}));
vi.mock('@/features/events/hooks/useEventUpdate', () => ({
  useEventUpdate: () => mocks.eventUpdate,
}));
vi.mock('@/zero/events/attendance-mode', () => ({
  hasOpenElectorateSnapshot: (...args: unknown[]) => mocks.hasOpenSnapshot(...args),
}));
vi.mock('@/features/shared/logic/locationHelpers', () => ({
  formatNamedLocation: (name: string, address: Record<string, unknown>) =>
    `${name}:${Object.values(address).join('|')}`,
}));
vi.mock('@/features/shared/ui/typeahead/toTypeaheadItems', () => ({
  toTypeaheadItems: (
    groups: any[],
    _type: string,
    getName: (group: any) => string,
    getDescription: (group: any) => string | undefined,
    _unused: unknown,
    getHref: (group: any) => string
  ) =>
    groups.map(group => ({
      id: group.id,
      name: getName(group),
      description: getDescription(group),
      href: getHref(group),
    })),
}));

function formData(overrides: Record<string, unknown> = {}) {
  return {
    attendanceMode: 'generated.inline.0035_online_2dbc2fd2',
    city: 'Berlin',
    country: 'DE',
    groupId: '',
    houseNumber: '1',
    locationName: 'Town hall',
    postCode: '10115',
    region: 'Berlin',
    street: 'Main',
    title: 'Event',
    visibility: 'generated.inline.0030_public_61c9b2b1',
    ...overrides,
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.can.mockReturnValue(true);
  mocks.manageIds = new Set(['manageable']);
  mocks.groups = [
    { id: 'manageable', name: 'Manageable', description: 'A'.repeat(70) },
    { id: 'selected', name: '', description: { type: 'doc' } },
  ];
  mocks.hasOpenSnapshot.mockImplementation(value => value === 'open');
  mocks.eventUpdate = {
    formData: formData(),
    setFormData: vi.fn(),
    updateDescriptionContent: vi.fn(),
    updateField: vi.fn(),
    removeImage: vi.fn(),
    handleSubmit: vi.fn(),
    isSubmitting: false,
    event: { agenda_items: [{ votes: null, election: null }] },
    isLoading: false,
    isCreating: false,
    timeSeriesValidationError: null,
  };
});

describe('useEventEditController coverage', () => {
  it('derives editable labels, groups, location, and tab callbacks', () => {
    const onTabChange = vi.fn();
    const { result, rerender } = renderHook(
      ({ defaultTab }) => useEventEditController({ eventId: 'event-1', defaultTab, onTabChange }),
      {
        initialProps: {
          defaultTab: 'time-series' as 'time-series' | 'basic-info',
        },
      }
    );
    expect(result.current).toMatchObject({
      activeTab: 'time-series',
      canDeleteEvent: true,
      visibilityLabel: 't:pages.create.common.public',
      attendanceModeLabel: 'Online',
      timeSeriesValidationMessage: null,
      attendanceModeLocked: false,
    });
    expect(result.current.locationSummary).toContain('Town hall');
    expect(result.current.groupTypeaheadItems[0]).toMatchObject({
      name: 'Manageable',
      description: 'A'.repeat(60),
      href: '/group/manageable',
    });
    act(() => result.current.onTabChange('event-type'));
    expect(onTabChange).toHaveBeenCalledWith('event-type');
    rerender({ defaultTab: 'basic-info' });
    expect(result.current.activeTab).toBe('basic-info');
  });

  it('covers visibility, attendance, validation, locking, and selected-group variants', () => {
    mocks.eventUpdate = {
      ...mocks.eventUpdate,
      formData: formData({
        attendanceMode: 'generated.inline.0036_hybrid_e2ac482d',
        groupId: 'selected',
        visibility: 'generated.inline.0031_authenticated_8fda38ce',
      }),
      event: { agenda_items: [{ votes: 'open', election: null }] },
      timeSeriesValidationError: 'missing-start-date',
    };
    const hybrid = renderHook(() => useEventEditController({ eventId: 'event-1' }));
    expect(hybrid.result.current).toMatchObject({
      attendanceModeLabel: 'Hybrid',
      visibilityLabel: 't:pages.create.common.authenticated',
      attendanceModeLocked: true,
      timeSeriesValidationMessage:
        't:features.events.editPage.timeSeries.validation.startDateRequired',
    });
    expect(hybrid.result.current.selectableGroups.map(group => group.id)).toEqual([
      'selected',
      'manageable',
    ]);
    expect(hybrid.result.current.groupTypeaheadItems[0]).toMatchObject({
      name: 'Group',
      description: undefined,
    });
    hybrid.unmount();

    mocks.manageIds = new Set(['selected']);
    mocks.eventUpdate = {
      ...mocks.eventUpdate,
      formData: formData({ attendanceMode: 'offline', groupId: 'selected', visibility: 'private' }),
      event: { agenda_items: [{ votes: null, election: 'open' }] },
      timeSeriesValidationError: 'missing-weekdays',
    };
    const offline = renderHook(() => useEventEditController({ eventId: 'event-1' }));
    expect(offline.result.current).toMatchObject({
      attendanceModeLabel: 'Offline',
      visibilityLabel: 't:pages.create.common.private',
      attendanceModeLocked: true,
      timeSeriesValidationMessage:
        't:features.events.editPage.timeSeries.validation.weekdaysRequired',
    });
    expect(offline.result.current.selectableGroups.map(group => group.id)).toEqual(['selected']);
    offline.unmount();

    mocks.manageIds = new Set(['manageable']);
    mocks.eventUpdate = {
      ...mocks.eventUpdate,
      formData: formData({ groupId: 'missing' }),
      event: undefined,
    };
    const missing = renderHook(() => useEventEditController({ eventId: 'new', mode: 'create' }));
    expect(missing.result.current).toMatchObject({
      canDeleteEvent: false,
      attendanceModeLocked: false,
    });
    expect(missing.result.current.selectableGroups.map(group => group.id)).toEqual(['manageable']);
  });

  it('runs create review, direct submit, optional tab, and form submission paths', () => {
    mocks.eventUpdate = { ...mocks.eventUpdate, isCreating: true };
    const create = renderHook(() => useEventEditController({ eventId: 'new', mode: 'create' }));
    const event = { preventDefault: vi.fn() } as any;
    act(() => create.result.current.onFormSubmit(event));
    expect(event.preventDefault).toHaveBeenCalled();
    expect(create.result.current.showReview).toBe(true);
    act(() => create.result.current.onTabChange('time-series'));

    const requestSubmit = vi.fn();
    Object.defineProperty(create.result.current.formRef, 'current', {
      configurable: true,
      value: { requestSubmit },
    });
    act(() => create.result.current.confirmCreate());
    expect(requestSubmit).toHaveBeenCalled();
    create.unmount();

    mocks.eventUpdate = { ...mocks.eventUpdate, isCreating: false };
    const edit = renderHook(() => useEventEditController({ eventId: 'event-1' }));
    const submitEvent = { preventDefault: vi.fn() } as any;
    act(() => edit.result.current.onFormSubmit(submitEvent));
    expect(mocks.eventUpdate.handleSubmit).toHaveBeenCalledWith(submitEvent);
    act(() => edit.result.current.confirmCreate());
  });
});
