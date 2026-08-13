/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MeetingActions } from '../MeetingActions';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/features/shared/ui/layout', () => ({
  ActionBar: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ResponsiveActionLabel: ({ full }: { full: string }) => <>{full}</>,
  compactActionButtonClassName: 'compact-action-button',
}));

vi.mock('@/features/shared/ui/action-buttons/ShareButton.tsx', () => ({
  ShareButton: ({ 'data-action-id': actionId }: { 'data-action-id'?: string }) => (
    <button type="button" data-action-id={actionId}>
      share
    </button>
  ),
}));

afterEach(cleanup);

function renderMeetingActions(isAuthenticated: boolean) {
  return render(
    <MeetingActions
      meetingId="meeting-1"
      title="Public meeting"
      description=""
      isAuthenticated={isAuthenticated}
      isOwner={false}
      hasBooked={false}
      isAvailable
      isPast={false}
      onBook={vi.fn()}
      onCancelBooking={vi.fn()}
      onNavigateCalendar={vi.fn()}
      onNavigateEdit={vi.fn()}
    />
  );
}

describe('MeetingActions', () => {
  it('shows only share actions to unauthenticated visitors', () => {
    renderMeetingActions(false);

    expect(screen.getByRole('button', { name: 'share' })).toBeTruthy();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'features.meet.page.bookMeeting' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'features.meet.page.viewInCalendar' })).toBeNull();
  });

  it('keeps meeting actions visible to authenticated users', () => {
    renderMeetingActions(true);

    expect(screen.getByRole('button', { name: 'features.meet.page.bookMeeting' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'features.meet.page.viewInCalendar' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'share' })).toBeTruthy();
  });

  it('dispatches every meeting action through a stable focusable identity', () => {
    const onBook = vi.fn();
    const onCancelBooking = vi.fn();
    const onNavigateCalendar = vi.fn();
    const onNavigateEdit = vi.fn();
    const baseProps = {
      meetingId: 'meeting-1',
      title: 'Public meeting',
      description: '',
      isAuthenticated: true,
      isAvailable: true,
      isPast: false,
      onBook,
      onCancelBooking,
      onNavigateCalendar,
      onNavigateEdit,
    };

    const { rerender } = render(
      <MeetingActions {...baseProps} isOwner={false} hasBooked={false} />
    );
    const book = screen.getByRole('button', { name: 'features.meet.page.bookMeeting' });
    const calendar = screen.getByRole('button', {
      name: 'features.meet.page.viewInCalendar',
    });
    const share = screen.getByRole('button', { name: 'share' });

    expect(book.getAttribute('data-action-id')).toBe('meet.actions.booking.create');
    expect(calendar.getAttribute('data-action-id')).toBe('meet.actions.calendar.open');
    expect(share.getAttribute('data-action-id')).toBe('meet.actions.share.open');
    book.focus();
    expect(document.activeElement).toBe(book);
    fireEvent.click(book);
    fireEvent.click(calendar);

    rerender(<MeetingActions {...baseProps} isOwner hasBooked={false} />);
    const edit = screen.getByRole('button', { name: 'common.actions.edit' });
    expect(edit.getAttribute('data-action-id')).toBe('meet.actions.edit.open');
    fireEvent.click(edit);

    rerender(<MeetingActions {...baseProps} isOwner={false} hasBooked />);
    const cancel = screen.getByRole('button', {
      name: 'features.meet.page.cancelBooking',
    });
    expect(cancel.getAttribute('data-action-id')).toBe('meet.actions.booking.cancel');
    fireEvent.click(cancel);

    expect(onBook).toHaveBeenCalledTimes(1);
    expect(onNavigateCalendar).toHaveBeenCalledTimes(1);
    expect(onNavigateEdit).toHaveBeenCalledTimes(1);
    expect(onCancelBooking).toHaveBeenCalledTimes(1);
  });
});
