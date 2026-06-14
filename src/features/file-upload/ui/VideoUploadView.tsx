import type React from 'react';

import { Button } from '@/features/shared/ui/ui/button.tsx';
import { Card, CardContent } from '@/features/shared/ui/ui/card.tsx';
import { FileUploadTrigger, FormControlInput, FormControlLabel } from '@/features/shared/ui/form';
import { X, Video, Loader2 } from 'lucide-react';
import { cn } from '@/features/shared/utils/utils.ts';

interface VideoUploadViewProps {
  className?: string;
  currentThumbnail?: string;
  label: string;
  description: string;
  previewUrl: string;
  videoUrl: string;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  isUploading: boolean;
  progress: number;
  copy: {
    uploading: string;
    uploadVideo: string;
    orProvideUrl: string;
    unsupportedVideo: string;
  };
  onFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  onUrlChange: (url: string) => void;
  onRemoveVideo: () => void;
}

export function VideoUploadView({
  className,
  currentThumbnail,
  label,
  description,
  previewUrl,
  videoUrl,
  fileInputRef,
  isUploading,
  progress,
  copy,
  onFileSelect,
  onUrlChange,
  onRemoveVideo,
}: VideoUploadViewProps) {
  return (
    <Card className={cn('', className)}>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="text-sm">
            <p className="font-medium">{label}</p>
            <p className="text-muted-foreground">{description}</p>
          </div>

          {previewUrl && (
            <div className="relative">
              <video
                controls
                preload="metadata"
                poster={currentThumbnail || undefined}
                className="w-full rounded-lg"
                src={previewUrl}
                style={{ maxHeight: '400px' }}
                onLoadedMetadata={event => {
                  const video = event.currentTarget;
                  if (!currentThumbnail) {
                    video.currentTime = 0.1;
                  }
                }}
              >
                {copy.unsupportedVideo}
              </video>
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2"
                onClick={onRemoveVideo}
                disabled={isUploading}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div className="flex gap-2">
            <FileUploadTrigger
              inputRef={fileInputRef}
              inputProps={{
                accept: 'video/*',
                onChange: onFileSelect,
              }}
              variant="outline"
              className="flex-1"
              disabled={isUploading}
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {copy.uploading} {progress}%
                </>
              ) : (
                <>
                  <Video className="mr-2 h-4 w-4" />
                  {copy.uploadVideo}
                </>
              )}
            </FileUploadTrigger>
          </div>

          <div className="space-y-2">
            <FormControlLabel>{copy.orProvideUrl}</FormControlLabel>
            <FormControlInput
              type="url"
              value={videoUrl}
              onChange={event => onUrlChange(event.target.value)}
              placeholder="https://example.com/video.mp4"
              disabled={isUploading}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
