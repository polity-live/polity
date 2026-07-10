import '@/styles/animations.css';

import { CircleHelp, Mail } from 'lucide-react';

import { AccessDenied } from '@/features/auth/ui/AccessDenied';
import { SubscribeButton } from '@/features/shared/ui/action-buttons';
import { ShareButton } from '@/features/shared/ui/action-buttons/ShareButton.tsx';
import { EmptyState, ErrorState, ProfilePageSkeleton } from '@/features/shared/ui/feedback';
import { ActionBar, StatsBar } from '@/features/shared/ui/layout';
import { BadgeControl } from '@/features/shared/ui/status';
import { HashtagDisplay } from '@/features/shared/ui/hashtags';
import { Button } from '@/features/shared/ui/ui/button';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/features/shared/ui/ui/hover-card';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { InfoTabs } from '@/features/shared/ui/wiki/InfoTabs.tsx';
import type { UserWikiPageState } from '../hooks/useUserWikiPage';
import { SocialBar } from './SocialBar';
import { UserWikiContentTabs } from './UserWikiContentTabs';

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

  return (
    <div>
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold">
          <span className="inline-flex items-center gap-3">
            <span>{page.fullName}</span>
            <span className="bg-background/80 inline-flex items-center gap-1 rounded-full border px-2 py-1 shadow-sm">
              <BadgeControl
                variant="secondary"
                className="rounded-full px-3 py-1 text-xs font-medium"
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
                    className="text-muted-foreground hover:text-foreground h-7 w-7 rounded-full"
                  >
                    <CircleHelp className="h-4 w-4" />
                  </Button>
                </HoverCardTrigger>
                <HoverCardContent side="bottom" className="w-64 p-3 text-sm">
                  <p>{page.supportTier.description}</p>
                </HoverCardContent>
              </HoverCard>
            </span>
          </span>
        </h1>
        {page.bioText ? <p className="text-muted-foreground">{page.bioText}</p> : null}
      </div>

      {user.avatar ? (
        <div className="mb-8">
          <img
            src={user.avatar}
            alt={page.fullName}
            className="mx-auto h-64 w-full max-w-4xl rounded-lg object-cover shadow-lg"
          />
        </div>
      ) : null}

      <StatsBar
        items={[
          {
            value: page.subscriberCount,
            label: translateText('components.labels.subscribers'),
          },
          { value: page.groupCount, label: translateText('components.labels.groups') },
          { value: page.amendmentCount, label: translateText('components.labels.amendments') },
        ]}
      />

      <ActionBar>
        {!page.isOwnUser && page.isAuthenticated ? (
          <>
            <SubscribeButton
              entityType="user"
              entityId={page.userId}
              isSubscribed={page.subscribed}
              onToggleSubscribe={page.onToggleSubscribe}
              isLoading={page.subscribeLoading}
            />
            <Button variant="outline" onClick={page.onMessage}>
              <Mail className="h-4 w-4" />
              <span>{page.copy.message}</span>
            </Button>
          </>
        ) : null}
        <ShareButton
          url={`/user/${page.userId}`}
          title={page.fullName}
          description={page.aboutText}
          shareContextItem={page.shareContextItem}
        />
      </ActionBar>

      {page.hashtags.length > 0 ? (
        <div className="mb-6">
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
        authorAvatar={user.avatar ?? ''}
        searchTerms={page.searchTerms}
        handleSearchChange={page.onSearchChange}
      />
    </div>
  );
}
