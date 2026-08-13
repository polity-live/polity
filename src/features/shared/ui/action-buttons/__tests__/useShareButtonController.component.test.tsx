/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  toast: { error: vi.fn(), info: vi.fn(), success: vi.fn() },
}));

vi.mock('sonner', () => ({ toast: mocks.toast }));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/features/shared/ui/icons', () => ({
  FacebookIcon: () => null,
  InstagramIcon: () => null,
  LinkedinIcon: () => null,
  TwitterIcon: () => null,
  YoutubeIcon: () => null,
}));

import { useShareButtonController } from '../useShareButtonController';

describe('useShareButtonController', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    vi.spyOn(window, 'open').mockImplementation(() => null);
  });
  afterEach(() => vi.useRealTimers());

  it('copies, resets, and directly or manually shares platforms', async () => {
    const view = renderHook(() => useShareButtonController({ title: 'Title', url: '/item' }));
    expect(view.result.current.directSharePlatforms).toHaveLength(4);
    expect(view.result.current.manualSharePlatforms).toHaveLength(4);
    await act(async () => view.result.current.handleCopyUrl());
    expect(view.result.current.copied).toBe(true);
    expect(mocks.toast.success).toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(2000));
    expect(view.result.current.copied).toBe(false);

    act(() => view.result.current.setIsOpen(true));
    act(() => view.result.current.handleShare(view.result.current.directSharePlatforms[0]));
    expect(window.open).toHaveBeenCalled();
    act(() => view.result.current.setIsOpen(true));
    act(() => view.result.current.handleShare(view.result.current.manualSharePlatforms[0]));
    expect(mocks.toast.info).toHaveBeenCalled();
    expect(view.result.current.isOpen).toBe(false);
  });

  it('reports clipboard failure and preserves explicit presentation props', async () => {
    (navigator.clipboard.writeText as any).mockRejectedValueOnce(new Error('denied'));
    const view = renderHook(() =>
      useShareButtonController({
        className: 'share-class',
        description: 'Description',
        size: 'sm',
        title: 'Title',
        url: '/item',
        variant: 'ghost',
      })
    );
    await act(async () => view.result.current.handleCopyUrl());
    expect(mocks.toast.error).toHaveBeenCalled();
    expect(view.result.current).toMatchObject({
      className: 'share-class',
      size: 'sm',
      variant: 'ghost',
    });
  });

  it('keeps relative share URLs during server rendering', () => {
    const originalWindow = globalThis.window;
    vi.stubGlobal('window', undefined);

    function ServerProbe() {
      const controller = useShareButtonController({ title: 'Title', url: '/item' });
      return <span>{controller.fullUrl}</span>;
    }

    expect(renderToString(<ServerProbe />)).toContain('/item');
    vi.stubGlobal('window', originalWindow);
  });
});
