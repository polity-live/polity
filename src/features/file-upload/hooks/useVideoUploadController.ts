import { useEffect, useId, useState } from 'react';

import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import { useUploadFile } from '@/features/file-upload/hooks/use-upload-file.ts';
import { toast } from '@/features/shared/ui/ui/sonner';
import type { FileDropzoneRejection } from '@/features/file-upload/ui/FileDropzone';

export const MAX_VIDEO_UPLOAD_SIZE = 100 * 1024 * 1024;

interface UseVideoUploadControllerProps {
  currentVideo?: string;
  currentThumbnail?: string;
  onVideoChange: (videoUrl: string) => void;
  label?: string;
  description?: string;
  className?: string;
}

export function useVideoUploadController({
  currentVideo,
  currentThumbnail,
  onVideoChange,
  label = 'Video',
  description = translateText('generated.inline.0062_upload_a_video_file_53bfeca8'),
  className,
}: UseVideoUploadControllerProps) {
  const { t } = useTranslation();
  const urlInputId = useId();
  const [previewUrl, setPreviewUrl] = useState<string>(currentVideo || '');
  const [videoUrl, setVideoUrl] = useState<string>(currentVideo || '');
  const { uploadFile, isUploading, progress } = useUploadFile();

  useEffect(() => {
    setPreviewUrl(currentVideo || '');
    setVideoUrl(currentVideo || '');
  }, [currentVideo]);

  const handleFilesSelected = async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      toast.error(t('common.actions.uploadVideoTypesOnly'));
      return;
    }

    if (file.size > MAX_VIDEO_UPLOAD_SIZE) {
      toast.error(t('common.actions.videoTooLarge'));
      return;
    }

    try {
      const uploadResult = await uploadFile(file);
      if (uploadResult?.url) {
        setPreviewUrl(uploadResult.url);
        setVideoUrl(uploadResult.url);
        onVideoChange(uploadResult.url);
        toast.success(t('common.actions.videoUploadSuccess'));
      }
    } catch (error) {
      console.error('Error uploading video:', error);
      toast.error(t('common.actions.videoUploadFailed'));
    }
  };

  const handleFilesRejected = (rejections: FileDropzoneRejection[]) => {
    if (rejections.some(rejection => rejection.code === 'file-type')) {
      toast.error(t('common.actions.uploadVideoTypesOnly'));
    }
    if (rejections.some(rejection => rejection.code === 'file-size')) {
      toast.error(t('common.actions.videoTooLarge'));
    }
  };

  const handleUrlChange = (url: string) => {
    setVideoUrl(url);
    setPreviewUrl(url);
    onVideoChange(url);
  };

  const handleRemoveVideo = () => {
    setPreviewUrl('');
    setVideoUrl('');
    onVideoChange('');
  };

  return {
    className,
    currentThumbnail,
    label,
    description,
    previewUrl,
    videoUrl,
    urlInputId,
    isUploading,
    progress,
    maxSize: MAX_VIDEO_UPLOAD_SIZE,
    copy: {
      dropVideoHere: t('common.actions.dropVideoHere'),
      dragVideoHere: t('common.actions.dragVideoHere'),
      orClickToBrowse: t('common.media.orClickToBrowse'),
      uploading: t('common.actions.uploading'),
      uploadVideo: t('common.actions.uploadVideo'),
      orProvideUrl: t('common.labels.orProvideUrl'),
      unsupportedVideo: t('common.media.unsupportedVideo'),
    },
    onFilesSelected: handleFilesSelected,
    onFilesRejected: handleFilesRejected,
    onUrlChange: handleUrlChange,
    onRemoveVideo: handleRemoveVideo,
  };
}
