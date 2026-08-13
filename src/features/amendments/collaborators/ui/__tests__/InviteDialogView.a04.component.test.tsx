/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));
vi.mock('@/features/shared/ui/dialog', () => ({
  ScrollableDialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/feedback', () => ({
  SectionSkeleton: () => <div>loading-users</div>,
}));
vi.mock('@/features/shared/ui/action-submission', () => ({
  ActionSubmissionOverlay: () => <div>submission</div>,
}));
vi.mock('@/features/shared/ui/typeahead/TypeaheadSearch', () => ({
  TypeaheadSearch: () => <div>typeahead</div>,
}));
vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));
vi.mock('@/features/shared/ui/ui/dialog', () => ({
  Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: ReactNode }) => <footer>{children}</footer>,
  DialogHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  DialogTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

import { InviteDialogView } from '../InviteDialogView';

const actionSubmission = {
  isActive: false,
  status: 'idle',
  progressSteps: [],
  error: null,
  reset: vi.fn(),
  retry: vi.fn(),
} as any;

describe('InviteDialogView A04 branch accountability', () => {
  afterEach(cleanup);

  it('uses an empty typeahead fallback while loading users', () => {
    render(
      <InviteDialogView
        actionSubmission={actionSubmission}
        inviteDialogOpen
        isInviting={false}
        isLoading
        selectedUsers={[]}
        typeaheadItems={undefined as any}
        onInviteDialogOpenChange={vi.fn()}
        onInviteUsersClick={vi.fn()}
        onSelectedUsersChange={vi.fn()}
      />
    );

    expect(screen.getByText('loading-users')).toBeTruthy();
  });

  it('renders the search control after loading', () => {
    render(
      <InviteDialogView
        actionSubmission={actionSubmission}
        inviteDialogOpen
        isInviting={false}
        isLoading={false}
        selectedUsers={[]}
        typeaheadItems={[]}
        onInviteDialogOpenChange={vi.fn()}
        onInviteUsersClick={vi.fn()}
        onSelectedUsersChange={vi.fn()}
      />
    );

    expect(screen.getByText('typeahead')).toBeTruthy();
  });
});
