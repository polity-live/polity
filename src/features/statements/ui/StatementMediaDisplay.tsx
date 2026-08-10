import { cn } from '@/features/shared/utils/utils';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface StatementMediaDisplayProps {
  imageUrl?: string | null;
  videoUrl?: string | null;
  alt?: string;
  className?: string;
}

export function StatementMediaDisplay({
  imageUrl,
  videoUrl,
  alt = translateText('generated.inline.0171_statement_media_7c323153'),
  className,
}: StatementMediaDisplayProps) {
  if (!imageUrl && !videoUrl) return null;

  return (
    <div className={cn('overflow-hidden rounded-lg', className)}>
      {videoUrl ? (
        <video src={videoUrl} poster={imageUrl ?? undefined} controls className="w-full rounded-lg">
          <track kind="captions" />
        </video>
      ) : (
        <img
          src={imageUrl as string}
          alt={alt}
          className="w-full rounded-lg object-cover"
          loading="lazy"
        />
      )}
    </div>
  );
}
