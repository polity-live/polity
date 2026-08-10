/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  emailProps: { accountEmailProps: { email: 'ada@example.org' } },
  passwordProps: { accountPasswordProps: { ready: true } },
  votingProps: { votingPasswordProps: { userId: 'user-1' } },
  shellCalls: [] as { kind: string; props: Record<string, unknown> }[],
}));

vi.mock('@/features/users/hooks/useAccountEmailSectionController', () => ({
  useAccountEmailSectionController: () => mocks.emailProps,
}));
vi.mock('../../hooks/useAccountPasswordSectionController', () => ({
  useAccountPasswordSectionController: () => mocks.passwordProps,
}));
vi.mock('../../hooks/useVotingPasswordTabController', () => ({
  useVotingPasswordTabController: ({ userId }: { userId: string }) => ({
    ...mocks.votingProps,
    requestedUserId: userId,
  }),
}));
vi.mock('../AccountEmailSectionShellView', () => ({
  AccountEmailSectionShellView: (props: Record<string, unknown>) => {
    mocks.shellCalls.push({ kind: 'email', props });
    return <div>email-shell</div>;
  },
}));
vi.mock('../AccountPasswordSectionShellView', () => ({
  AccountPasswordSectionShellView: (props: Record<string, unknown>) => {
    mocks.shellCalls.push({ kind: 'password', props });
    return <div>password-shell</div>;
  },
}));
vi.mock('../VotingPasswordTabShellView', () => ({
  VotingPasswordTabShellView: (props: Record<string, unknown>) => {
    mocks.shellCalls.push({ kind: 'voting', props });
    return <div>voting-shell</div>;
  },
}));

import { AccountEmailSection } from '../AccountEmailSection';
import { AccountPasswordSection } from '../AccountPasswordSection';
import { VotingPasswordTab } from '../VotingPasswordTab';

afterEach(() => {
  cleanup();
  mocks.shellCalls = [];
});

describe('A07 user facade contracts', () => {
  it('forwards every controller result to its shell', () => {
    render(
      <>
        <AccountEmailSection />
        <AccountPasswordSection />
        <VotingPasswordTab userId="user-42" />
      </>
    );

    expect(screen.getByText('email-shell')).toBeTruthy();
    expect(screen.getByText('password-shell')).toBeTruthy();
    expect(screen.getByText('voting-shell')).toBeTruthy();
    expect(mocks.shellCalls).toEqual([
      { kind: 'email', props: mocks.emailProps },
      { kind: 'password', props: mocks.passwordProps },
      {
        kind: 'voting',
        props: { ...mocks.votingProps, requestedUserId: 'user-42' },
      },
    ]);
  });
});
