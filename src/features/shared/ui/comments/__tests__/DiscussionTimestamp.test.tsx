/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DiscussionTimestamp } from '../DiscussionTimestamp';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('DiscussionTimestamp', () => {
  it('shows relative time while preserving the complete localized timestamp', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-25T12:00:00.000Z'));

    render(<DiscussionTimestamp value="2026-07-25T11:55:00.000Z" />);

    const timestamp = screen.getByText(/5 min/i);

    expect(timestamp.tagName).toBe('TIME');
    expect(timestamp.getAttribute('dateTime')).toBe('2026-07-25T11:55:00.000Z');
    expect(timestamp.getAttribute('aria-label')).toBeTruthy();
    expect(timestamp.getAttribute('aria-label')).not.toContain('5 min');
  });
});
