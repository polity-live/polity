// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  language: 'en' as 'de' | 'en',
  emptyUnknownUser: false,
  format: vi.fn(
    (date: Date, _pattern: string, options: { locale?: { code?: string } }) =>
      `date:${date.getTime()}:${options.locale?.code ?? 'none'}`
  ),
  formatDistanceStrict: vi.fn(
    (start: Date, end: Date, options: { locale?: { code?: string } }) =>
      `duration:${start.getTime()}-${end.getTime()}:${options.locale?.code ?? 'none'}`
  ),
  formatDistanceToNow: vi.fn(
    (date: Date, options: { locale?: { code?: string }; addSuffix?: boolean }) =>
      `since:${date.getTime()}:${options.locale?.code ?? 'none'}:${String(options.addSuffix)}`
  ),
}));

vi.mock('date-fns', () => ({
  format: mocks.format,
  formatDistanceStrict: mocks.formatDistanceStrict,
  formatDistanceToNow: mocks.formatDistanceToNow,
}));

vi.mock('date-fns/locale', () => ({
  de: { code: 'de' },
  enUS: { code: 'en-US' },
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, fallback?: string) => {
    if (key === 'common.unknownUser' && mocks.emptyUnknownUser) return '';
    return fallback ?? key;
  },
}));

vi.mock('@/features/shared/global-state/language.store', () => ({
  useLanguageStore: {
    getState: () => ({ language: mocks.language }),
  },
}));

vi.mock('@/features/shared/ui/dialog', () => ({
  ScrollableDialogContent: ({ children }: { children?: ReactNode }) => (
    <section data-testid="dialog-content">{children}</section>
  ),
}));

vi.mock('@/features/shared/ui/status/StatusBadges', () => ({
  BadgeControl: ({ children, className }: { children?: ReactNode; className?: string }) => (
    <span data-class-name={className}>{children}</span>
  ),
}));

vi.mock('@/features/shared/ui/ui/avatar', () => ({
  Avatar: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  AvatarFallback: ({ children }: { children?: ReactNode }) => (
    <span data-testid="avatar-fallback">{children}</span>
  ),
  AvatarImage: ({ src }: { src?: string }) => <span data-testid="avatar-image">{src}</span>,
}));

vi.mock('@/features/shared/ui/ui/card', () => ({
  Card: ({ children }: { children?: ReactNode }) => <article>{children}</article>,
  CardContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/features/shared/ui/ui/dialog', () => ({
  Dialog: ({
    children,
    onOpenChange,
  }: {
    children?: ReactNode;
    onOpenChange: (open: boolean) => void;
  }) => (
    <div>
      <button type="button" onClick={() => onOpenChange(false)}>
        close-history
      </button>
      {children}
    </div>
  ),
  DialogDescription: ({ children }: { children?: ReactNode }) => <p>{children}</p>,
  DialogHeader: ({ children }: { children?: ReactNode }) => <header>{children}</header>,
  DialogTitle: ({ children }: { children?: ReactNode }) => <h2>{children}</h2>,
}));

import { HolderHistoryDialog } from '../HolderHistoryDialog';

