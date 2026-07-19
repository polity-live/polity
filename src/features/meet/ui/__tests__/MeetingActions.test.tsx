/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MeetingActions } from '../MeetingActions';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/features/shared/ui/layout', () => ({
  ActionBar: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/features/shared/ui/action-buttons/ShareButton.tsx', () => ({
  ShareButton: () => <button type="button">share</button>,
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
});
