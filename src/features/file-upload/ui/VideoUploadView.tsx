import { featureThemeClassName } from '@/features/shared/theme';
import { Button } from '@/features/shared/ui/ui/button.tsx';
import { Card, CardContent } from '@/features/shared/ui/ui/card.tsx';
import { FormControlInput, FormControlLabel } from '@/features/shared/ui/form';
import { X } from 'lucide-react';
import { cn } from '@/features/shared/utils/utils.ts';
import { FileDropzone, type FileDropzoneRejection } from './FileDropzone';

interface VideoUploadViewProps {
  className?: string;
  currentThumbnail?: string;
  label: string;
  description: string;
  previewUrl: string;
  videoUrl: string;
  urlInputId: string;
  isUploading: boolean;
  progress: number;
  maxSize: number;
  copy: {
    dropVideoHere: string;
    dragVideoHere: string;
    orClickToBrowse: string;
    uploading: string;
    uploadVideo: string;
    orProvideUrl: string;
    unsupportedVideo: string;
  };
  onFilesSelected: (files: File[]) => void | Promise<void>;
  onFilesRejected: (rejections: FileDropzoneRejection[]) => void;
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
  urlInputId,
  isUploading,
  progress,
  maxSize,
  copy,
  onFilesSelected,
  onFilesRejected,
  onUrlChange,
  onRemoveVideo,
}: VideoUploadViewProps) {
  return (
    <Card className={cn('', className)} data-testid="video-upload">
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
                className="bg-background aspect-video max-h-[400px] w-full rounded-lg object-contain"
                src={previewUrl}
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

          <FileDropzone
            accept="video/*"
            maxSize={maxSize}
            disabled={isUploading}
            busy={isUploading}
            idleLabel={copy.dragVideoHere}
            activeLabel={copy.dropVideoHere}
            browseLabel={copy.uploadVideo}
            busyLabel={`${copy.uploading} ${progress}%`}
            hint={copy.orClickToBrowse}
            testId="video-upload-dropzone"
            inputProps={{ 'data-testid': 'video-upload-input' }}
            onFilesSelected={onFilesSelected}
            onFilesRejected={onFilesRejected}
          >
            <div className={featureThemeClassName('fileuploadImageUploadThemedText')}>
              <span className="bg-border h-px flex-1" />
              <span>{copy.orProvideUrl}</span>
              <span className="bg-border h-px flex-1" />
            </div>
            <div className="w-full space-y-2 text-left">
              <FormControlLabel className="sr-only" htmlFor={urlInputId}>
                {copy.orProvideUrl}
              </FormControlLabel>
              <FormControlInput
                id={urlInputId}
                type="url"
                value={videoUrl}
                onChange={event => onUrlChange(event.target.value)}
                placeholder="https://example.com/video.mp4"
                data-testid="video-upload-url-input"
                aria-label={copy.orProvideUrl}
                disabled={isUploading}
                className="bg-background/90 text-center shadow-sm sm:text-left"
              />
            </div>
          </FileDropzone>
        </div>
      </CardContent>
    </Card>
  );
}
