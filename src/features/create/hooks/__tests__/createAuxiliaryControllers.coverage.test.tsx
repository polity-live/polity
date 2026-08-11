/* @vitest-environment jsdom */

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  groups: [] as any[],
  roles: undefined as any,
  elections: undefined as any,
  events: [] as any[],
  amendments: undefined as any,
  users: undefined as any,
  preference: { createFormStyle: 'auto', isLoading: false } as any,
  isMobile: false,
  updateFormStyle: vi.fn(),
  toastError: vi.fn(),
  toastInfo: vi.fn(),
  observers: [] as any[],
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/features/shared/ui/typeahead/toTypeaheadItems', () => ({
  toTypeaheadItems: (
    values: any[],
    type: string,
    label: any,
    description?: any,
    image?: any,
    href?: any
  ) =>
    values.map(value => ({
      id: value.id,
      type,
      label: label(value),
      description: description?.(value),
      image: image?.(value),
      href: href?.(value),
    })),
}));
vi.mock('@/zero/groups/useGroupState', () => ({ useAllGroups: () => ({ groups: mocks.groups }) }));
vi.mock('@/zero/events/useEventState', () => ({
  useRolesWithGroups: () => ({ roles: mocks.roles }),
  useAllEvents: () => ({ events: mocks.events }),
  useAllAmendments: () => ({ amendments: mocks.amendments }),
}));
vi.mock('@/zero/elections/useElectionState', () => ({
  useElectionState: () => ({ electionsForSearch: mocks.elections }),
}));
vi.mock('@/zero/users/useUserState', () => ({ useUserState: () => ({ allUsers: mocks.users }) }));
vi.mock('@/zero/preferences/usePreferenceState', () => ({
  usePreferenceState: () => mocks.preference,
}));
vi.mock('@/zero/preferences/usePreferenceActions', () => ({
  usePreferenceActions: () => ({ updateFormStyle: mocks.updateFormStyle }),
}));
vi.mock('@/features/timeline/hooks/useIsMobile', () => ({
  useIsMobile: () => mocks.isMobile,
  BREAKPOINTS: { lg: 1024 },
}));
vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { error: mocks.toastError, info: mocks.toastInfo },
}));

import { useGroupRelationshipsInputController } from '../useGroupRelationshipsInputController';
import { useRoleSearchInputController } from '../../ui/inputs/useRoleSearchInputController';
import { useElectionSearchInputController } from '../useElectionSearchInputController';
import { useEventSearchInputController } from '../../ui/inputs/useEventSearchInputController';
import { useAmendmentSearchInputController } from '../../ui/inputs/useAmendmentSearchInputController';
import { useUserSearchInputController } from '../useUserSearchInputController';
import { useCreateDescriptorFieldState } from '../useCreateDescriptorFieldState';
import { useFormStyle } from '../useFormStyle';
import { useFormStyleSelectorController } from '../useFormStyleSelectorController';
import { useOnePageFormLayoutController } from '../useOnePageFormLayoutController';

