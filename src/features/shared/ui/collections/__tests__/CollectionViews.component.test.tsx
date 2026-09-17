import { TimelineItem } from '@/features/agendas/ui/TimelineItem';
import { useCalendarCollectionView } from '../useCalendarCollectionView';
import type { CalendarViewMode } from '@/features/events/hooks/useCalendarView';
/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  loading: false,
  display: {} as Record<string, unknown>,
  save: vi.fn().mockResolvedValue(undefined),
  error: vi.fn(),
  userId: 'collection-test',
}));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: { id: mocks.userId } }) }));
vi.mock('@/zero/preferences/useWorkspacePreferences', () => ({
  useWorkspacePreferences: () => ({
    display: mocks.display,
    isLoading: mocks.loading,
    setDisplay: mocks.save,
  }),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  translate: (key: string) => key,
}));
vi.mock('@/features/shared/ui/ui/sonner', () => ({ toast: { error: mocks.error } }));
vi.mock('@/features/shared/ui/navigation/SmartLink', () => ({
  SmartLink: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/features/shared/ui/preview/WorkspacePreview', () => ({
  PreviewButton: ({ href }: { href: string }) => <button aria-label="Preview" data-href={href} />,
}));

import {
  TimelineCardBase,
  TimelineCardHeader,
  TimelineCardActions,
} from '@/features/timeline/ui/cards/TimelineCardBase';
import { AgendaCard } from '@/features/agendas/ui/AgendaCard';
import { CollectionToolbar } from '../CollectionToolbar';
import { CollectionPreferencesProvider } from '../CollectionPreferencesProvider';
import { CollectionScope, CollectionControls, useCollectionPresentation } from '../CollectionScope';
import { EntityListRow } from '../EntityListRow';
import { CollectionCard, CollectionActionsMenu } from '../CollectionCard';
import { useCollectionView } from '../useCollectionView';

afterEach(cleanup);
beforeEach(() => {
  mocks.userId = crypto.randomUUID();
  mocks.loading = false;
  mocks.display = {};
  mocks.save.mockReset().mockResolvedValue(undefined);
  mocks.error.mockClear();
});

function ListHarness() {
  const { view, setView } = useCollectionView('profile.all');
  const [query, setQuery] = useState('');
  return (
    <>
      <CollectionToolbar
        view={view}
        onViewChange={setView}
        search={
          <input
            aria-label="Search"
            value={query}
            onChange={event => setQuery(event.target.value)}
          />
        }
      />
      <output>{view}</output>
    </>
  );
}

describe('collection views', () => {
  it('switches with keyboard focus without losing the search and queues only the latest choice while preferences load', async () => {
    mocks.loading = true;
    const { rerender } = render(
      <CollectionPreferencesProvider>
        <ListHarness />
      </CollectionPreferencesProvider>
    );
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Budget' } });
    const compact = screen.getByRole('button', { name: 'common.workspace.compactView' });
    compact.focus();
    fireEvent.click(compact);
    expect(document.activeElement).toBe(compact);
    expect(compact.getAttribute('aria-pressed')).toBe('true');
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('Budget');
    expect(mocks.save).not.toHaveBeenCalled();
    mocks.display = { collectionViews: { 'profile.all': 'cards' } };
    mocks.loading = false;
    rerender(
      <CollectionPreferencesProvider>
        <ListHarness />
      </CollectionPreferencesProvider>
    );
    await waitFor(() =>
      expect(mocks.save).toHaveBeenCalledWith({ collectionViews: { 'profile.all': 'compact' } })
    );
    expect(screen.getByRole('status').textContent).toBe('compact');
  });

  it('restores stored choices per area and keeps the working view after a failed save', async () => {
    mocks.display = { collectionViews: { 'profile.all': 'compact', 'profile.groups': 'cards' } };
    mocks.save.mockRejectedValueOnce(new Error('offline'));
    render(
      <CollectionPreferencesProvider>
        <ListHarness />
      </CollectionPreferencesProvider>
    );
    expect(screen.getByRole('status').textContent).toBe('compact');
    fireEvent.click(screen.getByRole('button', { name: 'common.workspace.cardsView' }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith('common.workspace.saveFailed'));
    expect(screen.getByRole('status').textContent).toBe('cards');
  });

  it('shares one area choice between status sections without changing other areas', () => {
    function Current() {
      return <output>{useCollectionPresentation()?.view}</output>;
    }
    render(
      <CollectionPreferencesProvider>
        <CollectionScope area="group.amendments">
          <CollectionControls>
            <input aria-label="Search" />
          </CollectionControls>
          <Current />
        </CollectionScope>
        <CollectionScope area="group.amendments">
          <Current />
        </CollectionScope>
        <CollectionScope area="group.related">
          <Current />
        </CollectionScope>
      </CollectionPreferencesProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: 'common.workspace.compactView' }));
    expect(screen.getAllByRole('status').map(node => node.textContent)).toEqual([
      'compact',
      'compact',
      'cards',
    ]);
  });

  it('keeps direct links, entity colors, callback actions and the existing action menu accessible', async () => {
    const open = vi.fn();
    const action = vi.fn();
    const { rerender, container } = render(
      <EntityListRow type="amendment" title="Budget" href="/amendment/one" summary="Summary" />
    );
    expect(screen.getByRole('link').getAttribute('href')).toBe('/amendment/one');
    expect(container.querySelector('[data-search-type-dot="amendment"]')).toBeTruthy();
    rerender(
      <EntityListRow
        type="vote"
        title="Vote"
        onOpen={open}
        actions={
          <CollectionActionsMenu>
            <button onClick={action}>Existing action</button>
          </CollectionActionsMenu>
        }
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Vote' }));
    expect(open).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'common.actions.more' }));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Existing action' })));
    expect(action).toHaveBeenCalledOnce();
  });
});

