import { getEntityToneClasses, getSemanticToneClasses } from '@/features/shared/theme';
import { Link } from '@tanstack/react-router';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { ShareButton } from '@/features/shared/ui/action-buttons/ShareButton';
import { ThumbsUp, MessageSquare, User, Users, Video, BarChart3 } from 'lucide-react';
import type { SearchContentItem } from '../types/search.types';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { cn } from '@/features/shared/utils/utils';

interface StatementSearchCardProps {
  item: SearchContentItem;
}

export function StatementSearchCard({ item }: StatementSearchCardProps) {
  const hasMedia = !!(item.imageUrl || item.videoUrl);
  const surveyOptions = item.surveyOptions ?? [];
  const hasSurvey = !!(item.surveyQuestion && surveyOptions.length);
  const score = (item.upvotes ?? 0) - (item.downvotes ?? 0);
  const userTone = getEntityToneClasses('user');
  const groupTone = getEntityToneClasses('group');
  const scoreTone =
    score >= 0 ? getSemanticToneClasses('success') : getSemanticToneClasses('danger');

  return (
    <Link
      to="/statement/$id"
      params={{ id: item.id }}
      className="bg-card hover:bg-accent/50 block rounded-lg border transition-colors"
    >
      <div className="flex gap-3 p-3">
        {/* Compact media thumbnail */}
        {hasMedia && (
          <div className="bg-muted relative h-16 w-16 shrink-0 overflow-hidden rounded-md">
            {item.imageUrl ? (
              <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Video className="text-muted-foreground h-5 w-5" />
              </div>
            )}
          </div>
        )}

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Survey question or text preview */}
          {hasSurvey ? (
            <div className="mb-1">
              <div className="text-muted-foreground mb-0.5 flex items-center gap-1 text-xs">
                <BarChart3 className="h-3 w-3" />
                <span>{translateText('generated.inline.1108_poll_dafe1d3d')}</span>
              </div>
              <p className="line-clamp-1 text-sm leading-snug font-medium">{item.surveyQuestion}</p>
              <div className="mt-0.5 flex flex-wrap gap-1">
                {surveyOptions.slice(0, 4).map((opt, i) => (
                  <span
                    key={i}
                    className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px]"
                  >
                    {opt.label}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="line-clamp-2 text-sm leading-snug">
              {item.title ? item.title.substring(0, 100) : ''}
            </p>
          )}

          {/* Bottom row: creator, group, stats */}
          <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-2 text-xs">
            {/* Creator */}
            <div className="flex min-w-0 items-center gap-1">
              <Avatar className="h-4 w-4 shrink-0">
                <AvatarImage src={item.authorAvatar ?? undefined} />
                <AvatarFallback className={cn(userTone.badge)}>
                  <User className="h-2.5 w-2.5" />
                </AvatarFallback>
              </Avatar>
              <span className="truncate">
                {item.authorName || translateText('generated.inline.0031_unknown_bc7819b3')}
              </span>
            </div>

            {/* Group */}
            {item.groupName && (
              <>
                <span>·</span>
                <div className="flex min-w-0 items-center gap-1">
                  {item.groupImageUrl ? (
                    <Avatar className="h-4 w-4 shrink-0">
                      <AvatarImage src={item.groupImageUrl} />
                      <AvatarFallback className={cn(groupTone.badge)}>
                        <Users className="h-2.5 w-2.5" />
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <Users className="h-3 w-3 shrink-0" />
                  )}
                  <span className="truncate">{item.groupName}</span>
                </div>
              </>
            )}

            <span className="ml-auto" />

            {/* Score */}
            <div className={cn('flex shrink-0 items-center gap-0.5', scoreTone.text)}>
              <ThumbsUp className="h-3 w-3" />
              <span>{score >= 0 ? `+${score}` : score}</span>
            </div>

            {/* Comments */}
            <div className="flex shrink-0 items-center gap-0.5">
              <MessageSquare className="h-3 w-3" />
              <span>{item.commentCount ?? item.stats?.comments ?? 0}</span>
            </div>

            {/* Share */}
            <div onClick={e => e.preventDefault()}>
              <ShareButton
                url={`${typeof window !== 'undefined' ? window.location.origin : ''}/statement/${item.id}`}
                title={item.title?.substring(0, 60) ?? ''}
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0"
              />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
