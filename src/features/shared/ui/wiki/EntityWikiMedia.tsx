import { cn } from '@/features/shared/utils/utils';

export interface EntityWikiMediaProps {
  imageUrl?: string | null;
  videoUrl?: string | null;
  alt: string;
  className?: string;
}

export function EntityWikiMedia({ imageUrl, videoUrl, alt, className }: EntityWikiMediaProps) {
  if (!imageUrl && !videoUrl) return null;

  return (
    <div className={cn('mb-8', className)}>
      {videoUrl ? (
        <video
          src={videoUrl}
          aria-label={alt}
          controls
          playsInline
          preload="metadata"
          className="bg-background mx-auto aspect-video w-full max-w-4xl rounded-lg object-contain shadow-lg"
        />
      ) : (
        <img
          src={imageUrl ?? undefined}
          alt={alt}
          className="mx-auto h-64 w-full max-w-4xl rounded-lg object-cover shadow-lg"
        />
      )}
    </div>
  );
}
