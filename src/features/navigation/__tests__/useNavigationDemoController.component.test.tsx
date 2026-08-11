/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ mobile: false }));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/features/shared/hooks/useIsMobileScreen', () => ({
  useIsMobileScreen: () => mocks.mobile,
}));

import { useNavigationDemoController } from '../useNavigationDemoController';

describe('useNavigationDemoController', () => {
  beforeEach(() => {
    mocks.mobile = false;
  });

  it('tracks automatic mobile and desktop screens and calls optional callbacks', () => {
    const onScreenTypeChange = vi.fn();
    const onPriorityChange = vi.fn();
    const view = renderHook(() =>
      useNavigationDemoController({ onPriorityChange, onScreenTypeChange })
    );
    expect(view.result.current.actualScreen).toBe('desktop');
    expect(view.result.current.t('label')).toBe('label');

    mocks.mobile = true;
    view.rerender();
    expect(view.result.current.actualScreen).toBe('mobile');
    act(() => view.result.current.handleScreenTypeChange('desktop'));
    expect(view.result.current.actualScreen).toBe('desktop');
    expect(onScreenTypeChange).toHaveBeenCalledWith('desktop');
    act(() => view.result.current.handlePriorityChange('primary'));
    expect(view.result.current.priority).toBe('primary');
    expect(onPriorityChange).toHaveBeenCalledWith('primary');
  });

  it('supports direct setters and absent callbacks', () => {
    const view = renderHook(() => useNavigationDemoController({}));
    act(() => view.result.current.handleScreenTypeChange('mobile'));
    act(() => view.result.current.handlePriorityChange('secondary'));
    expect(view.result.current.actualScreen).toBe('mobile');
    expect(view.result.current.priority).toBe('secondary');
    act(() => view.result.current.setActualScreen('desktop'));
    act(() => view.result.current.setScreenType('automatic'));
    act(() => view.result.current.setPriority('combined'));
    expect(view.result.current.actualScreen).toBe('desktop');
  });
});