beforeEach(() => {
  mocks.groups = [];
  mocks.roles = undefined;
  mocks.elections = undefined;
  mocks.events = [];
  mocks.amendments = undefined;
  mocks.users = undefined;
  mocks.preference = { createFormStyle: 'auto', isLoading: false };
  mocks.isMobile = false;
  mocks.updateFormStyle.mockClear();
  mocks.toastError.mockClear();
  mocks.toastInfo.mockClear();
  mocks.observers = [];
  vi.useFakeTimers();
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      callback: any;
      observe = vi.fn();
      disconnect = vi.fn();
      constructor(callback: any) {
        this.callback = callback;
        mocks.observers.push(this);
      }
    }
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('group relationship controller', () => {
  it('filters groups, maps fallbacks, validates, adds, updates, toggles, and removes', () => {
    mocks.groups = [
      { id: 'g1', name: '', description: 'A'.repeat(80) },
      { id: 'g2', name: 'Second', description: 5 },
      { id: 'g3', name: 'Linked', description: 'Linked' },
    ];
    const onChange = vi.fn();
    const initial = [
      {
        groupId: 'g3',
        groupName: 'Linked',
        relationshipType: 'isParent',
        rights: ['informationRight'],
      },
      {
        groupId: 'g4',
        groupName: 'Other',
        relationshipType: 'isParent',
        rights: ['informationRight'],
      },
    ] as any;
    const { result, rerender } = renderHook(
      ({ value }) => useGroupRelationshipsInputController({ value, onChange }),
      { initialProps: { value: initial } }
    );
    expect(result.current.groupItems.map(item => item.label)).toEqual(['Group', 'Second']);
    expect(result.current.groupItems[0].description).toHaveLength(60);
    expect(result.current.groupItems[1].description).toBeUndefined();
    act(() => result.current.handleAdd());
    expect(mocks.toastError).toHaveBeenCalledOnce();
    act(() => result.current.toggleRight('informationRight'));
    expect(result.current.selectedRights.has('informationRight')).toBe(true);
    act(() => result.current.toggleRight('informationRight'));
    expect(result.current.selectedRights.has('informationRight')).toBe(false);
    act(() => {
      result.current.toggleRight('amendmentRight');
      result.current.handleGroupChange({ id: 'missing' } as any);
    });
    act(() => result.current.handleAdd());
    expect(onChange).not.toHaveBeenCalled();
    act(() => result.current.handleGroupChange({ id: 'g1' } as any));
    act(() => result.current.handleAdd());
    expect(onChange).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ groupId: 'g1', groupName: '' })])
    );

    rerender({ value: initial });
    act(() => {
      result.current.setRelationshipType('isChild');
      result.current.toggleRight('rightToSpeak');
      result.current.handleGroupChange({ id: 'g3' } as any);
    });
    act(() => result.current.handleAdd());
    expect(mocks.toastInfo).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ groupId: 'g3', relationshipType: 'isChild' }),
      expect.objectContaining({ groupId: 'g4' }),
    ]);
    act(() => result.current.handleGroupChange(null));
    expect(result.current.selectedGroupId).toBe('');
    act(() => result.current.handleRemove('g3'));
    expect(onChange).toHaveBeenLastCalledWith([expect.objectContaining({ groupId: 'g4' })]);
  });
});

