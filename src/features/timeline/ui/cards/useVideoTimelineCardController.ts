'use client';

import { useState } from 'react';
import { useTranslation } from '@/features/shared/hooks/use-translation';

export interface VideoTimelineCardProps {
  video: {
    id: string;
    title: string;
    thumbnailUrl?: string;
    duration?: number; // in seconds
    views?: number;
    likes?: number;
    authorName?: string;
    authorAvatar?: string;
    sourceType?: 'amendment' | 'user' | 'group' | 'event' | 'blog';
    sourceName?: string;
    sourceId?: string;
    videoUrl?: string;
    amendmentId?: string;
    isLiked?: boolean;
  };
  onPlay?: () => void;
  onLike?: () => void;
  onShare?: () => void;
  className?: string;
}
export function useVideoTimelineCardController({
  video,
  onPlay,
  className,
}: VideoTimelineCardProps) {
  const { t } = useTranslation();

  const [playerOpen, setPlayerOpen] = useState(false);

  const sourceHref =
    video.sourceType && video.sourceId ? `/${video.sourceType}/${video.sourceId}` : undefined;

  const amendmentHref = video.amendmentId
    ? `/amendment/${video.amendmentId}`
    : video.sourceType === 'amendment' && video.sourceId
      ? `/amendment/${video.sourceId}`
      : sourceHref;

  return {
    video,
    onPlay,
    className,
    t,
    playerOpen,
    setPlayerOpen,
    sourceHref,
    amendmentHref,
  };
}
