/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  formData: {} as Record<string, any>,
  allGroups: [] as any[],
  roles: null as any[] | null,
  connections: [] as any[],
  preflight: { blocking: false, isLoading: false } as Record<string, any>,
  preflightInput: null as any,
  preflightOptions: null as any,
  handleSubmit: vi.fn(),
  setFormData: vi.fn(),
  updateDescriptionContent: vi.fn(),
  updateField: vi.fn(),
  removeImage: vi.fn(),
}));

vi.mock('../../hooks/useGroupUpdate', () => ({
  useGroupUpdate: vi.fn(() => ({
    formData: mocks.formData,
    setFormData: mocks.setFormData,
    updateDescriptionContent: mocks.updateDescriptionContent,
    updateField: mocks.updateField,
    removeImage: mocks.removeImage,
    handleSubmit: mocks.handleSubmit,
    isSubmitting: false,
  })),
}));
vi.mock('@/zero/groups/useGroupState', () => ({
  useAllGroups: () => ({ groups: mocks.allGroups }),
  useGroupState: () => ({ roles: mocks.roles }),
}));
vi.mock('@/zero/network', () => ({
  useGroupConnectionState: () => ({ groupConnections: mocks.connections }),
}));
vi.mock('@/features/shared/ui/status', () => ({ RIGHT_TYPES: ['manage'] }));
vi.mock('@/features/network/logic/groupConnectionComposer', () => ({
  canonicalGroupPair: (left: string, right: string) => ({
    group_a_id: [left, right].sort()[0],
    group_b_id: [left, right].sort()[1],
  }),
  getExpandedRightDirections: (direction: string) =>
    direction === 'none'
      ? []
      : direction === 'mutual'
        ? ['current_grants_right_to_partner', 'partner_grants_right_to_current']
        : [direction],
  getGrantEndpointsForRightDirection: (direction: string, current: string, partner: string) =>
    direction === 'current_grants_right_to_partner'
      ? { holder_group_id: partner, scope_group_id: current }
      : { holder_group_id: current, scope_group_id: partner },
}));
vi.mock('../../hooks/useGroupConflictPreflight', () => ({
  useGroupConflictPreflight: (input: unknown, options: unknown) => {
    mocks.preflightInput = input;
    mocks.preflightOptions = options;
    return mocks.preflight;
  },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => `t:${key}` }),
  translate: (key: string) => `translate:${key}`,
}));

import { useGroupEditFormController } from '../useGroupEditFormController';

function form(overrides: Record<string, any> = {}) {
  return {
    name: 'Group',
    connected_group_id: null,
    connectedRelationshipDirections: { manage: 'none' },
    sibling_membership_mode: null,
    sibling_role_id: null,
    parliament_source_group_ids: [],
    siblingMembershipDirection: null,
    ...overrides,
  };
}

const baseProps = {
  groupId: 'current',
  initialData: { name: 'Group' },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.formData = form();
  mocks.allGroups = [];
  mocks.roles = null;
  mocks.connections = [];
  mocks.preflight = { blocking: false, isLoading: false };
  mocks.preflightInput = null;
  mocks.preflightOptions = null;
});

