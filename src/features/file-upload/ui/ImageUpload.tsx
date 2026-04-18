'use client';

import React, { useState, useRef } from 'react';
import { Button } from '@/features/shared/ui/ui/button.tsx';
import { Card, CardContent } from '@/features/shared/ui/ui/card.tsx';
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
  label?: string;
  description?: string;
  className?: string;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({
  currentImage,
  onImageChange,
  entityType,
  entityId,
  onFileUpload,
  label = 'User Image',
  description = 'Upload a user image or provide a URL',
  className,
}) => {
  const { t } = useTranslation();
  const [isUploading, setIsUploading] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    try {
      let imageUrl = '';

      if (onFileUpload) {
        imageUrl = await onFileUpload(file);
      } else {
        if (!entityType || !entityId) {
          throw new Error('Image uploads require entityType and entityId when no custom upload handler is provided.');
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

  const handleRemoveImage = () => {
    onImageChange('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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
                onClick={handleRemoveImage}
                disabled={isUploading}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div
            className={cn(
              'rounded-lg border border-dashed p-4 transition-colors',
              isDragActive ? 'border-primary bg-primary/5' : 'border-border bg-muted/20',
              isUploading && 'pointer-events-none opacity-70'
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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="sm:flex-none"
                disabled={isUploading}
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
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground">
                  {isDragActive
                    ? t('common.actions.dropImageHere', 'Drop your image here')
                    : t('common.actions.dragImageHere', 'Drag an image or GIF here')}
                </p>
                <p>{t('common.actions.orClickToBrowse', 'or click the button to browse')}</p>
              </div>
            </div>
          </div>

          {/* URL Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('common.labels.orProvideUrl')}</label>
            <input
              type="url"
              value={currentImage || ''}
              onChange={e => onImageChange(e.target.value)}
              placeholder="https://example.com/image.jpg"
              data-testid="image-upload-url-input"
              className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
