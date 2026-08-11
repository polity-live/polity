import '@/styles/animations.css';

import { CircleHelp, Mail } from 'lucide-react';

import { AccessDenied } from '@/features/auth/ui/AccessDenied';
import { SubscribeButton } from '@/features/shared/ui/action-buttons';
import { ShareButton } from '@/features/shared/ui/action-buttons/ShareButton.tsx';
import { EmptyState, ErrorState, ProfilePageSkeleton } from '@/features/shared/ui/feedback';
import {
  isAssistantUser,
  resolveAssistantAvatar,
} from '@/features/assistant/logic/assistantHelpers';
import {
  ActionBar,
  ResponsiveActionLabel,
  StatsBar,
  compactActionButtonClassName,
} from '@/features/shared/ui/layout';
import { BadgeControl } from '@/features/shared/ui/status';
import { HashtagDisplay } from '@/features/shared/ui/hashtags';
import { Button } from '@/features/shared/ui/ui/button';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/features/shared/ui/ui/hover-card';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { InfoTabs } from '@/features/shared/ui/wiki/InfoTabs.tsx';
import { EntityWikiMedia } from '@/features/shared/ui/wiki';
import type { UserWikiPageState } from '../hooks/useUserWikiPage';
import { SocialBar } from './SocialBar';
import { UserWikiContentTabs } from './UserWikiContentTabs';
import { WikiAvatar } from './WikiAvatar';

interface UserWikiViewProps {
  page: UserWikiPageState;
}

export function UserWikiView({ page }: UserWikiViewProps) {
  if (page.status === 'loading') {
    return <ProfilePageSkeleton label={page.copy.loading} />;
  }

  if (page.status === 'error') {
    return <ErrorState title={page.copy.error} description={String(page.error)} />;
  }

  if (page.status === 'not-found') {
    return (
      <EmptyState title={page.copy.notFoundTitle} description={page.copy.notFoundDescription} />
    );
  }

  if (page.status === 'access-denied') {
    return <AccessDenied />;
  }

  const user = page.user;
  const isAriaKaiProfile = isAssistantUser(user.id);
  const resolvedAvatar = resolveAssistantAvatar(user.id, user.avatar);

  return (
    <div>
      <div className="mb-8 text-center">
        {isAriaKaiProfile ? (
          <WikiAvatar
            name={page.fullName}
            avatar={resolvedAvatar as string}
            className="mx-auto mb-4 h-24 w-24 md:h-32 md:w-32"
          />
        ) : null}
        <div className="mb-2 flex min-w-0 flex-col items-center justify-center gap-2 md:flex-row md:gap-3">
          <h1 className="max-w-full min-w-0 text-4xl font-bold break-words">{page.fullName}</h1>
          <div className="bg-background/80 inline-flex max-w-full min-w-0 items-center gap-1 rounded-md border px-2 py-1 shadow-sm">
            <BadgeControl
              variant="secondary"
              className="max-w-full min-w-0 rounded-md px-3 py-1 text-xs font-medium break-words whitespace-normal"
            >
              {page.supportTier.label}
            </BadgeControl>
            <HoverCard openDelay={150}>
              <HoverCardTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={page.supportTier.description}
                  data-action-id="users.wiki.support-tier.help"
                  className="text-muted-foreground hover:text-foreground h-7 w-7 shrink-0 rounded-md"
                >
                  <CircleHelp className="h-4 w-4" />
                </Button>
              </HoverCardTrigger>
              <HoverCardContent side="bottom" className="w-64 p-3 text-sm">
                <p>{page.supportTier.description}</p>
              </HoverCardContent>
            </HoverCard>
          </div>
        </div>
        {page.hashtags.length > 0 ? (
          <div className="mt-3 md:hidden">
            <HashtagDisplay
              hashtags={page.hashtags}
              centered
              badgeClassName="max-w-full whitespace-normal break-all text-center"
            />
          </div>
        ) : null}
        {page.bioText ? <p className="text-muted-foreground">{page.bioText}</p> : null}
      </div>

      <EntityWikiMedia
        imageUrl={isAriaKaiProfile ? null : user.avatar}
        videoUrl={user.video_url}
        alt={page.fullName}
      />

      <StatsBar
        items={[
          {
            value: page.subscriberCount,
            label: translateText('components.labels.subscribers', {
              count: page.subscriberCount,
            }),
          },
          {
            value: page.groupCount,
            label: translateText('components.labels.groups', { count: page.groupCount }),
          },
          {
            value: page.amendmentCount,
            label: translateText('components.labels.amendments', {
              count: page.amendmentCount,
            }),
          },
        ]}
      />

      <ActionBar>
        {!page.isOwnUser && page.isAuthenticated ? (
          <>
            <SubscribeButton
              data-action-id="users.wiki.subscribe"
              entityType="user"
              entityId={page.userId}
              isSubscribed={page.subscribed}
              onToggleSubscribe={page.onToggleSubscribe}
              isLoading={page.subscribeLoading}
              compactOnMobile
            />
            <Button
              variant="outline"
              onClick={page.onMessage}
              className={compactActionButtonClassName}
              aria-label={page.copy.message}
              data-action-id="users.wiki.message"
            >
              <Mail className="h-4 w-4" />
              <ResponsiveActionLabel full={page.copy.message} compact={page.copy.message} />
            </Button>
          </>
        ) : null}
        <ShareButton
          data-action-id="users.wiki.share"
          url={`/user/${page.userId}`}
          title={page.fullName}
          description={page.aboutText}
          shareContextItem={page.shareContextItem}
          compactOnMobile
        />
      </ActionBar>

      {page.hashtags.length > 0 ? (
        <div className="mb-6 hidden md:block">
          <HashtagDisplay hashtags={page.hashtags} centered />
        </div>
      ) : null}

      <SocialBar
        socialMedia={{
          website: user.website ?? undefined,
          youtube: user.youtube ?? undefined,
          linkedin: user.linkedin ?? undefined,
          whatsapp: user.whatsapp ?? undefined,
          instagram: user.instagram ?? undefined,
          twitter: user.twitter ?? user.x ?? undefined,
          facebook: user.facebook ?? undefined,
          snapchat: user.snapchat ?? undefined,
          tiktok: user.tiktok ?? undefined,
        }}
      />

      <InfoTabs
        about={user.about ?? undefined}
        contact={{
          email: user.email || '',
          website: user.website || '',
          youtube: user.youtube || '',
          linkedin: user.linkedin || '',
          whatsapp: user.whatsapp || '',
          instagram: user.instagram || '',
          twitter: user.twitter || user.x || '',
          facebook: user.facebook || '',
          snapchat: user.snapchat || '',
          tiktok: user.tiktok || '',
          country: user.country || '',
          region: user.region || '',
          post_code: user.post_code || '',
          city: user.city || '',
          street: user.street || '',
          house_number: user.house_number || '',
          latitude: user.latitude ?? null,
          longitude: user.longitude ?? null,
          location_kind: user.location_kind ?? null,
          location_place_id: user.location_place_id ?? null,
          location_boundary_source: user.location_boundary_source ?? null,
          location_geometry: user.location_geometry ?? null,
          location_bounds: user.location_bounds ?? null,
          location: page.userLocation,
        }}
        className="mb-12"
      />

      <UserWikiContentTabs
        user={user}
        authorName={page.fullName}
        authorAvatar={resolvedAvatar ?? ''}
        searchTerms={page.searchTerms}
        handleSearchChange={page.onSearchChange}
      />
    </div>
  );
}
