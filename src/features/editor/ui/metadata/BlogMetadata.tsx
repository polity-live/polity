'use client';

import { BadgeControl } from '@/features/shared/ui/status';
/**
 * Blog Metadata Component
 *
 * Displays blog-specific metadata including date, upvotes, visibility,
 * and bloggers list.
 */

import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { Globe, Lock, Users } from 'lucide-react';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';

interface Blogger {
  id: string;
  user?: {
    id: string;
    name?: string;
    avatar?: string;
  };
  status?: string;
}

interface BlogMetadataProps {
  /** Blog date */
  date?: string;
  /** Number of upvotes */
  upvotes?: number;
  /** Visibility level of the blog */
  visibility?: string;
  /** List of bloggers */
  bloggers?: Blogger[];
  /** Whether to show the bloggers list */
  showBloggers?: boolean;
}

export function BlogMetadata({
  date,
  upvotes,
  visibility,
  bloggers = [],
  showBloggers = true,
}: BlogMetadataProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      {/* Blog metadata badges */}
      <div className="flex flex-wrap items-center gap-4 text-sm">
        {visibility !== undefined && (
          <BadgeControl variant="outline" className="flex items-center gap-1">
            {visibility === 'public' ? (
              <>
                <Globe className="h-3 w-3" />
                {t('features.editor.metadata.public')}
              </>
            ) : visibility === 'authenticated' ? (
              <>
                <Users className="h-3 w-3" />
                {t('features.editor.metadata.authenticated')}
              </>
            ) : (
              <>
                <Lock className="h-3 w-3" />
                {t('features.editor.metadata.private')}
              </>
            )}
          </BadgeControl>
        )}
        {date && (
          <span className="text-muted-foreground">
            {t('features.editor.metadata.date')}: {date}
          </span>
        )}
        {upvotes !== undefined && (
          <span className="text-muted-foreground">
            {upvotes} {t('features.editor.metadata.upvotes')}
          </span>
        )}
      </div>

      {/* Bloggers list */}
      {showBloggers && bloggers.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-sm">
            {t('features.editor.metadata.bloggers')}:
          </span>
          {bloggers.map(blogger => (
            <div key={blogger.id} className="bg-muted flex items-center gap-1 rounded-md px-2 py-1">
              <Avatar className="h-5 w-5">
                {blogger.user?.avatar ? (
                  <AvatarImage src={blogger.user.avatar} alt={blogger.user.name || ''} />
                ) : null}
                <AvatarFallback className="text-xs">
                  {blogger.user?.name?.[0]?.toUpperCase() || '?'}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs">
                {blogger.user?.name || translateText('generated.inline.0031_unknown_bc7819b3')}
              </span>
              {blogger.status && blogger.status === 'owner' && (
                <BadgeControl variant="outline" size="tiny" className="ml-1 h-4 px-1">
                  {t('features.editor.metadata.owner')}
                </BadgeControl>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
