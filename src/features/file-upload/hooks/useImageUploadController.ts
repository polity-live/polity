import { useId, useState } from 'react';
import { toast } from '@/features/shared/ui/ui/sonner';

import { createClient } from '@/lib/supabase/client.ts';
import {
  translate as translateText,
  useTranslation,
} from '@/features/shared/hooks/use-translation';
import type { FileDropzoneRejection } from '../ui/FileDropzone';

const STORAGE_BUCKET = 'uploads';

export interface UseImageUploadControllerProps {
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

export function useImageUploadController({
  currentImage,
  onImageChange,
  entityType,
  entityId,
  onFileUpload,
  onImageRemove,
  cleanupOnRemove = false,
  label = translateText('generated.inline.0060_user_image_f1658ae3'),
  description = translateText(
    'generated.inline.0061_upload_a_user_image_or_provide_a_url_c9e63df2'
  ),
  className,
}: UseImageUploadControllerProps) {
  const urlInputId = useId();
  const { t } = useTranslation();
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const isBusy = isUploading || isRemoving;

  const clearImageSelection = () => {
    onImageChange('');
  };

  const uploadFile = async (file: File): Promise<boolean> => {
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
      return true;
    } catch (error) {
      console.error('Image upload error:', error);
      toast.error(t('common.actions.uploadImageFailed'));
      return false;
    } finally {
      setIsUploading(false);
    }
  };

  const handleFilesSelected = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    await uploadFile(file);
  };

  const handleFilesRejected = (rejections: FileDropzoneRejection[]) => {
    if (rejections.some(rejection => rejection.code === 'file-type')) {
      toast.error(t('common.actions.uploadImageTypesOnly'));
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
      toast.error(t('common.actions.removeImageFailed'));
    } finally {
      setIsRemoving(false);
    }
  };

  const handleSaveEditedImage = async (file: File) => uploadFile(file);

  return {
    className,
    currentImage,
    label,
    description,
    urlInputId,
    isBusy,
    isEditorOpen,
    isUploading,
    copy: {
      previewAlt: translateText('generated.inline.0520_preview_f1fbb2b4'),
      dropImageHere: t('common.actions.dropImageHere'),
      dragImageHere: t('common.actions.dragImageHere'),
      orClickToBrowse: t('common.actions.orClickToBrowse'),
      uploading: t('common.actions.uploading'),
      uploadImage: t('common.actions.uploadImage'),
      orProvideUrl: t('common.labels.orProvideUrl'),
      editImage: t('common.actions.edit', 'Edit'),
    },
    onEditorOpenChange: setIsEditorOpen,
    onSaveEditedImage: handleSaveEditedImage,
    onRemoveImage: () => void handleRemoveImage(),
    onFilesSelected: handleFilesSelected,
    onFilesRejected: handleFilesRejected,
    onImageUrlChange: onImageChange,
  };
}
