/* @vitest-environment jsdom */
/* oxlint-disable polity/no-native-title-tooltip -- The bridge test must model native title attributes emitted by the vendor editor. */

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildEditorTheme } from '../ImageEditorTheme';
import { ImageEditorTooltipBridge } from '../ImageEditorTooltipBridge';

function setThemeVariables(values: Record<string, string>) {
  Object.entries(values).forEach(([name, value]) => {
    document.documentElement.style.setProperty(name, value);
  });
}

function TooltipHarness({ dynamicTitle }: { dynamicTitle?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  return (
    <>
      <div ref={hostRef}>
        <button type="button" title="Reset image">
          <svg aria-hidden />
        </button>
        {dynamicTitle ? (
          <button type="button" title={dynamicTitle}>
            <svg aria-hidden />
          </button>
        ) : null}
      </div>
      <ImageEditorTooltipBridge hostRef={hostRef} />
    </>
  );
}

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class ResizeObserverMock {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }
  );
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.documentElement.className = '';
  document.documentElement.removeAttribute('style');
  document.documentElement.removeAttribute('data-polity-image-editor-open');
  document.querySelector('#SfxPopper')?.remove();
});

describe('buildEditorTheme', () => {
  it('maps light-mode action, input and state colors to Polity tokens', () => {
    setThemeVariables({
      '--background': '#f7f5ef',
      '--foreground': '#17201c',
      '--card': '#fffcf6',
      '--primary': '#12362d',
      '--primary-foreground': '#fffcf6',
      '--accent': '#f5ecd8',
      '--accent-foreground': '#6c4a16',
      '--input': '#d8d0c0',
      '--ring': '#b88a3b',
    });

    const palette = buildEditorTheme().palette;

    expect(palette?.['bg-stateless']).toBe('#fffcf6');
    expect(palette?.['txt-primary']).toBe('#17201c');
    expect(palette?.['accent-stateless']).toBe('#12362d');
    expect(palette?.['btn-primary-text']).toBe('#fffcf6');
    expect(palette?.['bg-primary-active']).toBe('#f5ecd8');
    expect(palette?.['border-primary-stateless']).toBe('#d8d0c0');
    expect(palette?.['border-active-bottom']).toBe('#b88a3b');
  });

  it('uses dark-mode tokens without retaining Scaleflex purple defaults', () => {
    document.documentElement.classList.add('dark');
    setThemeVariables({
      '--background': '#07110e',
      '--foreground': '#f4efe4',
      '--card': '#101a16',
      '--primary': '#f4efe4',
      '--primary-foreground': '#07110e',
      '--accent': '#251f13',
      '--accent-foreground': '#f2d39b',
      '--input': '#2b3731',
      '--ring': '#c99b4d',
    });

    const palette = buildEditorTheme().palette;
    const appMappedColors = [
      palette?.['accent-primary'],
      palette?.['accent-stateless'],
      palette?.['btn-primary-text'],
      palette?.['bg-primary-active'],
      palette?.['border-primary-stateless'],
    ];

    expect(appMappedColors).toEqual(['#f4efe4', '#f4efe4', '#07110e', '#251f13', '#2b3731']);
    expect(appMappedColors).not.toContain('rgba(104, 121, 235, 1)');
    expect(appMappedColors).not.toContain('rgba(73, 88, 188, 1)');
  });
});

describe('ImageEditorTooltipBridge', () => {
  it('replaces native titles, preserves an accessible name and opens on hover', async () => {
    vi.useFakeTimers();
    render(<TooltipHarness />);

    const button = screen.getByRole('button', { name: 'Reset image' });
    expect(button.getAttribute('title')).toBeNull();
    expect(button.getAttribute('data-polity-editor-tooltip')).toBe('Reset image');
    expect(document.documentElement.getAttribute('data-polity-image-editor-open')).toBe('true');

    fireEvent.pointerOver(button);
    await act(async () => vi.advanceTimersByTime(250));
    expect(screen.getByRole('tooltip').textContent).toContain('Reset image');

    fireEvent.pointerOut(button);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('handles keyboard focus, Escape and titles added after mount', async () => {
    vi.useFakeTimers();
    const { rerender } = render(<TooltipHarness />);

    rerender(<TooltipHarness dynamicTitle="Lock aspect ratio" />);
    await act(async () => undefined);

    const dynamicButton = screen.getByRole('button', { name: 'Lock aspect ratio' });
    expect(dynamicButton.getAttribute('title')).toBeNull();

    fireEvent.focusIn(dynamicButton);
    await act(async () => vi.advanceTimersByTime(250));
    expect(screen.getByRole('tooltip').textContent).toContain('Lock aspect ratio');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('restores migrated portal titles and temporary attributes on cleanup', () => {
    const portal = document.createElement('div');
    portal.id = 'SfxPopper';
    const portalButton = document.createElement('button');
    portalButton.title = 'Portal action';
    portal.append(portalButton);
    document.body.append(portal);

    const { unmount } = render(<TooltipHarness />);
    expect(portalButton.getAttribute('title')).toBeNull();
    expect(portalButton.getAttribute('aria-label')).toBe('Portal action');

    unmount();
    expect(portalButton.getAttribute('title')).toBe('Portal action');
    expect(portalButton.getAttribute('aria-label')).toBeNull();
    expect(portalButton.getAttribute('data-polity-editor-tooltip')).toBeNull();
    expect(document.documentElement.hasAttribute('data-polity-image-editor-open')).toBe(false);
  });
});
