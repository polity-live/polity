/* @vitest-environment jsdom */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MeetingPage } from '../MeetingPage';

const mocks = vi.hoisted(() => ({ page: { state: 'loading' } as any }));
vi.mock('../hooks/useMeetingDetailPage', () => ({ useMeetingDetailPage: () => mocks.page }));
vi.mock('../ui/MeetingPageView', () => ({
  MeetingPageView: (props: any) => <div>meeting-page:{props.state}</div>,
}));

describe('MeetingPage', () => {
  it('forwards the resolved controller state into the meeting view', () => {
    render(<MeetingPage meetingId="meeting-1" />);
    expect(screen.getByText('meeting-page:loading')).toBeTruthy();
  });
});
