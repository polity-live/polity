/* @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rows: undefined as any,
  details: {} as Record<string, any>,
  swipe: undefined as any,
  dialogOpenChange: undefined as undefined | ((open: boolean) => void),
  queryArgs: undefined as any,
}));

vi.mock('@rocicorp/zero/react', () => ({ useQuery: () => [mocks.rows] }));
vi.mock('@/zero/queries', () => ({
  queries: {
    statements: {
      carousel: (args: unknown) => {
        mocks.queryArgs = args;
        return {};
      },
    },
  },
}));
vi.mock('@/zero/statements/content', () => ({
  getStatementHeadline: (statement: any) => statement.title || statement.text || 'Headline',
  isStatementExpired: (statement: any) => Boolean(statement.expired),
}));
vi.mock('@/features/statements/hooks/useStatementDetail', () => ({
  useStatementDetail: ({ id }: { id: string }) => mocks.details[id],
}));
vi.mock('@/features/shared/hooks/useSwipeNavigation', () => ({
  useSwipeNavigation: (options: unknown) => {
    mocks.swipe = options;
    return { handlers: { 'data-swipe-ready': 'true' } };
  },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));
vi.mock('@/features/shared/ui/status', () => ({
  BadgeControl: ({ children }: any) => <span>{children}</span>,
}));
vi.mock('@/features/shared/ui/UserIdentityLink', () => ({
  UserIdentityLink: ({ name, secondary }: any) => (
    <div>
      <span>{name}</span>
      {secondary}
    </div>
  ),
}));
vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ children, disabled, ...props }: any) => (
    <button data-disabled={String(Boolean(disabled))} {...props}>
      {children}
    </button>
  ),
}));
vi.mock('@/features/shared/ui/comments', () => ({ CommentThread: () => <div>comments</div> }));
vi.mock('@/features/shared/ui/ui/dialog', () => ({
  Dialog: ({ children, onOpenChange }: any) => {
    mocks.dialogOpenChange = onOpenChange;
    return <div>{children}</div>;
  },
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
}));
vi.mock('@/features/shared/ui/ui/skeleton', () => ({ Skeleton: () => <div>skeleton</div> }));
vi.mock('@/features/shared/ui/voting/VoteButtons', () => ({ VoteButtons: () => <div>votes</div> }));
vi.mock('../StatementMediaDisplay', () => ({ StatementMediaDisplay: () => <div>media</div> }));
vi.mock('../StatementTextRenderer', () => ({
  StatementTextRenderer: ({ text }: any) => <span>{text}</span>,
}));
vi.mock('@/features/shared/utils/utils', () => ({
  cn: (...values: unknown[]) => values.filter(Boolean).join(' '),
}));

import { StatementStoryCarousel } from '../StatementStoryCarousel';

const detail = (statement: any, overrides: Record<string, unknown> = {}) => ({
  statement,
  isLoading: false,
  canAccess: true,
  computedUpvotes: 1,
  computedDownvotes: 2,
  currentVoteValue: 0,
  computedCommentCount: 3,
  comments: [],
  userId: 'viewer',
  handleVote: vi.fn(),
  handleAddComment: vi.fn(),
  handleCommentVote: vi.fn(),
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(1_000);
  mocks.rows = undefined;
  mocks.details = {};
  mocks.swipe = undefined;
  mocks.dialogOpenChange = undefined;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('StatementStoryCarousel exhaustive branch campaign A10', () => {
  it('returns null for absent/empty rows and uses anonymous query defaults', () => {
    const { container, rerender } = render(<StatementStoryCarousel />);
    expect(container.firstChild).toBeNull();
    expect(mocks.queryArgs).toEqual({ user_id: null, now: 1_000, limit: 24 });
    mocks.rows = [];
    rerender(<StatementStoryCarousel />);
    expect(container.firstChild).toBeNull();
  });

  it('renders image, video, text and author fallbacks while scheduling only future expiries', () => {
    mocks.rows = [
      {
        id: 'image',
        title: 'Image story',
        image_url: 'image.jpg',
        is_story: true,
        expires_at: 1_200,
        user: { first_name: null, last_name: null, handle: 'image-handle' },
        group: null,
      },
      {
        id: 'video',
        title: 'Video statement',
        video_url: 'video.mp4',
        is_story: false,
        expires_at: 1_100,
        user: null,
        group: { name: 'Video group' },
      },
      {
        id: 'text',
        text: 'Text statement',
        is_story: false,
        expires_at: 900,
        user: { first_name: '', last_name: 'Last', handle: null },
        expired: false,
      },
      {
        id: 'expired',
        text: 'Expired',
        expires_at: undefined,
        user: { first_name: null, last_name: null, handle: null },
        expired: true,
      },
    ];
    mocks.details.image = detail(null, { isLoading: true });
    mocks.details.video = detail(null, { canAccess: false });
    mocks.details.text = detail(null);
    const { container } = render(
      <StatementStoryCarousel title="Custom stories" userId="author" limit={4} className="custom" />
    );
    expect(screen.getByText('Custom stories')).toBeTruthy();
    expect(mocks.queryArgs).toEqual({ user_id: 'author', now: 1_000, limit: 4 });
    expect(container.querySelector('img[src="image.jpg"]')).toBeTruthy();
    expect(screen.getByText('Video group')).toBeTruthy();
    expect(screen.getByText('Last')).toBeTruthy();
    expect(screen.queryByText('Expired')).toBeNull();

    act(() => vi.advanceTimersByTime(101));
    expect(mocks.queryArgs.now).toBe(1_101);
  });

  it('covers viewer loading, inaccessible and full detail states plus navigation guards', () => {
    const image = {
      id: 'image',
      title: 'Image story',
      image_url: 'image.jpg',
      is_story: true,
      user: { id: 'fallback-id', avatar: 'fallback-avatar', first_name: 'Fallback' },
      group: null,
    };
    const video = {
      id: 'video',
      title: 'Video story',
      video_url: 'video.mp4',
      is_story: false,
      user: null,
      group: { name: null },
    };
    mocks.rows = [image, video];
    mocks.details.image = detail(null, { isLoading: true });
    mocks.details.video = detail(null, { canAccess: false });
    const view = render(<StatementStoryCarousel />);
    fireEvent.click(screen.getByRole('button', { name: /Image story/ }));
    expect(screen.getByRole('status')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Previous statement' }));
    act(() => mocks.swipe.onSwipePrev());
    fireEvent.click(screen.getByRole('button', { name: 'Next statement' }));
    expect(screen.getByText('features.statements.detail.notFound')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next statement' }));
    act(() => mocks.swipe.onSwipeNext());
    fireEvent.click(screen.getByRole('button', { name: 'Previous statement' }));

    mocks.details.image = detail({
      ...image,
      title: null,
      text: 'Detailed body',
      image_url: null,
      video_url: null,
      group: { name: 'Detailed group' },
      user: {
        id: 'detail-id',
        avatar: 'detail-avatar',
        first_name: null,
        last_name: null,
        handle: null,
      },
    });
    view.rerender(<StatementStoryCarousel />);
    expect(screen.getAllByText('Detailed body')).toHaveLength(2);
    expect(screen.getByText('Detailed group')).toBeTruthy();

    act(() => mocks.dialogOpenChange?.(true));
    act(() => mocks.dialogOpenChange?.(false));
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
  });

  it('renders successful non-story details without text and closes by its explicit action', () => {
    const row = {
      id: 'single',
      title: 'Single',
      is_story: false,
      user: { first_name: 'Ada', last_name: 'Lovelace' },
    };
    mocks.rows = [row];
    mocks.details.single = detail({ ...row, text: null, group: null });
    render(<StatementStoryCarousel />);
    expect(screen.getByText('Statements')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Single/ }));
    expect(screen.queryByText('24h')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
  });
});
