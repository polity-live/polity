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

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) =>
    (
      ({
        'generated.inline.0389_sort_by_9bb640e5': 'Sort by:',
        'generated.inline.0390_top_voted_3ecc2d00': 'Top Voted',
        'generated.inline.0392_new_thread_66826f91': 'New Thread',
      }) as Record<string, string>
    )[key] ?? key,
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/features/shared/virtualization', () => ({
  rowAttributes: () => ({}),
  usePolityZeroWindowList: () => ({
    items: [],
    rowsEmpty: false,
    spaceAfter: 0,
    spaceBefore: 0,
  }),
  ZeroVirtualSpacer: () => null,
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

  it('renders the missing-amendment state once loading settles', () => {
    render(
      <DiscussionsView
        amendmentId="missing"
        hasAmendment={false}
        isCreateDialogOpen={false}
        isLoading={false}
        onCreateComment={vi.fn()}
        onCreateDialogOpenChange={vi.fn()}
        onCreateThread={vi.fn(async () => 'thread-1')}
        onSortByChange={vi.fn()}
        onVoteComment={vi.fn()}
        onVoteThread={vi.fn()}
        sortBy="votes"
      />
    );

    expect(screen.getByText('generated.inline.0066_amendment_not_found_3cea3d4d')).toBeTruthy();
    expect(
      screen.getByText(
        'generated.inline.0067_the_amendment_you_re_looking_for_doesn_t_exis_f871134d'
      )
    ).toBeTruthy();
  });
});

describe('DiscussionsView toolbar', () => {
  it('renders New Thread before the remaining-width sort control in one row', () => {
    render(
      <DiscussionsView
        amendmentId="amendment-1"
        amendmentTitle="Amendment"
        authUserEmail="person@example.com"
        hasAmendment
        isCreateDialogOpen={false}
        isLoading={false}
        onCreateComment={vi.fn()}
        onCreateDialogOpenChange={vi.fn()}
        onCreateThread={vi.fn(async () => 'thread-1')}
        onSortByChange={vi.fn()}
        onVoteComment={vi.fn()}
        onVoteThread={vi.fn()}
        sortBy="votes"
        userId="user-1"
      />
    );

    const newThreadButton = screen.getByRole('button', { name: 'New Thread' });
    const sortControl = screen.getByRole('combobox');
    const controls = newThreadButton.parentElement;
    const toolbar = controls?.parentElement;
    const pageContent = document.querySelector('[data-slot="discussions-page-content"]');

    expect(screen.queryByText('Sort by:')).toBeNull();
    expect(newThreadButton.nextElementSibling).toBe(sortControl);
    expect(controls?.className).toContain('flex-nowrap');
    expect(controls?.className).toContain('w-full');
    expect(controls?.className).toContain('sm:w-auto');
    expect(sortControl.className).toContain('flex-1');
    expect(sortControl.className).toContain('max-w-[180px]');
    expect(toolbar?.className).toContain('justify-end');
    expect(pageContent?.className).toContain('w-full');
    expect(pageContent?.className).not.toContain('max-w-5xl');
    expect(pageContent?.className).not.toContain('md:px-8');
  });

  it('right-aligns the sort control by itself for guests', () => {
    render(
      <DiscussionsView
        amendmentId="amendment-1"
        amendmentTitle="Amendment"
        hasAmendment
        isCreateDialogOpen={false}
        isLoading={false}
        onCreateComment={vi.fn()}
        onCreateDialogOpenChange={vi.fn()}
        onCreateThread={vi.fn(async () => 'thread-1')}
        onSortByChange={vi.fn()}
        onVoteComment={vi.fn()}
        onVoteThread={vi.fn()}
        sortBy="votes"
        userId={undefined}
      />
    );

    const sortControl = screen.getByRole('combobox');

    expect(screen.queryByRole('button', { name: 'New Thread' })).toBeNull();
    expect(sortControl.className).toContain('ml-auto');
  });
});
