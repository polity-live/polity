/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  useHorizontalArrowNavigation,
  type UseHorizontalArrowNavigationOptions,
} from '../useHorizontalArrowNavigation';

function GlobalArrowTarget(options: UseHorizontalArrowNavigationOptions) {
  useHorizontalArrowNavigation({ mode: 'global', ...options });

  return (
    <div>
      <button type="button">Button target</button>
      <input aria-label="Name" />
      <div role="slider" tabIndex={0}>
        Slider target
      </div>
      <div data-arrow-keys="local" tabIndex={0}>
        Local arrows
      </div>
    </div>
  );
}

function ScopedArrowTarget(options: UseHorizontalArrowNavigationOptions) {
  const { onKeyDown } = useHorizontalArrowNavigation({ mode: 'scoped', ...options });

  return (
    <div data-testid="surface" tabIndex={0} onKeyDown={onKeyDown}>
      Surface
      <input aria-label="Scoped input" />
    </div>
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('useHorizontalArrowNavigation', () => {
  it('maps left and right arrows to previous and next handlers', () => {
    const onGoPrev = vi.fn();
    const onGoNext = vi.fn();

    render(<GlobalArrowTarget onGoPrev={onGoPrev} onGoNext={onGoNext} />);

    fireEvent.keyDown(document, { key: 'ArrowLeft' });
    expect(onGoPrev).toHaveBeenCalledTimes(1);
    expect(onGoNext).not.toHaveBeenCalled();

    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(onGoNext).toHaveBeenCalledTimes(1);
  });

  it('respects disabled state, direction availability, modifiers, and non-arrow keys', () => {
    const onGoPrev = vi.fn();
    const onGoNext = vi.fn();

    const { rerender } = render(
      <GlobalArrowTarget canGoPrev={false} onGoPrev={onGoPrev} onGoNext={onGoNext} />
    );

    fireEvent.keyDown(document, { key: 'ArrowLeft' });
    fireEvent.keyDown(document, { key: 'ArrowRight', shiftKey: true });
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onGoPrev).not.toHaveBeenCalled();
    expect(onGoNext).not.toHaveBeenCalled();

    rerender(<GlobalArrowTarget disabled onGoPrev={onGoPrev} onGoNext={onGoNext} />);
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(onGoNext).not.toHaveBeenCalled();
  });

  it('does not steal arrows from interactive or explicitly local arrow targets', () => {
    const onGoNext = vi.fn();

    render(<GlobalArrowTarget onGoNext={onGoNext} />);

    fireEvent.keyDown(screen.getByLabelText('Name'), { key: 'ArrowRight' });
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowRight' });
    fireEvent.keyDown(screen.getByText('Local arrows'), { key: 'ArrowRight' });

    expect(onGoNext).not.toHaveBeenCalled();
  });

  it('supports scoped keydown handling', () => {
    const onGoPrev = vi.fn();
    const onGoNext = vi.fn();

    render(<ScopedArrowTarget onGoPrev={onGoPrev} onGoNext={onGoNext} />);
    const surface = screen.getByTestId('surface');

    fireEvent.keyDown(surface, { key: 'ArrowRight' });
    expect(onGoNext).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(screen.getByLabelText('Scoped input'), { key: 'ArrowLeft' });
    expect(onGoPrev).not.toHaveBeenCalled();
  });

  it('returns an inert handler when arrow navigation is off', () => {
    const onGoNext = vi.fn();
    render(<ScopedArrowTarget mode="off" onGoNext={onGoNext} />);

    fireEvent.keyDown(screen.getByTestId('surface'), { key: 'ArrowRight' });
    expect(onGoNext).not.toHaveBeenCalled();
  });
});
