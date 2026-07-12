'use client';

import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/features/shared/ui/ui/tabs';
import { ImageUpload } from './ImageUpload';
import { VideoUpload } from './VideoUpload';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface MediaUploadProps {
  currentImage?: string;
  onImageChange: (url: string) => void;
  onImageFileUpload?: (file: File) => Promise<string>;
  onImageRemove?: (imageUrl: string) => Promise<void> | void;
  currentVideo?: string;
  onVideoChange: (url: string) => void;
  entityType: string;
  entityId: string;
  imageLabel?: string;
  imageDescription?: string;
  videoLabel?: string;
  videoDescription?: string;
  exclusiveMedia?: boolean;
  cleanupOnRemove?: boolean;
  className?: string;
}

export const MediaUpload: React.FC<MediaUploadProps> = ({
  currentImage,
  onImageChange,
  onImageFileUpload,
  onImageRemove,
  currentVideo,
  onVideoChange,
  entityType,
  entityId,
  imageLabel,
  imageDescription,
  videoLabel,
  videoDescription,
  exclusiveMedia = false,
  cleanupOnRemove = false,
  className,
}) => {
  const [activeTab, setActiveTab] = React.useState(currentVideo ? 'video' : 'image');

  React.useEffect(() => {
    if (currentVideo && !currentImage) setActiveTab('video');
    if (currentImage && !currentVideo) setActiveTab('image');
  }, [currentImage, currentVideo]);

  const handleImageChange = (url: string) => {
    onImageChange(url);
    if (exclusiveMedia && url) {
      onVideoChange('');
    }
  };

  const handleVideoChange = (url: string) => {
    onVideoChange(url);
    if (exclusiveMedia && url) {
      onImageChange('');
    }
  };

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className={className}>
      <TabsList className="w-full">
        <TabsTrigger value="image" className="flex-1">
          {translateText('generated.inline.0521_image_50e19fda')}
        </TabsTrigger>
        <TabsTrigger value="video" className="flex-1">
          {translateText('generated.inline.0522_video_bc17c1f0')}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="image">
        <ImageUpload
          currentImage={currentImage}
          onImageChange={handleImageChange}
          onFileUpload={onImageFileUpload}
          onImageRemove={onImageRemove}
          cleanupOnRemove={cleanupOnRemove}
          entityType={entityType}
          entityId={entityId}
          label={imageLabel}
          description={imageDescription}
        />
      </TabsContent>
      <TabsContent value="video">
        <VideoUpload
          currentVideo={currentVideo}
          onVideoChange={handleVideoChange}
          label={videoLabel}
          description={videoDescription}
        />
      </TabsContent>
    </Tabs>
  );
};
