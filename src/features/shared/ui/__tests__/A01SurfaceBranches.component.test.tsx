/* @vitest-environment jsdom */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ semanticBadge: vi.fn() }));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/features/shared/ui/status/StatusBadges', () => ({
  SemanticBadge: (props: Record<string, unknown>) => {
    mocks.semanticBadge(props);
    return <div data-testid="semantic-badge" />;
  },
}));
vi.mock('@/features/shared/virtualization/usePolityLocalVirtualizer', () => ({
  usePolityLocalVirtualizer: (options: { getItemKey: (index: number) => unknown }) => {
    options.getItemKey(99);
    return {
      getTotalSize: () => 0,
      getVirtualItems: () => [
        { index: 99, key: 'missing', start: 0 },
        { index: 0, key: 'present', start: 10 },
      ],
      measureElement: vi.fn(),
    };
  },
}));

import { Section } from '@/features/shared/ui/layout/PageShell';
import { SupporterStatusBadge } from '@/features/shared/ui/status/DomainBadges';
import { EntitySearchBar } from '@/features/shared/ui/typeahead/EntitySearchBar';
import { TypeaheadResultCard } from '@/features/shared/ui/typeahead/TypeaheadResultCard';
import {
  buildWikiRosterSummary,
  getDistinctSignedUpRosterCount,
} from '@/features/shared/ui/wiki/WikiRosterSummaryCard';
import { PolityLocalListView } from '@/features/shared/virtualization/PolityLocalListView';

describe('A01 shared surface branches', () => {
  it('omits the supporter icon and maps the default size', () => {
    render(<SupporterStatusBadge status="active" showIcon={false} />);
    expect(mocks.semanticBadge).toHaveBeenCalledWith(
      expect.objectContaining({ Icon: undefined, size: 'sm' })
    );
  });

  it('normalizes invalid roster totals and ignores blank user ids', () => {
    expect(getDistinctSignedUpRosterCount([{ userId: ' ' }, { userId: null }])).toBe(0);
    expect(buildWikiRosterSummary({ items: [], totalCount: Number.NaN })).toEqual({
      nonSignedUpCount: 0,
      signedUpCount: 0,
      totalCount: 0,
    });
  });

  it('ignores virtual rows that no longer map to an item', () => {
    render(
      <PolityLocalListView
        estimateSize={20}
        getItemKey={item => item}
        items={['first']}
        renderItem={item => <span>{item}</span>}
      />
    );
    expect(screen.getByText('first')).toBeTruthy();
  });

  it('renders sections with and without header content', () => {
    const { rerender } = render(<Section>Body</Section>);
    expect(screen.queryByRole('heading')).toBeNull();
    rerender(<Section title="Title">Body</Section>);
    expect(screen.getByRole('heading').textContent).toBe('Title');
    rerender(
      <Section actions={<button>Action</button>} description="Description">
        Body
      </Section>
    );
    expect(screen.getByRole('button', { name: 'Action' })).toBeTruthy();
  });

  it('renders the active non-gradient entity-search filter', () => {
    render(
      <EntitySearchBar
        filterOptions={[{ active: true, label: 'Active', value: 'active' }]}
        onFilterToggle={vi.fn()}
        onSearchQueryChange={vi.fn()}
        searchQuery=""
      />
    );
    expect(screen.getByText('Active').className).toContain('bg-primary');
  });

  it('renders typeahead labels without a matching highlight', () => {
    render(
      <TypeaheadResultCard
        item={{ entityType: 'user', id: 'user-1', label: 'Alice' }}
        query="unmatched"
      />
    );
    expect(screen.getByText('Alice')).toBeTruthy();
  });

  it('preserves text before a typeahead highlight', () => {
    render(
      <TypeaheadResultCard
        item={{ entityType: 'user', id: 'user-2', label: 'Alice' }}
        query="lice"
      />
    );
    expect(screen.getByText('A')).toBeTruthy();
  });
});
