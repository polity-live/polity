import type React from 'react';
import { useRef, useState } from 'react';

import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import { useUploadFile } from '@/features/file-upload/hooks/use-upload-file.ts';
import { toast } from '@/features/shared/ui/ui/sonner';

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
  const [previewUrl, setPreviewUrl] = useState<string>(currentVideo || '');
  const [videoUrl, setVideoUrl] = useState<string>(currentVideo || '');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadFile, isUploading, progress } = useUploadFile();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith('video/')) {
      toast.error(translateText('generated.inline.0523_please_select_a_valid_video_file_1459ebac'));
      return;
    }

    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error(
        translateText('generated.inline.0524_video_file_size_must_be_less_than_100mb_7ca8a681')
      );
      return;
    }

    try {
      const uploadResult = await uploadFile(file);
      if (uploadResult?.url) {
        setPreviewUrl(uploadResult.url);
        setVideoUrl(uploadResult.url);
        onVideoChange(uploadResult.url);
        toast.success(translateText('generated.inline.0525_video_uploaded_successfully_d74ca369'));
      }
    } catch (error) {
      console.error('Error uploading video:', error);
      toast.error(translateText('generated.inline.0526_failed_to_upload_video_c3009772'));
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
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return {
    className,
    currentThumbnail,
    label,
    description,
    previewUrl,
    videoUrl,
    fileInputRef,
    isUploading,
    progress,
    copy: {
      uploading: t('common.actions.uploading'),
      uploadVideo: t('common.actions.uploadVideo'),
      orProvideUrl: t('common.labels.orProvideUrl'),
      unsupportedVideo: translateText(
        'generated.inline.0527_your_browser_does_not_support_the_video_tag_05b27e33'
      ),
    },
    onFileSelect: handleFileSelect,
    onUrlChange: handleUrlChange,
    onRemoveVideo: handleRemoveVideo,
  };
}
