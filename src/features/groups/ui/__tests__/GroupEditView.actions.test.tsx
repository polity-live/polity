/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../GroupEditForm', () => ({
  GroupEditForm: (props: any) => (
    <button data-action-id="groups.edit.form.cancel" onClick={props.onCancel}>
      form
    </button>
  ),
}));
vi.mock('@/features/shared/ui/feedback', () => ({
  PageSkeleton: ({ label }: any) => <div>{label}</div>,
}));

import { GroupEditView } from '../GroupEditView';

afterEach(cleanup);

describe('GroupEditView actions', () => {
  it('returns from a missing group through a stable action', () => {
    const navigate = vi.fn();
    const { container } = render(
      <GroupEditView
        groupId="missing"
        navigate={navigate}
        t={(key: string) => key}
        group={null}
        isLoading={false}
        groupConnections={[]}
        user={null}
        connectedRelationshipDirections={{}}
        connectedGroupId={null}
        primarySiblingConnection={null}
        fallbackCanonicalMembershipMode="none"
        getRelativeSiblingMembershipDirection={vi.fn()}
        initialFormData={{}}
      />
    );
    const action = container.querySelector<HTMLElement>(
      '[data-action-id="groups.edit.navigate.home"]'
    )!;
    fireEvent.click(action);
    expect(navigate).toHaveBeenCalledWith({ to: '/home' });
  });

  it('renders loading and populated group states with user fallbacks', () => {
    const common = {
      groupId: 'group',
      navigate: vi.fn(),
      t: (key: string) => key,
      groupConnections: [],
      connectedRelationshipDirections: {},
      connectedGroupId: null,
      primarySiblingConnection: null,
      fallbackCanonicalMembershipMode: 'none',
      getRelativeSiblingMembershipDirection: vi.fn(),
      initialFormData: {},
    };
    const view = render(<GroupEditView {...common} group={null} isLoading user={null} />);
    expect(view.container.textContent).toContain('features.groups.editPage.loading');
    view.rerender(
      <GroupEditView
        {...common}
        group={{
          group_type: 'base',
          visibility: 'public',
          has_hierarchy_children: false,
          has_sibling_connections: false,
        }}
        isLoading={false}
        user={{ id: 'user' }}
      />
    );
    fireEvent.click(
      view.container.querySelector('[data-action-id="groups.edit.form.cancel"]') ??
        view.container.querySelector('button')!
    );
    view.rerender(
      <GroupEditView
        {...common}
        group={{ group_type: 'base', visibility: undefined }}
        isLoading={false}
        user={null}
        canManageGroup={false}
      />
    );
    expect(view.container.textContent).toContain('features.groups.editPage.title');
  });
});