describe('search controllers', () => {
  it('covers role filtering, labels, descriptions, defaults, and selection clearing', () => {
    mocks.roles = [
      { id: 'r1', title: '', description: 'A'.repeat(80), group_id: 'g1' },
      { id: 'r2', title: 'Role 2', description: 5, group_id: null },
      { id: 'r3', title: 'Role 3', group_id: 'g2' },
    ];
    const onChange = vi.fn();
    const { result, rerender } = renderHook(
      ({ groupIds, placeholder }: any) =>
        useRoleSearchInputController({ value: '', onChange, groupIds, placeholder }),
      {
        initialProps: { groupIds: undefined, placeholder: undefined } as {
          groupIds?: string[];
          placeholder?: string;
        },
      }
    );
    expect(result.current.items.map(item => item.label)).toEqual(['Role', 'Role 2', 'Role 3']);
    rerender({ groupIds: [], placeholder: 'Custom' });
    expect(result.current.filteredRoles).toHaveLength(3);
    rerender({ groupIds: ['g1'], placeholder: 'Custom' });
    expect(result.current.filteredRoles.map((role: any) => role.id)).toEqual(['r1']);
    act(() => {
      result.current.handleChange({ id: 'r1' } as any);
      result.current.handleChange(null);
    });
    expect(onChange).toHaveBeenNthCalledWith(1, 'r1');
    expect(onChange).toHaveBeenNthCalledWith(2, '');
    mocks.roles = undefined;
    rerender({ groupIds: ['g1'], placeholder: 'Custom' });
    expect(result.current.filteredRoles).toEqual([]);
  });

  it('covers election filtering and empty source fallbacks', () => {
    mocks.elections = [
      { id: 'e1', title: '', description: 'A'.repeat(80) },
      { id: 'e2', title: 'Election 2', description: 5 },
    ];
    const onChange = vi.fn();
    const { result, rerender } = renderHook(
      ({ allowedElectionIds }) =>
        useElectionSearchInputController({ onChange, allowedElectionIds }),
      { initialProps: { allowedElectionIds: undefined as readonly string[] | undefined } }
    );
    expect(result.current.items.map(item => item.label)).toEqual(['Election', 'Election 2']);
    rerender({ allowedElectionIds: ['e2'] });
    expect(result.current.items.map(item => item.id)).toEqual(['e2']);
    mocks.elections = undefined;
    rerender({ allowedElectionIds: ['e2'] });
    expect(result.current.items).toEqual([]);
    rerender({ allowedElectionIds: undefined });
    expect(result.current.items).toEqual([]);
    act(() => {
      result.current.handleChange({ id: 'e1' } as any);
      result.current.handleChange(null);
    });
    expect(onChange).toHaveBeenCalledWith('e1');
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('covers event filtering, fallbacks, hrefs, and clearing', () => {
    mocks.events = [
      { id: 'ev1', title: '', description: 'A'.repeat(80), group_id: 'g1' },
      { id: 'ev2', title: 'Second', description: 5, group_id: 'g2' },
    ];
    const onChange = vi.fn();
    const { result, rerender } = renderHook(
      ({ filterByGroupId, placeholder }: any) =>
        useEventSearchInputController({ value: '', onChange, filterByGroupId, placeholder }),
      {
        initialProps: { filterByGroupId: undefined, placeholder: undefined } as {
          filterByGroupId?: string;
          placeholder?: string;
        },
      }
    );
    expect(result.current.items[0]).toMatchObject({ label: 'Event', href: '/event/ev1' });
    rerender({ filterByGroupId: 'g2', placeholder: 'Custom' });
    expect(result.current.items.map(item => item.id)).toEqual(['ev2']);
    act(() => {
      result.current.handleChange({ id: 'ev2' } as any);
      result.current.handleChange(null);
    });
    expect(onChange).toHaveBeenCalledWith('ev2');
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('covers amendment nullish data, title fallback, href, and clearing', () => {
    const onChange = vi.fn();
    let view = renderHook(() => useAmendmentSearchInputController({ value: '', onChange }));
    expect(view.result.current.items).toEqual([]);
    cleanup();
    mocks.amendments = [
      { id: 'a1', title: '' },
      { id: 'a2', title: 'Second' },
    ];
    view = renderHook(() =>
      useAmendmentSearchInputController({ value: '', onChange, placeholder: 'Custom' })
    );
    expect(view.result.current.items[0]).toMatchObject({
      label: 'Amendment',
      href: '/amendment/a1',
    });
    act(() => {
      view.result.current.handleChange({ id: 'a1' } as any);
      view.result.current.handleChange(null);
    });
    expect(onChange).toHaveBeenCalledWith('a1');
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('covers user exclusion, allowlists, and name/description fallbacks', () => {
    mocks.users = [
      {
        id: 'u1',
        first_name: 'Ada',
        last_name: 'Lovelace',
        handle: 'ada',
        email: 'ada@example.com',
        avatar: 'a',
      },
      { id: 'u2', first_name: '', last_name: '', handle: 'handle', email: 'h@example.com' },
      { id: 'u3', first_name: '', last_name: '', handle: '', email: 'mail@example.com' },
      { id: 'u4', first_name: '', last_name: '', handle: '', email: '' },
    ];
    const { result, rerender } = renderHook((props: any) => useUserSearchInputController(props), {
      initialProps: {
        excludeUserId: 'u1',
        excludeUserIds: ['u2'],
        allowedUserIds: ['u3', 'u4'],
      } as {
        excludeUserId?: string;
        excludeUserIds: string[];
        allowedUserIds?: string[];
      },
    });
    expect(result.current.items.map(item => item.label)).toEqual(['User', 'User']);
    expect(result.current.items[0].description).toBe('mail@example.com');
    rerender({ excludeUserId: undefined, excludeUserIds: [], allowedUserIds: undefined });
    expect(result.current.items.map(item => item.label)).toEqual([
      'Ada Lovelace',
      'handle',
      'User',
      'User',
    ]);
    mocks.users = undefined;
    rerender({ excludeUserId: undefined, excludeUserIds: [], allowedUserIds: undefined });
    expect(result.current.items).toEqual([]);
  });
});

describe('descriptor and form-style controllers', () => {
  it('covers descriptor required, invalid, valid, hint, and normalized values', () => {
    const validator = (value: string) => (value === 'bad' ? 'Bad value' : null);
    const { result, rerender } = renderHook((props: any) => useCreateDescriptorFieldState(props), {
      initialProps: {
        value: null,
        required: false,
        validator: undefined,
        hint: undefined,
      } as {
        value: unknown;
        required: boolean;
        validator?: (value: string) => string | null;
        hint?: string;
      },
    });
    expect(result.current.hintText).toBe('pages.create.common.optionalHint');
    rerender({ value: '', required: true, validator, hint: undefined });
    act(() => result.current.markInteracted());
    expect(result.current).toMatchObject({
      isInvalid: true,
      isValid: false,
      hintText: 'pages.create.common.requiredHint',
    });
    rerender({ value: 'bad', required: true, validator, hint: undefined });
    expect(result.current.hintText).toBe('Bad value');
    rerender({ value: 42, required: true, validator, hint: undefined });
    expect(result.current).toMatchObject({
      isInvalid: false,
      isValid: true,
      hintText: 'pages.create.common.validHint',
    });
    rerender({ value: 'ok', required: false, validator: undefined, hint: 'Custom hint' });
    expect(result.current.hintText).toBe('Custom hint');
  });

  it('resolves override, preference, automatic mobile, and explicit styles', () => {
    let view = renderHook(() => useFormStyle());
    expect(view.result.current.formMode).toBe('one_page');
    cleanup();
    mocks.isMobile = true;
    view = renderHook(() => useFormStyle());
    expect(view.result.current.formMode).toBe('carousel');
    cleanup();
    view = renderHook(() => useFormStyle('one_page'));
    expect(view.result.current.formMode).toBe('one_page');
    cleanup();
    view = renderHook(() => useFormStyle('carousel'));
    expect(view.result.current.formMode).toBe('carousel');
  });

  it('uses controlled style updates or persisted actions', () => {
    const onChange = vi.fn();
    let view = renderHook(() => useFormStyleSelectorController({ value: 'carousel', onChange }));
    expect(view.result.current.selectedFormStyle).toBe('carousel');
    act(() => view.result.current.handleStyleChange('one_page'));
    expect(onChange).toHaveBeenCalledWith('one_page');
    cleanup();
    view = renderHook(() => useFormStyleSelectorController({}));
    expect(view.result.current.selectedFormStyle).toBe('auto');
    act(() => view.result.current.handleStyleChange('carousel'));
    expect(mocks.updateFormStyle).toHaveBeenCalledWith('carousel');
  });
});

describe('one-page layout controller', () => {
  it('tracks intersections, scrolling, validity, and missing invalid reasons', () => {
    const onStepChange = vi.fn();
    const valid = { label: 'Valid', isValid: () => true } as any;
    const invalid = {
      label: 'Invalid',
      isValid: () => false,
      getInvalidReason: () => 'Fix it',
    } as any;
    const { result, rerender } = renderHook(
      ({ steps }) => useOnePageFormLayoutController({ steps, onStepChange }),
      { initialProps: { steps: [valid] } }
    );
    const first = document.createElement('div');
    const second = document.createElement('div');
    result.current.sectionRefs.current = [first, null];
    rerender({ steps: [valid, invalid] });
    expect(result.current).toMatchObject({
      allStepsValid: false,
      invalidReason: 'Fix it',
      stepLabels: ['Valid', 'Invalid'],
    });
    expect(mocks.observers.at(-1).observe).toHaveBeenCalledWith(first);
    act(() =>
      mocks.observers.at(-1).callback([
        { isIntersecting: false, target: first },
        { isIntersecting: true, target: document.createElement('div') },
        { isIntersecting: true, target: first },
      ])
    );
    expect(onStepChange).toHaveBeenCalledWith(0);
    result.current.sectionRefs.current[1] = second;
    second.scrollIntoView = vi.fn();
    act(() => result.current.onStepClick(1));
    expect(result.current.activeSection).toBe(1);
    act(() => mocks.observers.at(-1).callback([{ isIntersecting: true, target: first }]));
    act(() => vi.advanceTimersByTime(500));
    act(() => mocks.observers.at(-1).callback([{ isIntersecting: true, target: first }]));
    expect(result.current.activeSection).toBe(0);
    act(() => result.current.onStepClick(3));
    rerender({ steps: [{ label: 'Invalid', isValid: () => false } as any] });
    expect(result.current.invalidReason).toBeNull();
    expect(mocks.observers[0].disconnect).toHaveBeenCalled();
  });
});
