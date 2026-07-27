import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
} from 'react';
import { Button } from '@/features/shared/ui/ui/button';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

export interface DeferredLandingPreviewProps {
  load: () => Promise<{ default: ComponentType }>;
  minHeight: CSSProperties['minHeight'];
  label: string;
}

export function DeferredLandingPreview({ load, minHeight, label }: DeferredLandingPreviewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [Component, setComponent] = useState<ComponentType | null>(null);
  const [error, setError] = useState(false);
  const [requested, setRequested] = useState(false);

  const requestComponent = useCallback(() => {
    setRequested(true);
    setError(false);
    void load()
      .then(module => setComponent(() => module.default))
      .catch(() => {
        setRequested(false);
        setError(true);
      });
  }, [load]);

  useEffect(() => {
    if (Component || requested || error) return;
    const host = hostRef.current;
    if (!host || typeof IntersectionObserver === 'undefined') {
      requestComponent();
      return;
    }

    const observer = new IntersectionObserver(
      entries => {
        if (!entries.some(entry => entry.isIntersecting)) return;
        observer.disconnect();
        requestComponent();
      },
      { rootMargin: '400px 0px', threshold: 0.01 }
    );
    observer.observe(host);
    return () => observer.disconnect();
  }, [Component, error, requestComponent, requested]);

  return (
    <div
      ref={hostRef}
      data-slot="deferred-landing-preview"
      data-preview-state={Component ? 'ready' : error ? 'error' : requested ? 'loading' : 'idle'}
      style={{ minHeight }}
      className="relative min-w-0"
      aria-busy={!Component && !error}
    >
      {Component ? (
        <Component />
      ) : error ? (
        <div
          className="bg-muted/20 flex h-full min-h-[inherit] items-center justify-center rounded-lg border"
          role="alert"
        >
          <div className="space-y-3 p-6 text-center">
            <p className="text-muted-foreground text-sm">{label}</p>
            <Button type="button" variant="outline" size="sm" onClick={requestComponent}>
              {translateText('common.loading.appBoot.retry')}
            </Button>
          </div>
        </div>
      ) : (
        <div
          className="bg-muted/20 h-full min-h-[inherit] animate-pulse rounded-lg border"
          aria-label={label}
        />
      )}
    </div>
  );
}
