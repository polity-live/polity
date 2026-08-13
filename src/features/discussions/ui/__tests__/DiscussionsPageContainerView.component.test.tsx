/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DiscussionsPageContainerView } from '../DiscussionsPageContainerView';

const capture = vi.hoisted(() => ({ props: null as any }));

vi.mock('../DiscussionsView', () => ({
  DiscussionsView: (props: any) => {
    capture.props = props;
    return <div data-testid="discussions-view" />;
  },
}));

afterEach(cleanup);

function props(overrides: Record<string, unknown> = {}) {
  return {
    amendmentId: 'amendment-1',
    userId: 'user-1',
    isCreateDialogOpen: false,
    setIsCreateDialogOpen: vi.fn(),
    sortBy: 'votes',
    setSortBy: vi.fn(),
    authUser: { email: 'person@example.com' },
    amendment: { title: 'Amendment' },
    isLoading: false,
    createThread: vi.fn(),
    createComment: vi.fn(),
    voteOnThread: vi.fn(),
    voteOnComment: vi.fn(),
    ...overrides,
  };
}

describe('DiscussionsPageContainerView', () => {
  it('maps amendment, auth, mutation, and sorting state to the view contract', () => {
    const viewProps = props();
    render(<DiscussionsPageContainerView {...viewProps} />);

    expect(capture.props).toMatchObject({
      amendmentId: 'amendment-1',
      amendmentTitle: 'Amendment',
      authUserEmail: 'person@example.com',
      hasAmendment: true,
      onCreateComment: viewProps.createComment,
      onCreateThread: viewProps.createThread,
      onVoteComment: viewProps.voteOnComment,
      onVoteThread: viewProps.voteOnThread,
    });
  });

  it('normalizes absent amendment and authentication records', () => {
    render(<DiscussionsPageContainerView {...props({ amendment: null, authUser: null })} />);

    expect(capture.props).toMatchObject({
      amendmentTitle: undefined,
      authUserEmail: undefined,
      hasAmendment: false,
    });
  });
});
