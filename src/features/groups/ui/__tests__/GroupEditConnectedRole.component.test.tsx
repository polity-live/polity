/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import { createRef, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/shared/ui/form', () => ({
  CreateReviewCard: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  FormControlLabel: ({ children }: { children: ReactNode }) => <label>{children}</label>,
  FormControlSelect: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  FormControlSelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  FormControlSelectItem: ({ children, value: _value, ...props }: any) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  FormControlSelectTrigger: ({ children, ...props }: any) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  FormControlSelectValue: () => null,
  SettingsActionBar: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SettingsTabs: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SummaryField: () => null,
}));
vi.mock('@/features/shared/ui/ui/tabs', () => ({
  TabsContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/features/file-upload/ui/MediaUpload', () => ({ MediaUpload: () => null }));
vi.mock('@/features/create/ui/inputs/VisibilityInput', () => ({ VisibilityInput: () => null }));
vi.mock('@/features/shared/ui/hashtags', () => ({ HashtagEditor: () => null }));
vi.mock('../BasicInfoSection', () => ({ BasicInfoSection: () => null }));
vi.mock('../GroupTypeSection', () => ({ GroupTypeSection: () => null }));
vi.mock('../LocationInfoSection', () => ({ LocationInfoSection: () => null }));
vi.mock('../SocialMediaSection', () => ({ SocialMediaSection: () => null }));
vi.mock('../GroupThemeSettings', () => ({ GroupThemeSettings: () => null }));
vi.mock('../GroupConflictPanel', () => ({
  GroupConflictDialog: () => null,
  GroupConflictPanel: () => null,
}));

import { RIGHT_TYPES } from '@/features/shared/ui/status';
import { GroupEditFormView } from '../GroupEditFormView';

afterEach(cleanup);

describe('GroupEditFormView connected role', () => {
  it('renders each eligible role as a stable role-scoped membership choice', () => {
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
        t={(key: string) => key}
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
          sibling_membership_mode: 'role_members',
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
        selectableConnectedRoles={[{ id: 'role-1', name: 'Treasurer' }]}
        relationshipDirectionOptions={[{ value: 'none', label: 'None' }]}
        membershipDirectionOptions={[]}
        existingSiblingLink={null}
        siblingGrants={[]}
        siblingMembershipRule={{}}
        pair={null}
        hasSiblingMembership={false}
        siblingConfigurationPreflight={{
          blocking: false,
          isLoading: false,
          response: { blocking: false, conflicts: [] },
        }}
        onFormSubmit={vi.fn()}
        confirmCreate={vi.fn()}
      />
    );

    expect(
      container.querySelector('[data-action-id="groups.edit.relationship.connected-role.choose"]')
        ?.textContent
    ).toContain('Treasurer');
  });
});
