/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listProps: null as Record<string, any> | null,
  changeRequestById: vi.fn((args: unknown) => ({ kind: 'single', args })),
  changeRequestPage: vi.fn((args: unknown) => ({ kind: 'page', args })),
}));

vi.mock('@/features/shared/virtualization', () => ({
  PolityZeroListView: (props: Record<string, any>) => {
    mocks.listProps = props;
    return <>{props.renderEmpty()}</>;
  },
}));

vi.mock('@/features/shared/ui/ui/skeleton', () => ({
  Skeleton: () => <div data-testid="skeleton" />,
}));

vi.mock('@/zero/queries', () => ({
  queries: {
    agendas: {
      changeRequestById: mocks.changeRequestById,
      changeRequestPage: mocks.changeRequestPage,
    },
  },
}));

vi.mock('../ChangeRequestCardsList', () => ({
  ChangeRequestCardsList: ({ items }: { items: { id: string }[] }) => (
    <div data-testid="vote-items">{items.map(item => item.id).join(',')}</div>
  ),
}));

import { VirtualAgendaChangeRequestCardsList } from '../VirtualAgendaChangeRequestCardsList';

afterEach(() => {
  cleanup();
  mocks.listProps = null;
  vi.clearAllMocks();
});

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

  it('passes through the non-virtual list', () => {
    render(
      <VirtualAgendaChangeRequestCardsList
        agendaItemId="agenda-1"
        items={[{ id: 'direct' } as never]}
        editingMode="suggest_event"
        isVotingActive={false}
      />
    );

    expect(screen.getByTestId('vote-items').textContent).toBe('direct');
    expect(mocks.listProps).toBeNull();
  });

  it('configures paging and resolves persisted, linked, and fallback rows', () => {
    const items = [
      { id: 'persisted', change_request_id: 'cr-1' },
      { id: 'linked', change_request_id: 'cr-2' },
    ];
    render(
      <VirtualAgendaChangeRequestCardsList
        agendaItemId="agenda-1"
        items={items as never}
        editingMode="suggest_event"
        isVotingActive={false}
        virtualize
      />
    );

    const props = mocks.listProps!;
    expect(props.getRowKey({ id: 'row-1' })).toBe('row-1');
    expect(props.toStartRow({ id: 'row-1', order_index: 4 })).toEqual({
      id: 'row-1',
      order_index: 4,
    });
    expect(props.getPageQuery({ limit: 5, start: null, dir: 'forward', settled: true })).toEqual({
      query: expect.objectContaining({ kind: 'page' }),
      options: { ttl: '5m' },
    });
    expect(props.getPageQuery({ limit: 5, start: null, dir: 'forward', settled: false })).toEqual(
      expect.objectContaining({ options: { ttl: 'none' } })
    );
    expect(props.getSingleQuery({ id: 'persisted', settled: true })).toEqual({
      query: expect.objectContaining({ kind: 'single' }),
      options: { ttl: '5m' },
    });
    expect(props.getSingleQuery({ id: 'persisted', settled: false })).toEqual(
      expect.objectContaining({ options: { ttl: 'none' } })
    );

    const { rerender } = render(<>{props.renderRow({ id: 'persisted' })}</>);
    expect(screen.getAllByTestId('vote-items').at(-1)?.textContent).toBe('persisted');
    rerender(<>{props.renderRow({ id: 'remote', change_request_id: 'cr-2' })}</>);
    expect(screen.getAllByTestId('vote-items').at(-1)?.textContent).toBe('linked');
    rerender(<>{props.renderRow({ id: 'remote', change_request_id: 'cr-3' })}</>);
    expect(screen.getAllByTestId('vote-items').at(-1)?.textContent).toBe('remote');
    rerender(<>{props.renderSkeleton()}</>);
    expect(screen.getByTestId('skeleton')).toBeTruthy();
  });

  it('renders nothing for an empty virtualized source', () => {
    const { container } = render(
      <VirtualAgendaChangeRequestCardsList
        agendaItemId="agenda-empty"
        items={[]}
        editingMode="suggest_event"
        isVotingActive={false}
        virtualize
      />
    );

    expect(container.textContent).toBe('');
  });
});
