'use client';

import React, { useState, useRef } from 'react';
import { Button } from '@/features/shared/ui/ui/button.tsx';
import { Card, CardContent } from '@/features/shared/ui/ui/card.tsx';
import { FileUploadTrigger, FormControlInput, FormControlLabel } from '@/features/shared/ui/form';
import { X, Video, Loader2 } from 'lucide-react';
import { cn } from '@/features/shared/utils/utils.ts';
import { useUploadFile } from '@/features/file-upload/hooks/use-upload-file.ts';
import { toast } from 'sonner';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';

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
  const { t } = useTranslation();
  const [previewUrl, setPreviewUrl] = useState<string>(currentVideo || '');
  const [videoUrl, setVideoUrl] = useState<string>(currentVideo || '');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadFile, isUploading, progress } = useUploadFile();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check if it's a video file
      if (!file.type.startsWith('video/')) {
        toast.error(
          translateText('generated.inline.0523_please_select_a_valid_video_file_1459ebac')
        );
        return;
      }

      // Check file size (limit to 100MB)
      const maxSize = 100 * 1024 * 1024; // 100MB
      if (file.size > maxSize) {
        toast.error(
          translateText('generated.inline.0524_video_file_size_must_be_less_than_100mb_7ca8a681')
        );
        return;
      }

      try {
        // Upload to InstantDB
        const uploadResult = await uploadFile(file);
        if (uploadResult?.url) {
          setPreviewUrl(uploadResult.url);
          setVideoUrl(uploadResult.url);
          onVideoChange(uploadResult.url);
          toast.success(
            translateText('generated.inline.0525_video_uploaded_successfully_d74ca369')
          );
        }
      } catch (error) {
        console.error('Error uploading video:', error);
        toast.error(translateText('generated.inline.0526_failed_to_upload_video_c3009772'));
      }
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

  return (
    <Card className={cn('', className)}>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="text-sm">
            <p className="font-medium">{label}</p>
            <p className="text-muted-foreground">{description}</p>
          </div>

          {/* Video Preview */}
          {previewUrl && (
            <div className="relative">
              <video
                controls
                preload="metadata"
                poster={currentThumbnail || undefined}
                className="w-full rounded-lg"
                src={previewUrl}
                style={{ maxHeight: '400px' }}
                onLoadedMetadata={e => {
                  const video = e.currentTarget;
                  // Only set currentTime if no poster is provided
                  if (!currentThumbnail) {
                    video.currentTime = 0.1;
                  }
                }}
              >
                {translateText(
                  'generated.inline.0527_your_browser_does_not_support_the_video_tag_05b27e33'
                )}
              </video>
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2"
                onClick={handleRemoveVideo}
                disabled={isUploading}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Upload Button */}
          <div className="flex gap-2">
            <FileUploadTrigger
              inputRef={fileInputRef}
              inputProps={{
                accept: 'video/*',
                onChange: handleFileSelect,
              }}
              variant="outline"
              className="flex-1"
              disabled={isUploading}
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('common.actions.uploading')} {progress}%
                </>
              ) : (
                <>
                  <Video className="mr-2 h-4 w-4" />
                  {t('common.actions.uploadVideo')}
                </>
              )}
            </FileUploadTrigger>
          </div>

          {/* URL Input */}
          <div className="space-y-2">
            <FormControlLabel>{t('common.labels.orProvideUrl')}</FormControlLabel>
            <FormControlInput
              type="url"
              value={videoUrl}
              onChange={e => handleUrlChange(e.target.value)}
              placeholder="https://example.com/video.mp4"
              disabled={isUploading}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
