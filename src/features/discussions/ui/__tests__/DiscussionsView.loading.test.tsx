/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DiscussionsView } from '../DiscussionsView';

vi.mock('@/layout/page-wrapper', () => ({
  PageWrapper: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));

vi.mock('../CreateThreadDialog', () => ({
  CreateThreadDialog: () => null,
}));

afterEach(() => {
  cleanup();
});

describe('DiscussionsView loading state', () => {
  it('renders a page skeleton instead of loading text', () => {
    render(
      <DiscussionsView
        amendmentId="amendment-1"
        amendmentTitle="Amendment"
        authUserEmail="person@example.com"
        hasMore={false}
        hasAmendment
        isCreateDialogOpen={false}
        isLoading
        loadMoreRef={{ current: null }}
        onCreateComment={vi.fn()}
        onCreateDialogOpenChange={vi.fn()}
        onCreateThread={vi.fn(async () => 'thread-1')}
        onSortByChange={vi.fn()}
        onVoteComment={vi.fn()}
        onVoteThread={vi.fn()}
        sortBy="votes"
        threads={[]}
        userId="user-1"
      />
    );

    expect(document.querySelector('[data-slot="entity-page-skeleton"]')).toBeTruthy();
    expect(screen.queryByText('generated.inline.0386_loading_discussions_8b32b1c7')).toBeNull();
  });
});
