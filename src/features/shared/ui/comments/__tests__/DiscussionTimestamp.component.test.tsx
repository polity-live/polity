/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useLanguageStore } from '@/features/shared/global-state/language.store';
import { DiscussionTimestamp } from '../DiscussionTimestamp';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-01T12:00:00Z'));
  useLanguageStore.setState({ language: 'en' });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('DiscussionTimestamp', () => {
  it('rejects invalid dates and renders Date objects', () => {
    expect(render(<DiscussionTimestamp value={null} />).container.firstChild).toBeNull();
    cleanup();
    render(<DiscussionTimestamp value={new Date('2026-01-01T11:59:30Z')} className="custom" />);
    expect(screen.getByText(/second|now|ago/i).className).toContain('custom');
  });

  it.each([
    ['2026-01-01T11:55:00Z', /min/],
    ['2026-01-01T10:00:00Z', /hr|hour/],
    ['2025-12-30T12:00:00Z', /day/],
    ['2025-10-01T12:00:00Z', /mo|month/],
    ['2024-01-01T12:00:00Z', /yr|year/],
  ])('formats the relative unit for %s', (value, pattern) => {
    render(<DiscussionTimestamp value={value} />);
    expect(screen.getByText(pattern)).toBeTruthy();
    cleanup();
  });

  it('uses the German locale', () => {
    useLanguageStore.setState({ language: 'de' });
    render(<DiscussionTimestamp value="2025-12-30T12:00:00Z" />);
    expect(screen.getByRole('time').getAttribute('aria-label')).toBeTruthy();
  });
});
