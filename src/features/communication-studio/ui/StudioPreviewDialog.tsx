import { lazy, Suspense, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/features/shared/ui/ui/dialog';
import type { StudioAsset } from '../hooks/useStudioDocument';
import { getStudioRootFramesInLayerOrder } from '../logic/frame-order';
import type { StudioDocumentV3 } from '../logic/document-v3';

const KonvaStudioCanvas = lazy(() => import('./KonvaStudioCanvas'));

export function StudioPreviewDialog({
  document,
  assets,
  activeFrameId,
  open,
  onOpenChange,
  returnFocusRef,
  tr,
}: {
  document: StudioDocumentV3;
  assets: StudioAsset[];
  activeFrameId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
  tr: (key: string) => string;
}) {
  const frames = useMemo(
    () => getStudioRootFramesInLayerOrder(document).filter(frame => frame.visible),
    [document]
  );
  const frameIds = frames.map(frame => frame.id);
  const frameOrderKey = frameIds.join('|');
  const previousFrameIds = useRef(frameIds);
  const [currentFrameId, setCurrentFrameId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setCurrentFrameId(null);
      previousFrameIds.current = frameIds;
      return;
    }
    setCurrentFrameId(current => {
      if (!current)
        return activeFrameId && frameIds.includes(activeFrameId)
          ? activeFrameId
          : (frameIds[0] ?? null);
      if (frameIds.includes(current)) return current;
      const previousIndex = previousFrameIds.current.indexOf(current);
      return frameIds[Math.min(Math.max(previousIndex, 0), frameIds.length - 1)] ?? null;
    });
    previousFrameIds.current = frameIds;
  }, [open, activeFrameId, frameOrderKey]);

  const resolvedFrameId =
    currentFrameId && frameIds.includes(currentFrameId)
      ? currentFrameId
      : activeFrameId && frameIds.includes(activeFrameId)
        ? activeFrameId
        : (frameIds[0] ?? null);
  const currentIndex = resolvedFrameId ? frameIds.indexOf(resolvedFrameId) : -1;
  const frame = currentIndex >= 0 ? frames[currentIndex] : null;
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < frames.length - 1;
  const move = (offset: -1 | 1) => {
    if (currentIndex < 0) return;
    const nextIndex = Math.max(0, Math.min(frames.length - 1, currentIndex + offset));
    setCurrentFrameId(frameIds[nextIndex]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="fixed inset-0 top-0 left-0 h-dvh w-screen max-w-none translate-x-0 translate-y-0 gap-0 rounded-none border-0 bg-black p-0 text-white shadow-none sm:max-w-none"
        aria-describedby="studio-preview-description"
        onCloseAutoFocus={event => {
          if (!returnFocusRef?.current) return;
          event.preventDefault();
          returnFocusRef.current.focus();
        }}
        onKeyDown={event => {
          if (event.key === 'ArrowLeft') {
            event.preventDefault();
            move(-1);
          } else if (event.key === 'ArrowRight') {
            event.preventDefault();
            move(1);
          }
        }}
      >
        <DialogTitle className="sr-only">{tr('previewTitle')}</DialogTitle>
        <DialogDescription id="studio-preview-description" className="sr-only">
          {tr('previewDescription')}
        </DialogDescription>
        <div className="flex h-full min-h-0 flex-col">
          <header className="flex h-14 shrink-0 items-center gap-3 border-b border-white/15 px-4">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{frame?.name ?? tr('noVisibleFrames')}</p>
            </div>
            {currentIndex >= 0 && (
              <output className="text-sm text-white/70 tabular-nums" aria-live="polite">
                {currentIndex + 1} / {frames.length}
              </output>
            )}
            <DialogClose asChild data-action-id="communication-studio.preview.close">
              <button
                type="button"
                data-action-id="communication-studio.preview.close"
                className="inline-flex size-9 items-center justify-center rounded-md hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
                aria-label={tr('closePreview')}
              >
                <X className="size-5" />
              </button>
            </DialogClose>
          </header>

          <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
            <button
              type="button"
              data-action-id="communication-studio.preview.advance"
              data-action-kind="interaction"
              aria-label={tr('advancePreview')}
              disabled={!hasNext}
              data-testid="preview-advance-surface"
              className={`flex h-full w-full items-center justify-center ${hasNext ? 'cursor-pointer' : ''}`}
              onClick={() => move(1)}
            >
              {frame ? (
                <Suspense fallback={<p role="status">{tr('loading')}</p>}>
                  <KonvaStudioCanvas
                    key={frame.id}
                    document={document}
                    activeFrameId={frame.id}
                    fit="contain"
                    assets={assets}
                    selected={[]}
                    editable={false}
                    guides={false}
                  />
                </Suspense>
              ) : (
                <p className="text-sm text-white/70" role="status">
                  {tr('noVisibleFrames')}
                </p>
              )}
            </button>

            <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-3">
              <button
                type="button"
                data-action-id="communication-studio.preview.previous"
                data-action-kind="interaction"
                className="inline-flex size-11 items-center justify-center rounded-full bg-black/70 text-white shadow-lg backdrop-blur hover:bg-black/90 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-35"
                aria-label={tr('previousFrame')}
                disabled={!hasPrevious}
                onClick={() => move(-1)}
              >
                <ChevronLeft className="size-6" />
              </button>
              <button
                type="button"
                data-action-id="communication-studio.preview.next"
                data-action-kind="interaction"
                className="inline-flex size-11 items-center justify-center rounded-full bg-black/70 text-white shadow-lg backdrop-blur hover:bg-black/90 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-35"
                aria-label={tr('nextFrame')}
                disabled={!hasNext}
                onClick={() => move(1)}
              >
                <ChevronRight className="size-6" />
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
