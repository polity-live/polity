/* @vitest-environment jsdom */

import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchCardStateProvider } from '../../SearchCardStateProvider';
import { SearchResultCard } from '../SearchResultCard';
import type { SearchDocument } from '../../types/search-document.types';

const mocks = vi.hoisted(() => ({
  user: { id: 'viewer' } as { id: string } | null,
  mounted: vi.fn(),
  rendered: vi.fn(),
  unmounted: vi.fn(),
  types: new Map<string, string>(),
  rows: new Map<string, unknown[]>(),
  idle: [] as IdleRequestCallback[],
}));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/zero/queries', () => ({
  queries: {
    common: { viewerSubscriptions: () => 'subscriptions' },
    rbac: {
      viewerMemberships: () => 'memberships',
      viewerGuestAccesses: () => 'guests',
      viewerParticipations: () => 'participants',
    },
    amendments: { viewerCollaborations: () => 'collaborations' },
    events: { viewerDelegations: () => 'delegates' },
  },
}));
vi.mock('@/zero/observed-query', () => ({
  useQuery: (query: string | undefined) => [
    query ? mocks.rows.get(query) : undefined,
    { type: query ? (mocks.types.get(query) ?? 'complete') : 'unknown' },
  ],
}));
vi.mock('@/features/timeline/ui/LazyCardComponents', async () => {
  const { useEffect } = await import('react');
  return {
    DynamicTimelineCard: ({ cardProps }: { cardProps: Record<string, any> }) => {
      useEffect(() => {
        mocks.mounted();
        return () => {
          mocks.unmounted();
        };
      }, []);
      mocks.rendered();
      const subscription = cardProps.projectedSubscriptionState;
      const membership = cardProps.projectedMembershipState;
      return (
        <article>
          <a href={cardProps.href}>{cardProps.group?.name ?? cardProps.user.name}</a>
          <p>{cardProps.group?.description ?? cardProps.user.bio}</p>
          <button disabled={subscription.isLoading}>Subscribe</button>
          {membership && <button disabled={membership.isLoading}>Membership</button>}
        </article>
      );
    },
  };
});

const document = {
  id: 'group:group',
  entity_id: 'group',
  entity_type: 'group',
  title: 'Civic Assembly',
  summary: 'Community work',
  search_text: '',
  created_at: 1,
  card_payload: { type: 'group', stats: { members: 12 } },
  topics: [],
} as unknown as SearchDocument;

function Harness({
  contentTypes = ['group'],
  result = document,
}: {
  contentTypes?: string[];
  result?: SearchDocument;
}) {
  return (
    <SearchCardStateProvider contentTypes={contentTypes}>
      <SearchResultCard document={result} />
    </SearchCardStateProvider>
  );
}
function flushIdle() {
  const callback = mocks.idle.shift();
  expect(callback).toBeDefined();
  act(() => callback?.({ didTimeout: false, timeRemaining: () => 10 }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { id: 'viewer' };
  mocks.idle = [];
  mocks.rows.clear();
  mocks.types.clear();
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal('requestIdleCallback', (callback: IdleRequestCallback) => {
    mocks.idle.push(callback);
    return mocks.idle.length;
  });
  vi.stubGlobal('cancelIdleCallback', vi.fn());
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('search card lifecycle while viewer state loads', () => {
  it('keeps final content and navigation mounted while each action becomes ready independently', () => {
    render(<Harness />);
    const link = screen.getByRole('link', { name: 'Civic Assembly' });
    const content = screen.getByText('Community work');
    const subscription = screen.getByRole('button', { name: 'Subscribe' }) as HTMLButtonElement;
    const membership = screen.getByRole('button', { name: 'Membership' }) as HTMLButtonElement;
    expect(link.getAttribute('href')).toBe('/group/group');
    expect(subscription.disabled).toBe(true);
    expect(membership.disabled).toBe(true);
    link.focus();
    flushIdle();
    expect(subscription.disabled).toBe(false);
    expect(membership.disabled).toBe(true);
    flushIdle();
    flushIdle();
    expect(membership.disabled).toBe(false);
    expect(screen.getByRole('link', { name: 'Civic Assembly' })).toBe(link);
    expect(screen.getByText('Community work')).toBe(content);
    expect(link.ownerDocument.activeElement).toBe(link);
    expect(mocks.mounted).toHaveBeenCalledOnce();
    expect(mocks.unmounted).not.toHaveBeenCalled();
  });

  it('avoids re-rendering user cards for unrelated membership and participation stages', () => {
    render(
      <Harness
        contentTypes={['user', 'group', 'event', 'amendment']}
        result={{
          ...document,
          entity_type: 'user',
          entity_id: 'other-user',
          card_payload: { type: 'user' },
        }}
      />
    );
    flushIdle();
    const afterSubscriptions = mocks.rendered.mock.calls.length;
    for (let i = 0; i < 5; i += 1) flushIdle();
    expect(mocks.rendered).toHaveBeenCalledTimes(afterSubscriptions);
    expect(mocks.mounted).toHaveBeenCalledOnce();
  });

  it('keeps final content navigable and actions disabled when the viewer query stays unknown', () => {
    mocks.types.set('subscriptions', 'unknown');
    render(<Harness />);
    flushIdle();
    expect((screen.getByRole('button', { name: 'Subscribe' }) as HTMLButtonElement).disabled).toBe(
      true
    );
    expect((screen.getByRole('button', { name: 'Membership' }) as HTMLButtonElement).disabled).toBe(
      true
    );
    expect(screen.getByRole('link', { name: 'Civic Assembly' }).getAttribute('href')).toBe(
      '/group/group'
    );
    expect(screen.getByText('Community work')).toBeTruthy();
    expect(mocks.idle).toHaveLength(0);
    expect(mocks.mounted).toHaveBeenCalledOnce();
  });
});
