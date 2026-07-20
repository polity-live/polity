import * as React from 'react';

import { Loader2Icon } from 'lucide-react';

import { cn } from '@/features/shared/utils/utils.ts';

export interface ImageProgressViewProps {
  className?: string;
  file: File;
  imageRef?: React.RefObject<HTMLImageElement | null>;
  progress: number;
  objectUrl: string | null;
  setObjectUrl?: (value: string | null) => void;
}

export function ImageProgressView({
  className,
  file,
  imageRef,
  progress,
  objectUrl,
}: ImageProgressViewProps) {
  if (!objectUrl) {
    return null;
  }

  return (
    <div className={cn('relative', className)} contentEditable={false}>
      <img
        ref={imageRef}
        className="h-auto w-full rounded-sm object-cover"
        alt={file.name}
        src={objectUrl}
      />
      {progress < 100 && (
        <div className="absolute right-1 bottom-1 flex items-center space-x-2 rounded-md bg-black/50 px-1 py-0.5">
          <Loader2Icon className="text-muted-foreground size-3.5 animate-spin" />
          <span className="text-xs font-medium text-white">{Math.round(progress)}%</span>
        </div>
      )}
    </div>
  );
}
