/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  user: null as unknown,
  group: null as unknown,
  event: null as unknown,
  amendment: null as unknown,
  blog: null as unknown,
  statement: null as unknown,
  todo: null as unknown,
}));

const urlMocks = vi.hoisted(() => ({
  isPolityLink: vi.fn(),
  parsePolityUrl: vi.fn(),
}));

const branchMocks = vi.hoisted(() => ({
  getOrderedBranches: vi.fn((branches: unknown[]) => branches),
  getBranchEditingMode: vi.fn(() => 'edit'),
}));

vi.mock('@/features/shared/hooks/use-translation.ts', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/features/shared/ui/status', () => ({
  BadgeControl: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  EditingModeBadge: ({ mode }: { mode: string }) => <span>mode:{mode}</span>,
}));

vi.mock('@/zero/users/useUserState.ts', () => ({
  useUserState: () => ({ user: state.user }),
}));
vi.mock('@/zero/groups/useGroupState.ts', () => ({
  useGroupState: () => ({ group: state.group }),
}));
vi.mock('@/zero/events/useEventState.ts', () => ({
  useEventState: () => ({ event: state.event }),
}));
vi.mock('@/zero/amendments/useAmendmentState.ts', () => ({
  useAmendmentState: () => ({ amendment: state.amendment }),
}));
vi.mock('@/zero/blogs/useBlogState.ts', () => ({
  useBlogState: () => ({ blogWithBloggers: state.blog }),
}));
vi.mock('@/zero/statements/useStatementState.ts', () => ({
  useStatementState: () => ({ statement: state.statement }),
}));
vi.mock('@/zero/todos/useTodoState.ts', () => ({
  useTodoState: () => ({ todo: state.todo }),
}));

vi.mock('@/features/amendments/logic/amendmentBranchDisplay', () => branchMocks);

vi.mock('../../utils/url-utils', () => ({
  isPolityLink: (...args: unknown[]) => urlMocks.isPolityLink(...args),
  parsePolityUrl: (...args: unknown[]) => urlMocks.parsePolityUrl(...args),
}));

vi.mock('../../logic/normalizeMessagePreviewText', () => ({
  normalizeMessagePreviewText: (value: unknown) =>
    value === null || value === undefined ? undefined : `normalized:${String(value)}`,
}));

vi.mock('../LinkPreviewView', () => ({
  LinkPreviewSkeleton: () => <div data-testid="skeleton">loading</div>,
  LinkPreviewCardView: ({
    href,
    className,
    title,
    subtitle,
    description,
    avatar,
    meta,
    badgeLabel,
  }: {
    href: string;
    className?: string;
    title: string;
    subtitle?: string;
    description?: string;
    avatar?: { src?: string; fallback: string };
    meta?: React.ReactNode;
    badgeLabel?: string;
  }) => (
    <article data-testid="card" data-href={href} data-class={className}>
      <span>{title}</span>
      <span>{subtitle}</span>
      <span>{description}</span>
      <span>{avatar?.src}</span>
      <span>{avatar?.fallback}</span>
      <span>{badgeLabel}</span>
      {meta}
    </article>
  ),
}));

import {
  AmendmentPreviewContainer,
  BlogPreviewContainer,
  EventPreviewContainer,
  GroupPreviewContainer,
  LinkPreview,
  StatementPreviewContainer,
  TodoPreviewContainer,
  UserPreviewContainer,
} from '../LinkPreview';

afterEach(cleanup);

beforeEach(() => {
  Object.assign(state, {
    user: null,
    group: null,
    event: null,
    amendment: null,
    blog: null,
    statement: null,
    todo: null,
  });
  urlMocks.isPolityLink.mockReset();
  urlMocks.parsePolityUrl.mockReset();
  branchMocks.getOrderedBranches.mockClear();
  branchMocks.getBranchEditingMode.mockClear();
});

