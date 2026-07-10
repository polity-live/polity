import { featureThemeClassName } from '@/features/shared/theme';
import type React from 'react';
import { FormControlInput, FormControlLabel } from '@/features/shared/ui/form';
import { Button } from '@/features/shared/ui/ui/button.tsx';
import { Card, CardContent } from '@/features/shared/ui/ui/card.tsx';
import { cn } from '@/features/shared/utils/utils.ts';
import { Pencil, X } from 'lucide-react';
import { ImageEditorDialog } from './ImageEditorDialog';
import { FileDropzone, type FileDropzoneRejection } from './FileDropzone';

interface ImageUploadViewProps {
  className?: string;
  currentImage?: string;
  label: string;
  description: string;
  urlInputId: string;
  isBusy: boolean;
  isEditorOpen: boolean;
  isUploading: boolean;
  copy: {
    previewAlt: string;
    dropImageHere: string;
    dragImageHere: string;
    orClickToBrowse: string;
    uploading: string;
    uploadImage: string;
    orProvideUrl: string;
    editImage: string;
  };
  onEditorOpenChange: (open: boolean) => void;
  onSaveEditedImage: (file: File) => Promise<boolean>;
  onRemoveImage: () => void;
  onFilesSelected: (files: File[]) => void | Promise<void>;
  onFilesRejected: (rejections: FileDropzoneRejection[]) => void;
  onImageUrlChange: (imageUrl: string) => void;
}

export function ImageUploadView({
  className,
  currentImage,
  label,
  description,
  urlInputId,
  isBusy,
  isEditorOpen,
  isUploading,
  copy,
  onEditorOpenChange,
  onSaveEditedImage,
  onRemoveImage,
  onFilesSelected,
  onFilesRejected,
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
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="bg-background/90 absolute top-2 left-2 shadow-sm backdrop-blur"
                onClick={() => onEditorOpenChange(true)}
                disabled={isBusy}
              >
                <Pencil className="h-4 w-4" />
                <span>{copy.editImage}</span>
              </Button>
            </div>
          )}

          <ImageEditorDialog
            imageUrl={currentImage}
            open={isEditorOpen}
            onOpenChange={onEditorOpenChange}
            onSave={onSaveEditedImage}
          />

          <FileDropzone
            accept="image/*"
            disabled={isBusy}
            busy={isUploading}
            idleLabel={copy.dragImageHere}
            activeLabel={copy.dropImageHere}
            browseLabel={copy.uploadImage}
            busyLabel={copy.uploading}
            hint={copy.orClickToBrowse}
            testId="image-upload-dropzone"
            inputProps={{ 'data-testid': 'image-upload-input' }}
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
                value={currentImage || ''}
                onChange={event => onImageUrlChange(event.target.value)}
                placeholder="https://example.com/image.jpg"
                data-testid="image-upload-url-input"
                aria-label={copy.orProvideUrl}
                disabled={isBusy}
                className="bg-background/90 text-center shadow-sm sm:text-left"
              />
            </div>
          </FileDropzone>
        </div>
      </CardContent>
    </Card>
  );
}