describe('useGroupEditFormController', () => {
  it('normalizes groups, roles, options, and a disconnected base form', () => {
    mocks.allGroups = [null, { id: '' }, { id: 'current' }, { id: 'partner' }];
    mocks.roles = [
      { id: 'member', scope: 'group', assignee_kind: 'member' },
      { id: 'guest', scope: 'group', assignee_kind: 'guest' },
      { id: 'event', scope: 'event', assignee_kind: 'member' },
    ];
    const { result } = renderHook(() => useGroupEditFormController(baseProps));
    expect(result.current.isCreating).toBe(false);
    expect(result.current.availableGroups.map(group => group.id)).toEqual(['current', 'partner']);
    expect(result.current.selectableConnectedGroups.map(group => group.id)).toEqual(['partner']);
    expect(result.current.selectableConnectedRoles.map(role => role.id)).toEqual(['member']);
    expect(result.current.relationshipDirectionOptions).toHaveLength(4);
    expect(result.current.membershipDirectionOptions).toHaveLength(2);
    expect(result.current.existingSiblingLink).toBeNull();
    expect(result.current.siblingGrants).toEqual([]);
    expect(result.current.siblingMembershipRule).toEqual({
      membership_mode: 'none',
      required_source_role_id: null,
      eligible_origin_group_ids: [],
    });
    expect(result.current.pair).toBeNull();
    expect(result.current.hasSiblingMembership).toBe(false);
    expect(result.current.showSiblingRelationshipEditor).toBe(false);
    expect(mocks.preflightInput).toBeNull();
    expect(mocks.preflightOptions).toEqual({ enabled: false });
  });

  it('finds either peer orientation and reuses matching grants', () => {
    mocks.formData = form({
      connected_group_id: 'partner',
      connectedRelationshipDirections: { manage: 'mutual' },
    });
    mocks.connections = [
      {
        id: 'hierarchy',
        connection_type: 'hierarchy',
        group_a_id: 'current',
        group_b_id: 'partner',
      },
      { id: 'unrelated', connection_type: 'peer', group_a_id: 'x', group_b_id: 'y' },
      {
        id: 'peer',
        connection_type: 'peer',
        group_a_id: 'current',
        group_b_id: 'partner',
        grants: [
          {
            id: 'existing-grant',
            right_key: 'manage',
            holder_group_id: 'partner',
            scope_group_id: 'current',
          },
        ],
      },
    ];
    const forward = renderHook(() =>
      useGroupEditFormController({ ...baseProps, groupType: 'sibling' })
    );
    expect(forward.result.current.existingSiblingLink?.id).toBe('peer');
    expect(forward.result.current.siblingGrants).toHaveLength(2);
    expect(forward.result.current.siblingGrants[0].id).toBe('existing-grant');
    expect(forward.result.current.siblingGrants[1].id).toBeUndefined();
    expect(mocks.preflightInput).toMatchObject({
      kind: 'group_connection_upsert',
      connection_id: 'peer',
      membership_rule: null,
    });
    expect(mocks.preflightOptions).toEqual({ enabled: true });

    mocks.connections = [
      { id: 'reverse', connection_type: 'peer', group_a_id: 'partner', group_b_id: 'current' },
    ];
    const reverse = renderHook(() =>
      useGroupEditFormController({ ...baseProps, hasSiblingConnections: true })
    );
    expect(reverse.result.current.existingSiblingLink?.id).toBe('reverse');

    mocks.connections = [
      { id: 'no-grants', connection_type: 'peer', group_a_id: 'current', group_b_id: 'partner' },
    ];
    const noGrants = renderHook(() =>
      useGroupEditFormController({ ...baseProps, hasSiblingConnections: true })
    );
    expect(noGrants.result.current.siblingGrants.every(grant => grant.id === undefined)).toBe(true);

    mocks.formData = form({
      connected_group_id: null,
      connectedRelationshipDirections: { manage: 'current_grants_right_to_partner' },
    });
    const transient = renderHook(() => useGroupEditFormController(baseProps));
    expect(transient.result.current.siblingGrants[0].holder_group_id).toBe('');
  });

  it('builds role and selected-source membership rules in both directions', () => {
    mocks.formData = form({
      connected_group_id: 'partner',
      sibling_membership_mode: 'role_members',
      sibling_role_id: undefined,
      siblingMembershipDirection: 'current_members_to_partner',
    });
    const roleMissing = renderHook(() =>
      useGroupEditFormController({ ...baseProps, groupType: 'sibling' })
    );
    expect(roleMissing.result.current.siblingMembershipRule.required_source_role_id).toBeNull();
    expect(mocks.preflightInput.membership_rule).toMatchObject({
      member_source_group_id: 'current',
      member_target_group_id: 'partner',
      membership_mode: 'role_members',
      required_source_role_id: null,
    });

    mocks.formData = form({
      connected_group_id: 'partner',
      sibling_membership_mode: 'role_members',
      sibling_role_id: 'role',
      siblingMembershipDirection: 'partner_members_to_current',
    });
    const role = renderHook(() =>
      useGroupEditFormController({ ...baseProps, groupType: 'sibling' })
    );
    expect(role.result.current.siblingMembershipRule.required_source_role_id).toBe('role');
    expect(mocks.preflightInput.membership_rule).toMatchObject({
      member_source_group_id: 'partner',
      member_target_group_id: 'current',
    });

    mocks.formData = form({
      connected_group_id: 'partner',
      sibling_membership_mode: 'selected_source_groups',
      parliament_source_group_ids: undefined,
      siblingMembershipDirection: 'partner_members_to_current',
    });
    const selectedEmpty = renderHook(() =>
      useGroupEditFormController({ ...baseProps, groupType: 'sibling' })
    );
    expect(selectedEmpty.result.current.siblingMembershipRule.eligible_origin_group_ids).toEqual(
      []
    );

    mocks.formData = form({
      connected_group_id: 'partner',
      sibling_membership_mode: 'selected_source_groups',
      parliament_source_group_ids: ['source'],
      siblingMembershipDirection: 'partner_members_to_current',
    });
    const selected = renderHook(() =>
      useGroupEditFormController({ ...baseProps, groupType: 'sibling' })
    );
    expect(selected.result.current.siblingMembershipRule.eligible_origin_group_ids).toEqual([
      'source',
    ]);
  });

  it('coerces a hidden relationship tab and propagates explicit tab changes', () => {
    const onTabChange = vi.fn();
    const hidden = renderHook(() =>
      useGroupEditFormController({ ...baseProps, activeTab: 'relationships', onTabChange })
    );
    expect(hidden.result.current.activeTab).toBe('general');
    expect(onTabChange).toHaveBeenCalledWith('general');

    act(() => hidden.result.current.onTabChange('contact'));
    expect(hidden.result.current.activeTab).toBe('contact');
    expect(onTabChange).toHaveBeenCalledWith('contact');

    const visible = renderHook(() =>
      useGroupEditFormController({
        ...baseProps,
        groupType: 'sibling',
        activeTab: 'relationships',
        onTabChange,
      })
    );
    expect(visible.result.current.activeTab).toBe('relationships');

    const noCallback = renderHook(() => useGroupEditFormController(baseProps));
    act(() => noCallback.result.current.onTabChange('themes'));
    expect(noCallback.result.current.activeTab).toBe('themes');
  });

  it('blocks submission during conflict checks', () => {
    for (const preflight of [
      { blocking: true, isLoading: false },
      { blocking: false, isLoading: true },
    ]) {
      mocks.preflight = preflight;
      const { result } = renderHook(() => useGroupEditFormController(baseProps));
      const event = { preventDefault: vi.fn() } as any;
      act(() => result.current.onFormSubmit(event));
      expect(event.preventDefault).toHaveBeenCalled();
    }
    expect(mocks.handleSubmit).not.toHaveBeenCalled();
  });

  it('opens create review only for a nonblank name, then submits confirmation', () => {
    mocks.formData = form({ name: '   ' });
    const blank = renderHook(() => useGroupEditFormController({ groupId: 'current' }));
    const blankEvent = { preventDefault: vi.fn() } as any;
    act(() => blank.result.current.onFormSubmit(blankEvent));
    expect(blankEvent.preventDefault).toHaveBeenCalled();
    expect(blank.result.current.showReview).toBe(false);

    mocks.formData = form({ name: 'New group' });
    const create = renderHook(() => useGroupEditFormController({ groupId: 'current' }));
    const reviewEvent = { preventDefault: vi.fn() } as any;
    act(() => create.result.current.onFormSubmit(reviewEvent));
    expect(create.result.current.showReview).toBe(true);
    const submitEvent = { preventDefault: vi.fn() } as any;
    act(() => create.result.current.onFormSubmit(submitEvent));
    expect(mocks.handleSubmit).toHaveBeenCalledWith(submitEvent);
  });

  it('submits edits directly and requests submission from the form ref when available', () => {
    const { result } = renderHook(() => useGroupEditFormController(baseProps));
    const event = { preventDefault: vi.fn() } as any;
    act(() => result.current.onFormSubmit(event));
    expect(mocks.handleSubmit).toHaveBeenCalledWith(event);

    act(() => result.current.confirmCreate());
    const requestSubmit = vi.fn();
    (result.current.formRef as any).current = { requestSubmit };
    act(() => result.current.confirmCreate());
    expect(requestSubmit).toHaveBeenCalledOnce();
  });
});