describe('HolderHistoryDialog', () => {
  beforeEach(() => {
    mocks.language = 'en';
    mocks.emptyUnknownUser = false;
    mocks.format.mockClear();
    mocks.formatDistanceStrict.mockClear();
    mocks.formatDistanceToNow.mockClear();
  });

  afterEach(cleanup);

  it('renders translated empty state and forwards dialog close changes', () => {
    const onOpenChange = vi.fn();
    render(<HolderHistoryDialog open onOpenChange={onOpenChange} role={{ id: 'empty' }} />);

    expect(screen.getByText('generated.inline.1058_role_history_c082afdb')).toBeTruthy();
    expect(
      screen.getByText(
        'generated.inline.1064_no_current_or_past_holders_were_found_for_thi_68816dc1'
      )
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'close-history' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('renders current history, membership fallbacks, grouped periods, and every reason', () => {
    mocks.language = 'de';
    const labels = {
      titlePrefix: 'History: ',
      description: 'Description',
      present: 'Current',
      membershipRole: 'Membership',
      pastPeriods: 'Past',
      holders: ' holders',
      since: 'Since',
      empty: 'Nothing',
    };
    render(
      <HolderHistoryDialog
        open
        onOpenChange={vi.fn()}
        labels={labels}
        role={{
          id: 'role',
          title: 'Chair',
          holder_history: [
            {
              id: 'present-elected',
              user: {
                id: 'present',
                first_name: 'Ada',
                last_name: 'Lovelace',
                handle: 'ada',
                avatar: 'ada.png',
              },
              reason: 'elected',
              start_date: 100,
            },
            {
              id: 'present-no-reason',
              user: { id: 'present-no-reason', handle: 'handle-only', avatar: null },
              reason: null,
              start_date: null,
            },
            { id: 'invalid-current', user: { id: null }, start_date: 90 },
            {
              id: 'appointed',
              user: { id: 'appointed', first_name: 'Zed', last_name: 'Person' },
              reason: 'appointed',
              start_date: 10,
              end_date: 200,
            },
            {
              id: 'same-period-without-reason',
              user: { id: 'same-period', handle: 'alpha' },
              reason: null,
              start_date: 10,
              end_date: 200,
            },
            {
              id: 'resigned',
              user: { id: 'resigned', handle: 'resigned' },
              reason: 'resigned',
              start_date: 20,
              end_date: 250,
            },
            {
              id: 'removed',
              user: undefined,
              reason: 'removed',
              start_date: null,
              end_date: 300,
            },
            {
              id: 'term-ended',
              user: { id: 'term', first_name: 'Term' },
              reason: 'term_ended',
              start_date: 50,
              end_date: 400,
            },
            {
              id: 'custom',
              user: { id: 'custom' },
              reason: 'custom_reason',
              start_date: 60,
              end_date: 500,
            },
          ],
          group_membership_roles: [
            {
              id: 'duplicate',
              assigned_at: 80,
              group_membership: { user: { id: 'present', first_name: 'Duplicate' } },
            },
            {
              id: 'assigned',
              assigned_at: 70,
              group_membership: { user: { id: 'member-assigned', first_name: 'Assigned' } },
            },
            {
              id: 'created',
              assigned_at: null,
              group_membership: {
                created_at: 60,
                user: { id: 'member-created', first_name: 'Created' },
              },
            },
            {
              id: 'undated',
              assigned_at: null,
              group_membership: {
                created_at: null,
                user: { id: 'member-undated', first_name: 'Undated' },
              },
            },
            { id: 'missing-membership', group_membership: null },
            { id: 'missing-user-id', group_membership: { user: { id: null } } },
          ],
        }}
      />
    );

    expect(screen.getByRole('heading', { name: /History: Chair/ })).toBeTruthy();
    expect(screen.getAllByText('Current').length).toBeGreaterThan(1);
    expect(screen.getAllByText('Membership')).toHaveLength(3);
    expect(screen.getByText('@ada')).toBeTruthy();
    expect(screen.getByText('@handle-only')).toBeTruthy();
    expect(screen.getByText('@alpha')).toBeTruthy();
    expect(document.body.textContent).toContain('common.holderHistory.notAvailable');
    expect(screen.getByText('common.holderHistory.reasons.elected')).toBeTruthy();
    expect(screen.getByText('common.holderHistory.reasons.appointed')).toBeTruthy();
    expect(screen.getByText('common.holderHistory.reasons.resigned')).toBeTruthy();
    expect(screen.getByText('common.holderHistory.reasons.removed')).toBeTruthy();
    expect(screen.getByText('common.holderHistory.reasons.termEnded')).toBeTruthy();
    expect(screen.getByText('custom_reason')).toBeTruthy();
    expect(screen.getByText('common.holderHistory.durationUnavailable')).toBeTruthy();
    expect(mocks.format).toHaveBeenCalledWith(
      expect.any(Date),
      'MMM d, yyyy',
      expect.objectContaining({ locale: { code: 'de' } })
    );
    expect(mocks.formatDistanceStrict).toHaveBeenCalled();
    expect(mocks.formatDistanceToNow).toHaveBeenCalled();
  });

  it('uses the role name, English locale, past-only state, and initials fallback', () => {
    mocks.language = 'en';
    mocks.emptyUnknownUser = true;
    render(
      <HolderHistoryDialog
        open
        onOpenChange={vi.fn()}
        role={{
          name: 'Treasurer',
          holder_history: [
            {
              id: 'unknown-user',
              user: null,
              reason: null,
              start_date: 25,
              end_date: 50,
            },
          ],
        }}
      />
    );

    expect(screen.getByRole('heading', { name: /Treasurer/ })).toBeTruthy();
    expect(screen.queryByText('generated.inline.1060_present_4e9f7a31')).toBeNull();
    expect(screen.getByText('generated.inline.1063_past_periods_02966b6c')).toBeTruthy();
    expect(screen.getByTestId('avatar-fallback').textContent).toBe('U');
    expect(mocks.format).toHaveBeenCalledWith(
      expect.any(Date),
      'MMM d, yyyy',
      expect.objectContaining({ locale: { code: 'en-US' } })
    );
  });
});