it('adapts existing cards while retaining the permission-aware primary action, status and secondary menu', async () => {
  const primary = vi.fn();
  const secondary = vi.fn();
  render(
    <CollectionCard compact model={{ type: 'amendment', title: 'Budget', href: '/amendment/one' }}>
      <TimelineCardBase contentType="amendment">
        <TimelineCardHeader contentType="amendment" title="Budget">
          <span>Open for collaboration</span>
        </TimelineCardHeader>
        <TimelineCardActions>
          <button onClick={primary}>Collaborate</button>
          <button onClick={secondary}>Share</button>
        </TimelineCardActions>
      </TimelineCardBase>
    </CollectionCard>
  );
  expect(screen.getByText('Open for collaboration')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Preview' }).getAttribute('data-href')).toBe(
    '/amendment/one'
  );
  fireEvent.click(screen.getByRole('button', { name: 'Collaborate' }));
  expect(primary).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: 'common.actions.more' }));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Share' })));
  expect(secondary).toHaveBeenCalledOnce();
});

it('keeps agenda detail destinations and authorized move and voting actions in compact rows', async () => {
  const move = vi.fn();
  const vote = vi.fn();
  render(
    <CollectionPreferencesProvider>
      <CollectionScope area="agenda">
        <CollectionControls>
          <input aria-label="Search" />
        </CollectionControls>
        <AgendaCard
          id="one"
          title="Election"
          type="election"
          status="pending"
          detailsLink="/event/one/agenda/two"
          showMoveButton
          onMoveClick={move}
          actionButton={<button onClick={vote}>Vote</button>}
        />
      </CollectionScope>
    </CollectionPreferencesProvider>
  );
  fireEvent.click(screen.getByRole('button', { name: 'common.workspace.compactView' }));
  expect(screen.getByRole('link').getAttribute('href')).toBe('/event/one/agenda/two');
  fireEvent.click(screen.getByRole('button', { name: 'Vote' }));
  expect(vote).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: 'common.actions.more' }));
  await act(async () =>
    fireEvent.click(screen.getByRole('button', { name: 'features.events.agenda.moveToEvent' }))
  );
  expect(move).toHaveBeenCalledOnce();
});

it('keeps calendar week preferences compatible and restores the compact list choice', async () => {
  mocks.display = { collectionViews: { calendar: 'compact' } };
  function CalendarHarness({ initial }: { initial: CalendarViewMode }) {
    const [mode, setMode] = useState(initial);
    const setView = useCalendarCollectionView('calendar', mode, setMode);
    return (
      <>
        <output>{mode}</output>
        <button onClick={() => setView('list')}>Calendar cards</button>
      </>
    );
  }
  const view = render(
    <CollectionPreferencesProvider>
      <CalendarHarness initial="week" />
    </CollectionPreferencesProvider>
  );
  expect(screen.getByRole('status').textContent).toBe('week');
  view.unmount();
  render(
    <CollectionPreferencesProvider>
      <CalendarHarness initial="list" />
    </CollectionPreferencesProvider>
  );
  await waitFor(() => expect(screen.getByRole('status').textContent).toBe('compact'));
  fireEvent.click(screen.getByRole('button', { name: 'Calendar cards' }));
  await waitFor(() =>
    expect(mocks.save).toHaveBeenCalledWith({ collectionViews: { calendar: 'cards' } })
  );
  expect(screen.getByRole('status').textContent).toBe('list');
});

it('places agenda order and times inside the compact row and restores the card timeline', () => {
  const { container } = render(
    <CollectionPreferencesProvider>
      <CollectionScope area="agenda">
        <CollectionControls>
          <input aria-label="Search" />
        </CollectionControls>
        <TimelineItem order={2} startTime="18:00" endTime="18:30" duration={30}>
          <AgendaCard
            id="two"
            title="TOP-2"
            type="discussion"
            status="pending"
            detailsLink="/event/one/agenda/two"
          />
        </TimelineItem>
      </CollectionScope>
    </CollectionPreferencesProvider>
  );
  expect(container.querySelector('[data-slot="compact-agenda-item"]')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'common.workspace.compactView' }));
  const row = container.querySelector('[data-slot="compact-agenda-item"]')!;
  expect(row.querySelector('[data-workspace-row]')).toBeTruthy();
  expect(row.textContent).toContain('18:00–18:30');
  expect(row.textContent).toContain('30m');
  expect(row.querySelector('[data-slot="compact-agenda-timing"]')?.textContent).toContain('2');
  fireEvent.click(screen.getByRole('button', { name: 'common.workspace.cardsView' }));
  expect(container.querySelector('[data-slot="compact-agenda-item"]')).toBeNull();
  expect(screen.getByText('18:00')).toBeTruthy();
});
