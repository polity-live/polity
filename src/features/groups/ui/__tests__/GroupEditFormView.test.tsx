/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/file-upload/ui/MediaUpload', () => ({
  MediaUpload: () => <div data-testid="media-upload" />,
}));

vi.mock('@/features/create/ui/inputs/VisibilityInput', () => ({
  VisibilityInput: () => <div data-testid="visibility-input" />,
}));

vi.mock('@/features/shared/ui/hashtags', () => ({
  HashtagEditor: () => <div data-testid="hashtag-editor" />,
}));

vi.mock('../BasicInfoSection', () => ({
  BasicInfoSection: () => <div data-testid="basic-info-section" />,
}));

vi.mock('../GroupTypeSection', () => ({
  GroupTypeSection: () => <div data-testid="group-type-section" />,
}));

vi.mock('../LocationInfoSection', () => ({
  LocationInfoSection: () => <div data-testid="location-info-section" />,
}));

vi.mock('../SocialMediaSection', () => ({
  SocialMediaSection: () => <div data-testid="social-media-section" />,
}));

vi.mock('../GroupConflictPanel', () => ({
  GroupConflictDialog: () => <button type="button">Conflict details</button>,
  GroupConflictPanel: () => <div data-testid="group-conflict-panel" />,
}));

import { RIGHT_TYPES } from '@/features/shared/ui/status';
import { GroupEditFormView, type GroupEditFormViewProps } from '../GroupEditFormView';
import { GROUP_EDIT_MEMBERSHIP_MODE_OPTIONS } from '../groupEditMembershipModes';

afterEach(cleanup);

function createViewProps(overrides: Partial<GroupEditFormViewProps> = {}): GroupEditFormViewProps {
  return {
    groupId: 'group-1',
    initialData: {},
    onCancel: vi.fn(),
    actorId: 'user-1',
    visibility: 'public',
    groupType: 'sibling',
    hasHierarchyChildren: false,
    hasSiblingConnections: false,
    showSiblingRelationshipEditor: true,
    activeTab: 'relationships',
    onTabChange: vi.fn(),
    t: (key: string) => key,
    isCreating: false,
    showReview: false,
    setShowReview: vi.fn(),
    formRef: createRef<HTMLFormElement>(),
    formData: {
      imageURL: '',
      name: 'Group',
      description: '',
      hashtags: [],
      visibility: 'public',
      connected_group_id: 'group-2',
      siblingMembershipDirection: 'partner_members_to_current',
      sibling_membership_mode: 'all_members',
      sibling_role_id: '',
      connectedRelationshipDirections: Object.fromEntries(
        RIGHT_TYPES.map(right => [right, 'none'])
      ),
    },
    setFormData: vi.fn(),
    updateDescriptionContent: vi.fn(),
    updateField: vi.fn(),
    removeImage: vi.fn(),
    handleSubmit: vi.fn(),
    isSubmitting: false,
    allGroups: [],
    connectedGroupRoles: [],
    groupConnections: [],
    selectableConnectedGroups: [{ id: 'group-2', name: 'Partner' }],
    selectableConnectedRoles: [{ id: 'role-1', name: 'Partner role' }],
    relationshipDirectionOptions: [{ value: 'none', label: 'None' }],
    membershipDirectionOptions: [
      {
        value: 'partner_members_to_current',
        label: 'Receives members',
        description: 'Members flow in.',
      },
    ],
    existingSiblingLink: null,
    siblingGrants: [],
    siblingMembershipRule: {},
    pair: null,
    hasSiblingMembership: false,
    siblingConfigurationPreflight: {
      blocking: false,
      isLoading: false,
      response: { blocking: false, conflicts: [] },
    },
    onFormSubmit: vi.fn(event => event.preventDefault()),
    confirmCreate: vi.fn(),
    ...overrides,
  };
}

describe('GroupEditFormView membership mode options', () => {
  it('offers exactly the three supported sibling membership modes', () => {
    const values = [...GROUP_EDIT_MEMBERSHIP_MODE_OPTIONS] as string[];

    expect(values).toEqual(['none', 'all_members', 'role_members']);
    expect(values).not.toContain('selected_source_groups');
  });
});

