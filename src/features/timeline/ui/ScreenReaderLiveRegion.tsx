interface ScreenReaderLiveRegionProps {
  announcement: string;
  priority?: 'polite' | 'assertive';
}

export function ScreenReaderLiveRegion({
  announcement,
  priority = 'polite',
}: ScreenReaderLiveRegionProps) {
  return (
    <div role="status" aria-live={priority} aria-atomic="true" className="sr-only">
      {announcement}
    </div>
  );
}
