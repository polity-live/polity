/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AgendaCard } from '../AgendaCard';

const mocks = vi.hoisted(() => ({
  typeBadge: vi.fn(),
  statusBadge: vi.fn(),
  entityBadge: vi.fn(),
  modeBadge: vi.fn(),
}));

vi.mock('@/features/shared/hooks/use-translation.ts', () => ({
  useTranslation: () => ({
    t: (key: string, values?: { name?: string; title?: string }) =>
      values?.name ?? values?.title ?? key,
  }),
}));
vi.mock('@/features/shared/ui/navigation/LinkSurface.tsx', () => ({
  LinkSurface: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock('../AgendaBadges', () => ({
  AgendaTypeBadge: (props: unknown) => {
    mocks.typeBadge(props);
    return <span data-testid="type" />;
  },
  AgendaStatusBadge: (props: unknown) => {
    mocks.statusBadge(props);
    return <span data-testid="status" />;
  },
  AgendaEntityBadge: (props: unknown) => {
    mocks.entityBadge(props);
    return <span data-testid="entity" />;
  },
  AgendaElectionModeBadge: (props: unknown) => {
    mocks.modeBadge(props);
    return <span data-testid="mode" />;
  },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function base(overrides: Record<string, unknown> = {}) {
  return {
    id: 'agenda-1',
    title: 'Budget',
    type: 'discussion' as const,
    status: 'pending' as const,
    detailsLink: '/agenda/1',
    ...overrides,
  };
}

describe('AgendaCard branches', () => {
  it('renders the sparse inactive card', () => {
    const { container } = render(<AgendaCard {...base()} />);
    expect(container.textContent).toContain('Budget');
    expect(mocks.statusBadge).toHaveBeenCalledWith({ status: 'pending' });
    expect(container.querySelector('footer')).toBeNull();
  });

  it('renders all metadata, active status, move action, and generated creator footer', () => {
    const move = vi.fn();
    const { container } = render(
      <AgendaCard
        {...base({
          description: 'Description',
          subtitle: 'Subtitle',
          creatorName: 'Ada',
          creatorAvatar: '/ada.png',
          className: 'custom-card',
          isActive: true,
          dragHandle: <span>drag</span>,
          actionButton: <button>action</button>,
          showMoveButton: true,
          onMoveClick: move,
          footerRight: <span>right</span>,
          amendment: { id: 'amendment-1', title: 'Motion' },
          election: {
            election_mode: 'list',
            seat_count: 2,
            role: { title: 'Chair', group: { id: 'group-1', name: 'Board' } },
          },
        })}
      />
    );
    fireEvent.click(container.querySelector('[data-action-id="agendas.card.move-event.open"]')!);
    expect(move).toHaveBeenCalled();
    expect(mocks.statusBadge).toHaveBeenCalledWith({ status: 'active' });
    expect(mocks.entityBadge).toHaveBeenCalledTimes(2);
    expect(mocks.modeBadge).toHaveBeenCalledWith(
      expect.objectContaining({ electionMode: 'list', seatCount: 2 })
    );
    expect(container.textContent).toContain('Ada');
  });

  it('uses role group and translation fallbacks while omitting empty amendment and mode', () => {
    const { rerender } = render(
      <AgendaCard
        {...base({
          amendment: { id: 'amendment-1', title: null },
          election: {
            election_mode: null,
            role: { title: null, group: { id: 'group-1', name: 'Board' } },
          },
        })}
      />
    );
    expect(mocks.entityBadge).toHaveBeenCalledWith(expect.objectContaining({ label: 'Board' }));
    expect(mocks.modeBadge).not.toHaveBeenCalled();

    rerender(
      <AgendaCard
        {...base({
          election: {
            role: { title: null, group: { id: 'group-1', name: null } },
          },
        })}
      />
    );
    expect(mocks.entityBadge).toHaveBeenLastCalledWith(
      expect.objectContaining({ label: 'features.events.agenda.role' })
    );
  });

  it('honors explicit footer and move-button gating combinations', () => {
    const { container, rerender } = render(
      <AgendaCard {...base({ footer: <span>custom footer</span>, showMoveButton: true })} />
    );
    expect(container.textContent).toContain('custom footer');
    expect(container.querySelector('[data-action-id="agendas.card.move-event.open"]')).toBeNull();

    rerender(<AgendaCard {...base({ footerRight: <span>right only</span> })} />);
    expect(container.textContent).toContain('right only');

    rerender(<AgendaCard {...base({ creatorName: 'Bob' })} />);
    expect(container.textContent).toContain('Bob');
  });
});
