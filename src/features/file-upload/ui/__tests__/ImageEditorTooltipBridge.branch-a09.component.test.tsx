// @vitest-environment jsdom
/* oxlint-disable polity/no-native-title-tooltip -- These tests model native vendor-editor titles. */

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createRef, useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ImageEditorTooltipBridge } from '../ImageEditorTooltipBridge';

vi.mock('@/features/shared/ui/ui/tooltip', () => ({
  Tooltip: ({ children }: any) => <>{children}</>,
  TooltipTrigger: ({ children }: any) => <>{children}</>,
  TooltipContent: ({ children }: any) => <div role="tooltip">{children}</div>,
}));

function Harness() {
  const hostRef = useRef<HTMLDivElement>(null);
  return (
    <>
      <div ref={hostRef} data-testid="host">
        <button type="button" title="Icon action">
          <svg data-testid="icon" />
        </button>
        <button type="button" title="Text action">
          Visible name
        </button>
        <button type="button" aria-label="Named" title="Named action" />
        <button type="button" aria-labelledby="label-id" title="Labelled action" />
        <label>
          Label name
          <input title="Input action" />
        </label>
        <span title="Non interactive" />
        <div role="button" title="Role button" />
      </div>
      <ImageEditorTooltipBridge hostRef={hostRef} />
    </>
  );
}

async function flushMutations() {
  await act(async () => Promise.resolve());
}

describe('ImageEditorTooltipBridge remaining branches', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    document.querySelectorAll('#SfxPopup, #outside').forEach(element => element.remove());
  });

  it('does nothing when the host ref is unavailable', () => {
    const hostRef = createRef<HTMLDivElement>();
    render(<ImageEditorTooltipBridge hostRef={hostRef} />);
    expect(document.documentElement.hasAttribute('data-polity-image-editor-open')).toBe(false);
  });

  it('migrates every accessible-name variant and ignores invalid tooltip targets', async () => {
    const { unmount } = render(<Harness />);
    const host = screen.getByTestId('host');
    const buttons = screen.getAllByRole('button');
    const input = screen.getByRole('textbox');
    const nonInteractive = host.querySelector('span')!;

    expect(buttons[0].getAttribute('aria-label')).toBe('Icon action');
    expect(buttons[1].getAttribute('aria-label')).toBeNull();
    expect(buttons[2].getAttribute('aria-label')).toBe('Named');
    expect(buttons[3].getAttribute('aria-label')).toBeNull();
    expect(input.getAttribute('aria-label')).toBeNull();
    expect(nonInteractive.getAttribute('aria-label')).toBeNull();

    const outside = document.createElement('button');
    outside.id = 'outside';
    outside.title = 'Outside';
    document.body.append(outside);
    outside.title = 'Outside updated';

    const empty = document.createElement('button');
    empty.title = '   ';
    host.append(empty, document.createTextNode('text node'));
    await flushMutations();
    expect(outside.title).toBe('Outside updated');
    expect(empty.title).toBe('   ');

    outside.setAttribute('data-polity-editor-tooltip', 'Outside tooltip');
    fireEvent.pointerOver(outside);
    const blankTooltip = document.createElement('span');
    blankTooltip.setAttribute('data-polity-editor-tooltip', '   ');
    host.append(blankTooltip);
    fireEvent.focusIn(blankTooltip);

    buttons[0].title = 'Icon updated';
    await flushMutations();
    expect(buttons[0].getAttribute('data-polity-editor-tooltip')).toBe('Icon updated');
    expect(buttons[0].getAttribute('aria-label')).toBe('Icon updated');

    fireEvent.pointerOver(document.body);
    fireEvent.pointerOver(buttons[0], { relatedTarget: buttons[0].querySelector('svg') });
    fireEvent.pointerOut(buttons[0], { relatedTarget: buttons[0].querySelector('svg') });
    fireEvent.focusOut(buttons[0], { relatedTarget: buttons[0] });
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(screen.queryByRole('tooltip')).toBeNull();

    fireEvent.pointerOver(buttons[0]);
    fireEvent.pointerOver(buttons[0]);
    fireEvent.pointerOut(buttons[1]);
    await act(async () => vi.advanceTimersByTime(250));
    expect(screen.getByRole('tooltip').textContent).toBe('Icon updated');

    fireEvent.pointerOver(buttons[0]);
    fireEvent.focusOut(buttons[0]);
    expect(screen.queryByRole('tooltip')).toBeNull();

    buttons[0].setAttribute('title', 'Consumer title');
    buttons[0].setAttribute('aria-label', 'Consumer label');
    nonInteractive.remove();
    unmount();
    expect(buttons[0].title).toBe('Consumer title');
    expect(buttons[0].getAttribute('aria-label')).toBe('Consumer label');
  });

  it('handles portals, disconnected pending targets, scrolling and resize positioning', async () => {
    const { unmount } = render(<Harness />);
    const host = screen.getByTestId('host');
    const portal = document.createElement('div');
    portal.id = 'SfxPopup';
    const portalButton = document.createElement('button');
    portalButton.title = 'Portal action';
    portal.append(portalButton);
    document.body.append(portal);
    await flushMutations();
    expect(portalButton.title).toBe('');

    const dynamic = document.createElement('button');
    dynamic.title = 'Dynamic';
    host.append(dynamic);
    await flushMutations();
    fireEvent.pointerOver(dynamic);
    dynamic.remove();
    await act(async () => vi.advanceTimersByTime(250));
    expect(screen.queryByRole('tooltip')).toBeNull();

    const rect = {
      left: 10,
      top: 20,
      width: 30,
      height: 40,
      right: 40,
      bottom: 60,
      x: 10,
      y: 20,
      toJSON: () => ({}),
    } as DOMRect;
    vi.spyOn(portalButton, 'getBoundingClientRect').mockReturnValue(rect);
    fireEvent.focusIn(portalButton);
    await act(async () => vi.advanceTimersByTime(250));
    expect(screen.getByRole('tooltip')).toBeTruthy();
    fireEvent.resize(window);
    fireEvent.scroll(document);
    expect(portalButton.getBoundingClientRect).toHaveBeenCalledTimes(3);

    const second = document.createElement('button');
    second.title = 'Second portal action';
    portal.append(second);
    await flushMutations();
    fireEvent.pointerOver(second);
    act(() => {
      vi.advanceTimersByTime(250);
      window.dispatchEvent(new Event('resize'));
    });

    second.remove();
    fireEvent.resize(window);
    expect(screen.queryByRole('tooltip')).toBeNull();

    portalButton.title = 'Consumer title';
    portalButton.setAttribute('aria-label', 'Consumer label');
    unmount();
    expect(portalButton.title).toBe('Consumer title');
    expect(portalButton.getAttribute('aria-label')).toBe('Consumer label');
  });
});
