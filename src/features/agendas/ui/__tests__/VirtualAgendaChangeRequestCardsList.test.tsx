/* @vitest-environment jsdom */

import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/features/shared/virtualization', () => ({
  PolityZeroListView: ({ renderEmpty }: { renderEmpty: () => ReactNode }) => <>{renderEmpty()}</>,
}));

vi.mock('@/features/shared/ui/ui/skeleton', () => ({
  Skeleton: () => null,
}));

vi.mock('@/zero/queries', () => ({
  queries: {
    agendas: {
      changeRequestById: vi.fn(),
      changeRequestPage: vi.fn(),
    },
  },
}));

vi.mock('../ChangeRequestCardsList', () => ({
  ChangeRequestCardsList: ({ items }: { items: { id: string }[] }) => (
    <div data-testid="vote-items">{items.map(item => item.id).join(',')}</div>
  ),
}));

import { VirtualAgendaChangeRequestCardsList } from '../VirtualAgendaChangeRequestCardsList';

describe('VirtualAgendaChangeRequestCardsList', () => {
  it('renders synthetic vote items while persisted timeline rows are unavailable', () => {
    render(
      <VirtualAgendaChangeRequestCardsList
        agendaItemId="agenda-1"
        items={[{ id: 'synthetic-closing' } as never]}
        editingMode="suggest_event"
        isVotingActive
        virtualize
      />
    );

    expect(screen.getByTestId('vote-items').textContent).toBe('synthetic-closing');
  });
});
