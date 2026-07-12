import { ExternalLink } from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { Button } from '@/features/shared/ui/ui/button';
import { cn } from '@/features/shared/utils/utils';
import { resolveEventStreamSource } from '../logic/eventStreamUrl';

interface EventLivestreamPlayerProps {
  streamUrl?: string | null;
  title?: string;
  containerClassName?: string;
}

export function EventLivestreamPlayer({
  streamUrl,
  title,
  containerClassName,
}: EventLivestreamPlayerProps) {
  const { t } = useTranslation();
  const parentHostname = typeof window === 'undefined' ? '' : window.location.hostname;
  const source = resolveEventStreamSource(streamUrl, parentHostname);
  if (!source) return null;

  if (source.provider === 'external') {
    return (
      <div
        className={cn(
          'bg-muted/50 flex flex-col items-center gap-3 rounded-lg p-6 text-center',
          containerClassName
        )}
      >
        <p className="text-muted-foreground text-sm">
          {t('features.events.stream.externalStreamDescription')}
        </p>
        <Button asChild variant="outline">
          <a href={source.externalUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-2 h-4 w-4" />
            {t('features.events.stream.openStream')}
          </a>
        </Button>
      </div>
    );
  }

  return (
    <div className={cn('overflow-hidden rounded-lg', containerClassName)}>
      <div className="aspect-video">
        <iframe
          className="h-full w-full"
          src={source.embedUrl}
          title={title ?? t('features.events.stream.liveStream')}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    </div>
  );
}
