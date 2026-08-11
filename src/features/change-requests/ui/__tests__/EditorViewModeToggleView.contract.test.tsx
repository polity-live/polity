/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { EditorViewModeToggleView } from '../EditorViewModeToggleView';

beforeAll(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

afterEach(cleanup);

describe('EditorViewModeToggleView', () => {
  it('toggles the view and selects a suggestion through stable focusable actions', () => {
    const onModeToggle = vi.fn();
    const onSelectCR = vi.fn();
    const { container } = render(
      <EditorViewModeToggleView
        mode="single"
        selectedCRId="cr-1"
        changeRequests={[
          { id: 'cr-1', crId: 'CR-1', title: 'First', type: 'insert' },
          { id: 'cr-2', crId: 'CR-2', title: 'Second', type: 'replace' },
        ]}
        open
        selectedCR={{ id: 'cr-1', crId: 'CR-1', title: 'First', type: 'insert' }}
        onModeToggle={onModeToggle}
        onOpenChange={vi.fn()}
        onSelectCR={onSelectCR}
      />
    );
    const toggle = container.querySelector<HTMLElement>(
      '[data-action-id="change-requests.view-mode.toggle"]'
    )!;
    toggle.focus();
    fireEvent.keyDown(toggle, { key: 'Enter' });
    fireEvent.click(toggle);
    expect(onModeToggle).toHaveBeenCalledOnce();
    const selector = container.querySelector<HTMLElement>(
      '[data-action-id="change-requests.suggestion-selector.open"]'
    );
    expect(selector).toBeTruthy();
    const items = document.querySelectorAll<HTMLElement>(
      '[data-action-id="change-requests.suggestion-selector.select"]'
    );
    expect(items).toHaveLength(2);
    items[1].focus();
    fireEvent.keyDown(items[1], { key: 'Enter' });
    fireEvent.click(items[1]);
    expect(onSelectCR).toHaveBeenCalledWith('cr-2');
  });

  it('renders the all-suggestions mode without a selector', () => {
    const onModeToggle = vi.fn();
    const { container } = render(
      <EditorViewModeToggleView
        mode="all"
        selectedCRId={null}
        changeRequests={[]}
        open={false}
        onModeToggle={onModeToggle}
        onOpenChange={vi.fn()}
        onSelectCR={vi.fn()}
      />
    );

    expect(
      container.querySelector('[data-action-id="change-requests.suggestion-selector.open"]')
    ).toBeNull();
    fireEvent.click(
      container.querySelector('[data-action-id="change-requests.view-mode.toggle"]')!
    );
    expect(onModeToggle).toHaveBeenCalledOnce();
  });

  it('renders the empty single-selection state', () => {
    const { container } = render(
      <EditorViewModeToggleView
        mode="single"
        selectedCRId={null}
        changeRequests={[]}
        open
        onModeToggle={vi.fn()}
        onOpenChange={vi.fn()}
        onSelectCR={vi.fn()}
      />
    );

    expect(
      container.querySelector('[data-action-id="change-requests.suggestion-selector.open"]')
    ).toBeTruthy();
    expect(screen.getByText(/select/i)).toBeTruthy();
  });
});