describe('GroupEditFormView sibling preflight feedback', () => {
  it('shows a live status while sibling configuration is being checked', () => {
    const { container } = render(
      <GroupEditFormView
        groupId="group-1"
        initialData={{}}
        onCancel={vi.fn()}
        actorId="user-1"
        visibility="public"
        groupType="sibling"
        hasHierarchyChildren={false}
        hasSiblingConnections={false}
        showSiblingRelationshipEditor
        activeTab="relationships"
        onTabChange={vi.fn()}
        t={(key: string) =>
          key === 'common.checks.siblingConfiguration' ? 'Checking sibling configuration...' : key
        }
        isCreating={false}
        showReview={false}
        setShowReview={vi.fn()}
        formRef={createRef<HTMLFormElement>()}
        formData={{
          imageURL: '',
          name: 'Group',
          description: '',
          hashtags: [],
          visibility: 'public',
          connected_group_id: 'group-2',
          siblingMembershipDirection: 'partner_members_to_current',
          sibling_membership_mode: 'all_members',
          sibling_role_id: '',
          connectedRelationshipDirections: Object.fromEntries(
            RIGHT_TYPES.map(right => [right, 'none'])
          ),
        }}
        setFormData={vi.fn()}
        updateDescriptionContent={vi.fn()}
        updateField={vi.fn()}
        removeImage={vi.fn()}
        handleSubmit={vi.fn()}
        isSubmitting={false}
        allGroups={[]}
        connectedGroupRoles={[]}
        groupConnections={[]}
        selectableConnectedGroups={[{ id: 'group-2', name: 'Partner' }]}
        selectableConnectedRoles={[]}
        relationshipDirectionOptions={[{ value: 'none', label: 'None' }]}
        membershipDirectionOptions={[
          {
            value: 'partner_members_to_current',
            label: 'Receives members',
            description: 'Members flow in.',
          },
        ]}
        existingSiblingLink={null}
        siblingGrants={[]}
        siblingMembershipRule={{}}
        pair={null}
        hasSiblingMembership={false}
        siblingConfigurationPreflight={{
          blocking: false,
          isLoading: true,
          response: { blocking: false, conflicts: [] },
        }}
        onFormSubmit={vi.fn()}
        confirmCreate={vi.fn()}
      />
    );

    const liveStatus = container.querySelector('[aria-live="polite"]');

    expect(liveStatus?.textContent).toBe('Checking sibling configuration...');
  });

  it('dispatches review and edit actions through stable identities', () => {
    const setShowReview = vi.fn();
    const confirmCreate = vi.fn();
    const review = render(
      <GroupEditFormView
        {...createViewProps({ isCreating: true, showReview: true, setShowReview, confirmCreate })}
      />
    );

    fireEvent.click(review.container.querySelector('[data-action-id="groups.edit.review.back"]')!);
    fireEvent.click(
      review.container.querySelector('[data-action-id="groups.edit.review.confirm-create"]')!
    );
    expect(setShowReview).toHaveBeenCalledWith(false);
    expect(confirmCreate).toHaveBeenCalledTimes(1);
    review.unmount();

    const onCancel = vi.fn();
    const onFormSubmit = vi.fn(event => event.preventDefault());
    const edit = render(<GroupEditFormView {...createViewProps({ onCancel, onFormSubmit })} />);

    const expectedIds = [
      'groups.edit.relationship.connected-group.open',
      'groups.edit.relationship.membership-direction.open',
      'groups.edit.relationship.membership-mode.open',
      'groups.edit.relationship.right-direction.open',
      'groups.edit.cancel',
      'groups.edit.submit',
    ];
    for (const actionId of expectedIds) {
      expect(edit.container.querySelector(`[data-action-id="${actionId}"]`)).toBeTruthy();
    }

    fireEvent.click(edit.container.querySelector('[data-action-id="groups.edit.cancel"]')!);
    fireEvent.click(edit.container.querySelector('[data-action-id="groups.edit.submit"]')!);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onFormSubmit).toHaveBeenCalledTimes(1);
  });

  it('covers review media/location fallbacks and both creating and saving submit labels', () => {
    const base = createViewProps();
    const richForm = {
      ...base.formData,
      name: '',
      description: 'Description',
      imageURL: 'image.png',
      videoURL: 'video.mp4',
      city: 'Berlin',
      country: 'Germany',
    } as any;
    const view = render(<GroupEditFormView {...base} isCreating showReview formData={richForm} />);
    expect(view.container.textContent).toContain('pages.create.group.untitledGroup');
    view.rerender(
      <GroupEditFormView {...base} isCreating showReview={false} isSubmitting formData={richForm} />
    );
    expect(view.container.textContent).toContain('pages.create.common.creating');
    view.rerender(
      <GroupEditFormView
        {...base}
        isCreating={false}
        showReview={false}
        isSubmitting
        formData={richForm}
      />
    );
    expect(view.container.textContent).toContain('Saving...');
  });

  it('covers unmanaged/hidden relationship tabs, nullish selections, unnamed options, and blocking summaries', () => {
    const base = createViewProps();
    const sparseForm = {
      ...base.formData,
      connected_group_id: null,
      siblingMembershipDirection: null,
      sibling_membership_mode: 'role_members',
      sibling_role_id: null,
    } as any;
    const blocked = {
      blocking: true,
      isLoading: false,
      response: { blocking: true, conflicts: [], summary: null },
    } as any;
    const view = render(
      <GroupEditFormView
        {...base}
        formData={sparseForm}
        selectableConnectedGroups={[{ id: 'group', name: '' }]}
        selectableConnectedRoles={[{ id: 'role', name: '' }]}
        siblingConfigurationPreflight={blocked}
      />
    );
    expect(view.container.textContent).toContain('This configuration is currently blocked.');
    view.rerender(
      <GroupEditFormView
        {...base}
        formData={{ ...base.formData, sibling_membership_mode: null } as any}
      />
    );
    view.rerender(
      <GroupEditFormView
        {...base}
        siblingConfigurationPreflight={{
          ...blocked,
          response: { ...blocked.response, summary: 'Blocked summary' },
        }}
      />
    );
    expect(view.container.textContent).toContain('Blocked summary');
    view.rerender(
      <GroupEditFormView {...base} canManageGroup={false} showSiblingRelationshipEditor />
    );
    view.rerender(
      <GroupEditFormView {...base} canManageGroup showSiblingRelationshipEditor={false} />
    );
    expect(
      view.container.querySelector(
        '[data-action-id="groups.edit.relationship.connected-group.open"]'
      )
    ).toBeNull();
  });
});
