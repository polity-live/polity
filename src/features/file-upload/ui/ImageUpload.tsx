'use client';

import React, { useId, useState, useRef } from 'react';
import { Button } from '@/features/shared/ui/ui/button.tsx';
import { Card, CardContent } from '@/features/shared/ui/ui/card.tsx';
import { Input } from '@/features/shared/ui/ui/input.tsx';
import { Upload, X, Loader2 } from 'lucide-react';
import { cn } from '@/features/shared/utils/utils.ts';
import { useTranslation } from '@/features/shared/hooks/use-translation.ts';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client.ts';

const STORAGE_BUCKET = 'uploads';

interface ImageUploadProps {
  currentImage?: string;
  onImageChange: (imageUrl: string) => void;
  entityType?: string;
  entityId?: string;
  onFileUpload?: (file: File) => Promise<string>;
  onImageRemove?: (imageUrl: string) => Promise<void> | void;
  cleanupOnRemove?: boolean;
  label?: string;
  description?: string;
  className?: string;
}

function getStorageObjectFromPublicUrl(imageUrl: string): { bucket: string; path: string } | null {
  try {
    const url = new URL(imageUrl);
    const publicObjectPrefix = '/storage/v1/object/public/';
    const publicObjectIndex = url.pathname.indexOf(publicObjectPrefix);

    if (publicObjectIndex === -1) {
      return null;
    }

    const publicObjectPath = url.pathname.slice(publicObjectIndex + publicObjectPrefix.length);
    const [bucket, ...pathSegments] = publicObjectPath.split('/').filter(Boolean);

    if (!bucket || pathSegments.length === 0) {
      return null;
    }

    return {
      bucket: decodeURIComponent(bucket),
      path: pathSegments.map(segment => decodeURIComponent(segment)).join('/'),
    };
  } catch {
    return null;
  }
}

export const ImageUpload: React.FC<ImageUploadProps> = ({
  currentImage,
  onImageChange,
  entityType,
  entityId,
  onFileUpload,
  onImageRemove,
  cleanupOnRemove = false,
  label = 'User Image',
  description = 'Upload a user image or provide a URL',
  className,
}) => {
  const urlInputId = useId();
  const { t } = useTranslation();
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);
  const isBusy = isUploading || isRemoving;

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    try {
      let imageUrl = '';

      if (onFileUpload) {
        imageUrl = await onFileUpload(file);
      } else {
        if (!entityType || !entityId) {
          throw new Error(
            'Image uploads require entityType and entityId when no custom upload handler is provided.'
          );
        }

        const supabase = createClient();
        const timestamp = Date.now();
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const path = `${entityType}/${entityId}/${timestamp}-${sanitizedName}`;

        const { error } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(path, file, { contentType: file.type, upsert: true });

        if (error) throw error;

        const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
        imageUrl = urlData.publicUrl;
      }

      onImageChange(imageUrl);
    } catch (error) {
      console.error('Image upload error:', error);
      toast.error(t('common.actions.uploadImageFailed', 'Image upload failed'));
    } finally {
      setIsUploading(false);
      setIsDragActive(false);
      dragCounterRef.current = 0;
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    await uploadFile(file);
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = Math.max(dragCounterRef.current - 1, 0);

    if (dragCounterRef.current === 0) {
      setIsDragActive(false);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    dragCounterRef.current = 0;
    setIsDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast.error(t('common.actions.uploadImageTypesOnly', 'Please drop an image file.'));
      return;
    }

    await uploadFile(file);
  };

  const clearImageSelection = () => {
    onImageChange('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = async () => {
    if (!currentImage) {
      clearImageSelection();
      return;
    }

    if (!cleanupOnRemove && !onImageRemove) {
      clearImageSelection();
      return;
    }

    setIsRemoving(true);

    try {
      if (cleanupOnRemove) {
        const storageObject = getStorageObjectFromPublicUrl(currentImage);

        if (storageObject) {
          const supabase = createClient();
          const { error } = await supabase.storage
            .from(storageObject.bucket)
            .remove([storageObject.path]);

          if (error) {
            throw error;
          }
        }
      }

      await onImageRemove?.(currentImage);
      clearImageSelection();
    } catch (error) {
      console.error('Image removal error:', error);
      toast.error(t('common.actions.removeImageFailed', 'Failed to remove image'));
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <Card className={cn('', className)} data-testid="image-upload">
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="text-sm">
            <p className="font-medium">{label}</p>
            <p className="text-muted-foreground">{description}</p>
          </div>

          {/* Image Preview */}
          {currentImage && (
            <div className="relative">
              <img
                src={currentImage}
                alt="Preview"
                data-testid="image-upload-preview"
                className="h-48 w-full rounded-lg object-cover"
              />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2"
                onClick={() => void handleRemoveImage()}
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
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              data-testid="image-upload-input"
              onChange={handleFileSelect}
            />
            <div className="mx-auto flex max-w-md flex-col items-center gap-4 text-center">
              <div className="bg-background/80 flex h-12 w-12 items-center justify-center rounded-full border shadow-sm">
                <Upload className="text-primary h-5 w-5" />
              </div>
              <div className="space-y-1 text-sm">
                <p className="text-foreground font-medium">
                  {isDragActive
                    ? t('common.actions.dropImageHere', 'Drop your image here')
                    : t('common.actions.dragImageHere', 'Drag an image or GIF here')}
                </p>
                <p className="text-muted-foreground">
                  {t('common.actions.orClickToBrowse', 'or click the button to browse')}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="mx-auto min-w-44"
                disabled={isBusy}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('common.actions.uploading', 'Uploading...')}
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    {t('common.actions.uploadImage')}
                  </>
                )}
              </Button>
              <div className="text-muted-foreground flex w-full items-center gap-3 text-[11px] font-medium tracking-[0.24em] uppercase">
                <span className="bg-border h-px flex-1" />
                <span>{t('common.labels.orProvideUrl')}</span>
                <span className="bg-border h-px flex-1" />
              </div>
              <div className="w-full space-y-2 text-left">
                <label className="sr-only" htmlFor={urlInputId}>
                  {t('common.labels.orProvideUrl')}
                </label>
                <Input
                  id={urlInputId}
                  type="url"
                  value={currentImage || ''}
                  onChange={e => onImageChange(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  data-testid="image-upload-url-input"
                  aria-label={t('common.labels.orProvideUrl')}
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
};