describe('LinkPreview A05 branch contracts', () => {
  it('renders external links and dispatches every Polity entity type', () => {
    urlMocks.isPolityLink.mockReturnValueOnce(false);
    render(<LinkPreview url="https://example.com" className="external" />);
    expect(screen.getByTestId('card').getAttribute('data-href')).toBe('https://example.com');
    expect(screen.getByTestId('card').getAttribute('data-class')).toBe('external');
    cleanup();

    const types = ['user', 'group', 'event', 'amendment', 'blog', 'statement', 'todo'] as const;
    for (const type of types) {
      urlMocks.isPolityLink.mockReturnValueOnce(true);
      urlMocks.parsePolityUrl.mockReturnValueOnce({ type, id: `${type}-1` });
      render(<LinkPreview url={`/${type}/${type}-1`} />);
      expect(screen.getByTestId('skeleton')).toBeTruthy();
      cleanup();
    }

    urlMocks.isPolityLink.mockReturnValueOnce(true);
    urlMocks.parsePolityUrl.mockReturnValueOnce({ type: 'unknown', id: 'unknown-1' });
    const { container } = render(<LinkPreview url="/unknown/unknown-1" />);
    expect(container.innerHTML).toBe('');
  });

  it('renders user names, avatar fallbacks, handles and unspecified users', () => {
    state.user = {
      first_name: 'Ada',
      last_name: 'Lovelace',
      handle: 'ada',
      avatar: 'avatar.png',
      bio: 'Bio',
    };
    render(<UserPreviewContainer userId="user-1" className="user-card" />);
    expect(screen.getByTestId('card').textContent).toContain(
      'Ada Lovelace@adanormalized:Bioavatar.pngAcomponents.linkPreview.user'
    );
    cleanup();

    state.user = { first_name: '', last_name: '', handle: 'handle-only', avatar: null, bio: null };
    render(<UserPreviewContainer userId="user-2" />);
    expect(screen.getByTestId('card').textContent).toContain(
      'components.linkPreview.unspecifiedUser@handle-onlyH'
    );
    cleanup();

    state.user = { first_name: null, last_name: null, handle: null, avatar: null, bio: null };
    render(<UserPreviewContainer userId="user-3" />);
    expect(screen.getByTestId('card').textContent).toContain(
      'components.linkPreview.unspecifiedUserU'
    );
  });

  it('renders group and event fallback and populated metadata', () => {
    state.group = { name: '', member_count: null, description: null };
    render(<GroupPreviewContainer groupId="group-1" />);
    expect(screen.getByTestId('card').textContent).toContain('G');
    expect(screen.getByTestId('card').textContent).toContain('0 components.linkPreview.members');
    cleanup();

    state.group = { name: 'Council', member_count: 12, description: 'About' };
    render(<GroupPreviewContainer groupId="group-2" />);
    expect(screen.getByTestId('card').textContent).toContain('Councilnormalized:AboutC');
    expect(screen.getByTestId('card').textContent).toContain('12 components.linkPreview.members');
    cleanup();

    state.event = { title: 'Undated', start_date: null, location_name: null };
    render(<EventPreviewContainer eventId="event-1" />);
    expect(screen.getByTestId('card').textContent).toContain('Undated');
    cleanup();

    state.event = { title: 'Summit', start_date: '2026-01-02T00:00:00Z', location_name: 'Hall' };
    render(<EventPreviewContainer eventId="event-2" />);
    expect(screen.getByTestId('card').textContent).toContain('Summit');
    expect(screen.getByTestId('card').textContent).toContain('Hall');
  });

  it('renders amendment editing mode only when an ordered branch exists', () => {
    state.amendment = { title: 'No branch', reason: null, current_process_run: null };
    render(<AmendmentPreviewContainer amendmentId="amendment-1" />);
    expect(screen.getByTestId('card').textContent).not.toContain('mode:edit');
    cleanup();

    const branch = { id: 'branch-1', editing_mode: 'edit' };
    state.amendment = {
      title: 'With branch',
      reason: 'Reason',
      current_process_run: { branches: [branch] },
    };
    render(<AmendmentPreviewContainer amendmentId="amendment-2" />);
    expect(screen.getByTestId('card').textContent).toContain('mode:edit');
    expect(branchMocks.getBranchEditingMode).toHaveBeenCalledWith(branch);
  });

  it('builds group, owner and missing-owner blog URLs with count fallbacks', () => {
    state.blog = {
      title: 'Group blog',
      group_id: 'group-1',
      bloggers: [],
      supporter_count: 5,
      comment_count: 3,
    };
    render(<BlogPreviewContainer blogId="blog-1" />);
    expect(screen.getByTestId('card').getAttribute('data-href')).toBe('/group/group-1/blog/blog-1');
    expect(screen.getByTestId('card').textContent).toContain('5 components.labels.supporters');
    expect(screen.getByTestId('card').textContent).toContain('3 components.linkPreview.comments');
    cleanup();

    state.blog = {
      title: 'User blog',
      group_id: null,
      bloggers: [{ status: 'owner', user: { id: 'owner-1' } }],
      supporter_count: null,
      comment_count: null,
    };
    render(<BlogPreviewContainer blogId="blog-2" />);
    expect(screen.getByTestId('card').getAttribute('data-href')).toBe('/user/owner-1/blog/blog-2');
    expect(screen.getByTestId('card').textContent).toContain('0 components.labels.supporters');
    cleanup();

    state.blog = { title: 'Orphan blog', group_id: null, bloggers: undefined };
    render(<BlogPreviewContainer blogId="blog-3" />);
    expect(screen.getByTestId('card').getAttribute('data-href')).toBe('/user//blog/blog-3');
  });

  it('renders statement and todo normalized content and status metadata', () => {
    state.statement = { text: null };
    render(<StatementPreviewContainer statementId="statement-1" />);
    expect(screen.getByTestId('card').textContent).toContain('components.linkPreview.statement');
    cleanup();

    state.statement = { text: 'Statement text' };
    render(<StatementPreviewContainer statementId="statement-2" />);
    expect(screen.getByTestId('card').textContent).toContain('normalized:Statement text');
    cleanup();

    state.todo = {
      title: 'Ship tests',
      description: 'Description',
      status: 'in_progress',
      priority: 'high',
    };
    render(<TodoPreviewContainer todoId="todo-1" />);
    expect(screen.getByTestId('card').textContent).toContain('Ship testsnormalized:Description');
    expect(screen.getByTestId('card').textContent).toContain('in progress');
    expect(screen.getByTestId('card').textContent).toContain('high');
  });
});
