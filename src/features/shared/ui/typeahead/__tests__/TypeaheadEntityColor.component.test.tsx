/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TypeaheadResultCard } from '../TypeaheadResultCard';
import { TypeaheadSelectedCard } from '../TypeaheadSelectedCard';
import { EntitySearchBar } from '../EntitySearchBar';
import type { TypeaheadItem } from '@/features/shared/logic/typeaheadHelpers';

vi.mock('@/features/shared/ui/navigation/LinkSurface.tsx', () => ({
  LinkSurface: ({
    children,
    containerClassName,
  }: {
    children: React.ReactNode;
    containerClassName?: string;
  }) => (
    <div data-testid="selected-card-surface" className={containerClassName}>
      {children}
    </div>
  ),
}));

afterEach(cleanup);

const groupItem: TypeaheadItem = {
  id: 'group-1',
  entityType: 'group',
  label: 'Budget Circle',
  secondaryLabel: 'Working group',
  metadata: ['12 members'],
  url: '/group/group-1',
};

describe('typeahead entity color', () => {
  it('colors dropdown icon, entity badge, and metadata badge with entity tokens', () => {
    const { container } = render(<TypeaheadResultCard item={groupItem} query="" />);

    expect(
      container.querySelector('[data-slot="typeahead-entity-icon"]')?.getAttribute('class')
    ).toContain('var(--entity-group-base)');
    expect(container.querySelector('[data-slot="typeahead-entity-badge"]')?.className).toContain(
      'var(--entity-group-bg)'
    );
    expect(container.querySelector('[data-slot="typeahead-metadata-badge"]')?.className).toContain(
      'var(--entity-group-bg)'
    );
    expect(screen.getByRole('button').className).toContain('hover:bg-[var(--entity-group-bg)]');
  });

  it('keeps selected typeahead cards plain-token colored and no-spotlight', () => {
    const { container } = render(
      <TypeaheadSelectedCard item={groupItem} variant="stacked" onRemove={() => undefined} />
    );

    const surface = screen.getByTestId('selected-card-surface');

    expect(surface.className).toContain('entity-search-card-no-spotlight');
    expect(surface.className).toContain('bg-[var(--entity-group-bg)]');
    expect(surface.className).not.toContain('bg-gradient');
    expect(
      container.querySelector('[data-slot="typeahead-entity-icon"]')?.getAttribute('class')
    ).toContain('var(--entity-group-base)');
  });

  it('lets active filter token classes own their text color', () => {
    render(
      <EntitySearchBar
        searchQuery=""
        onSearchQueryChange={() => undefined}
        filterOptions={[
          {
            label: 'Info',
            value: 'informationRight',
            active: true,
            gradient:
              'border-[var(--badge-info-border)] bg-[var(--badge-info-bg)] text-[var(--badge-info-fg)]',
          },
        ]}
        onFilterToggle={() => undefined}
      />
    );

    const filter = screen.getByText('Info');

    expect(filter.className).toContain('text-[var(--badge-info-fg)]');
    expect(filter.className).not.toContain('text-white');
  });
});
