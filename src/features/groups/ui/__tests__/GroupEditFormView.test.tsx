/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
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
import { GroupEditFormView } from '../GroupEditFormView';
import { GROUP_EDIT_MEMBERSHIP_MODE_OPTIONS } from '../groupEditMembershipModes';

afterEach(cleanup);

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
});
