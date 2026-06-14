'use client';

import type React from 'react';

import { useVideoUploadController } from '@/features/file-upload/hooks/useVideoUploadController';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

import { VideoUploadView } from './VideoUploadView';

interface VideoUploadProps {
  currentVideo?: string;
  currentThumbnail?: string;
  onVideoChange: (videoUrl: string) => void;
  label?: string;
  description?: string;
  className?: string;
}

export const VideoUpload: React.FC<VideoUploadProps> = ({
  currentVideo,
  currentThumbnail,
  onVideoChange,
  label = 'Video',
  description = translateText('generated.inline.0062_upload_a_video_file_53bfeca8'),
  className,
}) => {
  const controller = useVideoUploadController({
    currentVideo,
    currentThumbnail,
    onVideoChange,
    label,
    description,
    className,
  });

  return <VideoUploadView {...controller} />;
};
