/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { UserMeetingSchedulerView } from '../UserMeetingSchedulerView';

afterEach(() => {
  cleanup();
});

describe('UserMeetingSchedulerView loading state', () => {
  it('renders a calendar page skeleton instead of centered loading text', () => {
    const props = { isLoading: true } as any;

    render(<UserMeetingSchedulerView {...props} />);

    expect(document.querySelector('[data-slot="calendar-page-skeleton"]')).toBeTruthy();
    expect(screen.queryByText('generated.inline.1205_loading_meetings_cc9cc88a')).toBeNull();
  });
});
