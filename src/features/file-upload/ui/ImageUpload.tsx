'use client';

import type React from 'react';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { useImageUploadController } from '@/features/file-upload/hooks/useImageUploadController';
import { ImageUploadView } from './ImageUploadView';

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

export const ImageUpload: React.FC<ImageUploadProps> = ({
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
}) => {
  const viewProps = useImageUploadController({
    currentImage,
    onImageChange,
    entityType,
    entityId,
    onFileUpload,
    onImageRemove,
    cleanupOnRemove,
    label,
    description,
    className,
  });

  return <ImageUploadView {...viewProps} />;
};
