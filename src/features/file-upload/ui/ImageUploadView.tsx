import { featureThemeClassName } from '@/features/shared/theme';
import type React from 'react';
import { FileUploadTrigger, FormControlInput, FormControlLabel } from '@/features/shared/ui/form';
import { Button } from '@/features/shared/ui/ui/button.tsx';
import { Card, CardContent } from '@/features/shared/ui/ui/card.tsx';
import { cn } from '@/features/shared/utils/utils.ts';
import { Loader2, Upload, X } from 'lucide-react';

interface ImageUploadViewProps {
  className?: string;
  currentImage?: string;
  label: string;
  description: string;
  urlInputId: string;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  isBusy: boolean;
  isUploading: boolean;
  isDragActive: boolean;
  copy: {
    previewAlt: string;
    dropImageHere: string;
    dragImageHere: string;
    orClickToBrowse: string;
    uploading: string;
    uploadImage: string;
    orProvideUrl: string;
  };
  onRemoveImage: () => void;
  onFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  onDragEnter: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void | Promise<void>;
  onImageUrlChange: (imageUrl: string) => void;
}

export function ImageUploadView({
  className,
  currentImage,
  label,
  description,
  urlInputId,
  fileInputRef,
  isBusy,
  isUploading,
  isDragActive,
  copy,
  onRemoveImage,
  onFileSelect,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  onImageUrlChange,
}: ImageUploadViewProps) {
  return (
    <Card className={cn('', className)} data-testid="image-upload">
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="text-sm">
            <p className="font-medium">{label}</p>
            <p className="text-muted-foreground">{description}</p>
          </div>

          {currentImage && (
            <div className="relative">
              <img
                src={currentImage}
                alt={copy.previewAlt}
                data-testid="image-upload-preview"
                className="h-48 w-full rounded-lg object-cover"
              />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2"
                onClick={onRemoveImage}
                disabled={isBusy}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div
            className={cn(
              'rounded-2xl border border-dashed px-4 py-6 transition-all sm:px-6',
              isDragActive
                ? 'border-primary bg-primary/5 shadow-primary/10 shadow-sm'
                : 'border-border bg-muted/20',
              isBusy && 'pointer-events-none opacity-70'
            )}
            data-testid="image-upload-dropzone"
            onDragEnter={onDragEnter}
            onDragLeave={onDragLeave}
            onDragOver={onDragOver}
            onDrop={onDrop}
          >
            <div className="mx-auto flex max-w-md flex-col items-center gap-4 text-center">
              <div className="bg-background/80 flex h-12 w-12 items-center justify-center rounded-full border shadow-sm">
                <Upload className="text-primary h-5 w-5" />
              </div>
              <div className="space-y-1 text-sm">
                <p className="text-foreground font-medium">
                  {isDragActive ? copy.dropImageHere : copy.dragImageHere}
                </p>
                <p className="text-muted-foreground">{copy.orClickToBrowse}</p>
              </div>
              <FileUploadTrigger
                inputRef={fileInputRef}
                inputProps={{
                  accept: 'image/*',
                  'data-testid': 'image-upload-input',
                  onChange: onFileSelect,
                }}
                variant="outline"
                className="mx-auto min-w-44"
                disabled={isBusy}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {copy.uploading}
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    {copy.uploadImage}
                  </>
                )}
              </FileUploadTrigger>
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
                  value={currentImage || ''}
                  onChange={event => onImageUrlChange(event.target.value)}
                  placeholder="https://example.com/image.jpg"
                  data-testid="image-upload-url-input"
                  aria-label={copy.orProvideUrl}
                  disabled={isBusy}
                  className="bg-background/90 text-center shadow-sm sm:text-left"
                />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
