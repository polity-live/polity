/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

  it('dispatches the stable summary selection action with native focus and keyboard semantics', () => {
    const onClick = vi.fn();
    const { container, rerender } = render(
      <ChangeRequestSummaryItem identifier="CR-4" title="Selectable" selected onClick={onClick} />
    );
    const action = container.querySelector<HTMLElement>(
      '[data-action-id="change-requests.summary.select"]'
    )!;
    action.focus();
    expect(document.activeElement).toBe(action);
    fireEvent.keyDown(action, { key: 'Enter' });
    fireEvent.click(action);
    expect(onClick).toHaveBeenCalledOnce();

    rerender(<ChangeRequestSummaryItem identifier="CR-4" title="Selectable" onClick={onClick} />);
    expect(
      container.querySelector<HTMLElement>('[data-action-id="change-requests.summary.select"]')
        ?.dataset.selected
    ).toBeUndefined();
  });

  it.each([
    ['add', 'bg-[var(--badge-success-border)]'],
    ['remove', 'bg-[var(--badge-danger-border)]'],
    ['delete', 'bg-[var(--badge-danger-border)]'],
    ['update', 'bg-[var(--badge-info-border)]'],
    ['final', 'bg-[var(--badge-accent-border)]'],
    ['custom', 'bg-border'],
  ])('maps %s to its semantic swatch', (changeType, expectedClass) => {
    const { container } = render(
      <ChangeRequestSummaryItem identifier="CR" title="Title" changeType={changeType} />
    );
    expect(container.querySelector('.landing-amendment-request-swatch')?.className).toContain(
      expectedClass
    );
  });

  it.each([
    ['completed', 'custom'],
    ['pending', 'final'],
    ['pending', 'add'],
    ['pending', 'custom'],
  ])('renders the status/type icon contract for %s and %s', (status, changeType) => {
    const { container } = render(
      <ChangeRequestSummaryItem
        identifier="CR"
        title="Title"
        status={status}
        changeType={changeType}
      />
    );
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('renders trigger styling, suppresses preview descriptions, and omits false data attributes', () => {
    const { container, rerender } = render(
      <ChangeRequestSummaryItem
        identifier="CR-5"
        title="Trigger"
        description="Visible trigger description"
        variant="trigger"
        selected
      />
    );
    const trigger = container.firstElementChild as HTMLElement;
    expect(trigger.className).toContain('w-full');
    expect(trigger.className).not.toContain('border-primary/50');
    expect(screen.getByText('Visible trigger description')).toBeTruthy();

    rerender(
      <ChangeRequestSummaryItem
        identifier="CR-6"
        title="Preview"
        description="Hidden preview description"
        variant="preview"
        selected={false}
        className="custom-class"
      />
    );
    const preview = container.firstElementChild as HTMLElement;
    expect(preview.className).toContain('custom-class');
    expect(preview.dataset.selected).toBeUndefined();
    expect(preview.dataset.changeType).toBeUndefined();
    expect(screen.queryByText('Hidden preview description')).toBeNull();
  });
});
