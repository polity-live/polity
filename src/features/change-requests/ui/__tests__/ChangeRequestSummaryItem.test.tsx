/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ChangeRequestSummaryItem } from '../ChangeRequestSummaryItem';

afterEach(() => {
  cleanup();
});

describe('ChangeRequestSummaryItem', () => {
  it('renders the reusable change-request summary row', () => {
    const { container } = render(
      <ChangeRequestSummaryItem
        identifier="CR-1"
        title="Add measurable reporting milestones"
        description="Adds a review checkpoint."
        changeType="insert"
        status="pending"
      />
    );

    expect(screen.getByText('CR-1')).toBeTruthy();
    expect(screen.getByText('Add measurable reporting milestones')).toBeTruthy();
    expect(screen.getByText('Adds a review checkpoint.')).toBeTruthy();
    expect(container.querySelector('[data-change-type="insert"]')).toBeTruthy();
  });

  it('marks selected and interactive states without changing the public element shape', () => {
    const { container } = render(
      <ChangeRequestSummaryItem
        identifier="CR-2"
        title="Public hearing scheduled"
        changeType="replace"
        selected
        interactive
      />
    );

    const row = container.querySelector('[data-selected="true"]');
    expect(row).toBeTruthy();
    expect(row?.className).toContain('hover:bg-primary/5');
  });

  it('keeps the landing preview animation hooks available', () => {
    const { container } = render(
      <ChangeRequestSummaryItem
        identifier="CR-3"
        title="Preview item"
        changeType="insert"
        motionDelayMs={1200}
        variant="preview"
      />
    );

    const row = container.querySelector('.landing-amendment-request-chip') as HTMLElement | null;
    expect(row).toBeTruthy();
    expect(row?.style.animationDelay).toBe('1200ms');
  });
});
