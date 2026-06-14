import { useEffect, useRef, useState } from 'react';

export function useNetworkViewportPanelController(minHeight: number) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    let frameId = 0;

    const measure = () => {
      cancelAnimationFrame(frameId);

      frameId = window.requestAnimationFrame(() => {
        const element = containerRef.current;
        if (!element) {
          return;
        }

        const top = Math.max(element.getBoundingClientRect().top, 0);
        const viewportHeight = window.visualViewport?.height ?? window.innerHeight;

        let additionalBottomOffset = 0;
        let currentElement: HTMLElement | null = element.parentElement;
        const mainElement = element.closest('main');
        const stopElement = mainElement?.parentElement || document.body;

        while (currentElement && currentElement !== stopElement) {
          const style = window.getComputedStyle(currentElement);
          additionalBottomOffset += Number.parseFloat(style.paddingBottom) || 0;
          additionalBottomOffset += Number.parseFloat(style.marginBottom) || 0;
          additionalBottomOffset += Number.parseFloat(style.borderBottomWidth) || 0;
          currentElement = currentElement.parentElement;
        }

        const availableBottom = viewportHeight - additionalBottomOffset;
        const nextHeight = Math.max(Math.floor(availableBottom - top) - 1, minHeight);

        setHeight(currentHeight => (currentHeight === nextHeight ? currentHeight : nextHeight));
      });
    };

    measure();

    const resizeObserver = new ResizeObserver(measure);
    const element = containerRef.current;

    if (element) {
      resizeObserver.observe(element);

      if (element.parentElement) {
        resizeObserver.observe(element.parentElement);
      }
    }

    window.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('resize', measure);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('resize', measure);
    };
  }, [minHeight]);

  return {
    containerRef,
    height,
  };
}
