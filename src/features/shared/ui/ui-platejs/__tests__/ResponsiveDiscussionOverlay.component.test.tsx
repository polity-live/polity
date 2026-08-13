/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResponsiveDiscussionOverlay } from '../block-discussion';

afterEach(() => {
  cleanup();
  document.body.removeAttribute('data-app-tutorial-active');
});

function renderOverlay(isMobileScreen: boolean, showTrigger = true, onOpenChange = vi.fn()) {
  const view = render(
    <ResponsiveDiscussionOverlay
      anchorElement={null}
      blockContent={<p>Amendment text</p>}
      isMobileScreen={isMobileScreen}
      onOpenChange={onOpenChange}
      open
      overlayContent={<p>Change request content</p>}
      trigger={showTrigger ? <button type="button">Open change request</button> : null}
    />
  );
  return { ...view, onOpenChange };
}

describe('ResponsiveDiscussionOverlay', () => {
  it('renders an overlay-free centered non-modal dialog on mobile', () => {
    renderOverlay(true);

    const dialog = screen.getByRole('dialog');
    const block = screen.getByText('Amendment text');
    const trigger = screen.getByRole('button', { name: 'Open change request' });
    const blockContainer = block.parentElement;
    const triggerContainer = trigger.parentElement;
    const layoutContainer = blockContainer?.parentElement;

    expect(dialog.className).toContain('top-[50%]');
    expect(dialog.className).toContain('left-[50%]');
    expect(document.querySelector('[data-slot="dialog-overlay"]')).toBeNull();
    expect(document.querySelector('[data-slot="popover-content"]')).toBeNull();
    expect(layoutContainer?.className).toContain('w-full');
    expect(layoutContainer?.className).toContain('max-w-full');
    expect(layoutContainer?.className).toContain('gap-1');
    expect(blockContainer?.className).toContain('min-w-0');
    expect(blockContainer?.className).toContain('flex-1');
    expect(blockContainer?.className).toContain('break-words');
    expect(triggerContainer?.className).toContain('shrink-0');
    expect(triggerContainer?.className).toContain('w-12');
    expect(triggerContainer?.className).toContain('justify-end');
    expect(triggerContainer?.className).not.toContain('size-0');
    expect(triggerContainer?.getAttribute('style')).toBeNull();
  });

  it('reserves the mobile trigger rail when the block has no icon', () => {
    renderOverlay(true, false);

    const block = screen.getByText('Amendment text');
    const layoutContainer = block.parentElement?.parentElement;
    const triggerRail = layoutContainer?.querySelector('[data-slot="discussion-trigger-rail"]');

    expect(triggerRail?.className).toContain('w-12');
    expect(triggerRail?.className).toContain('shrink-0');
    expect(triggerRail?.childElementCount).toBe(0);
  });

  it('stays open when the user interacts with the global tutorial instruction', () => {
    document.body.setAttribute('data-app-tutorial-active', '');
    render(
      <div data-testid="app-tutorial-spotlight">
        <button type="button">Tutorial instruction</button>
      </div>
    );
    const { onOpenChange } = renderOverlay(true);

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Tutorial instruction' }), {
      pointerId: 1,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Tutorial instruction' }));

    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByText('Change request content')).toBeTruthy();
  });

  it('keeps the anchored popover on desktop', () => {
    renderOverlay(false);

    const block = screen.getByText('Amendment text');
    const trigger = screen.getByRole('button', { name: 'Open change request' });

    expect(document.querySelector('[data-slot="popover-content"]')).toBeTruthy();
    expect(document.querySelector('[data-slot="dialog-content"]')).toBeNull();
    expect(block.parentElement?.parentElement?.className).toContain('w-full');
    expect(trigger.parentElement?.className).toContain('size-0');
  });
});
