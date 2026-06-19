'use client';

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
    sourceType?: 'amendment' | 'user' | 'group' | 'event' | 'blog' | 'statement';
    sourceName?: string;
    sourceId?: string;
    videoUrl?: string;
    amendmentId?: string;
    isLiked?: boolean;
  };
  onPlay?: () => void;
  onLike?: () => void;
  onShare?: () => void;
  href?: string;
  className?: string;
}
import { useVideoTimelineCardController } from './useVideoTimelineCardController';
import { VideoTimelineCardView } from './VideoTimelineCardView';

export function VideoTimelineCard({ video, onPlay, href, className }: VideoTimelineCardProps) {
  const viewProps = useVideoTimelineCardController({ video, onPlay, href, className });

  return <VideoTimelineCardView {...viewProps} />;
}
