import '@/styles/animations.css';
import { SocialBar } from '@/features/users/ui/SocialBar';
import { useNavigate } from '@tanstack/react-router';
import { CircleHelp, Mail } from 'lucide-react';
import { Button } from '@/features/shared/ui/ui/button';
import { useUserWikiContentSearch } from './state/useUserWikiContentSearch';
import { InfoTabs } from '@/features/shared/ui/wiki/InfoTabs.tsx';
import { StatementCarousel } from '@/features/users/ui/StatementCarousel';
import { UserWikiContentTabs } from '@/features/users/ui/UserWikiContentTabs';
import { useUserData } from './hooks/useUserData';
import { useSubscribeUser } from '@/features/payments/hooks/useSubscribeUser';
import { useAuth } from '@/providers/auth-provider';
import { HashtagDisplay } from '@/features/shared/ui/ui/hashtag-display';
import { StatsBar } from '@/features/shared/ui/ui/StatsBar';
import { ActionBar } from '@/features/shared/ui/ui/ActionBar';
import { SubscribeButton } from '@/features/shared/ui/action-buttons';
import { ShareButton } from '@/features/shared/ui/action-buttons/ShareButton.tsx';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useMemo } from 'react';
import { checkEntityAccess } from '@/features/auth/logic/checkEntityAccess';
import { AccessDenied } from '@/features/auth/ui/AccessDenied';
import { formatLocation } from '@/features/shared/logic/locationHelpers';
import { Badge } from '@/features/shared/ui/ui/badge';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/features/shared/ui/ui/hover-card';
import { useSubscriptionStatusByUser } from '@/zero/payments/usePaymentState';

interface UserWikiProps {
  userId?: string;
  searchFilters?: {
    blogs?: string;
    groups?: string;
    amendments?: string;
  };
}

export function UserWiki(_props: UserWikiProps) {
  // Props available: _props.userId, _props.searchFilters
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Content search state and handler
  const { searchTerms, handleSearchChange } = useUserWikiContentSearch();

  // Get the current logged-in user if no userId is provided
  const { user: authUser } = useAuth();
  const userIdToFetch = _props.userId || authUser?.id;

  // Fetch user data from Zero
  const { user: dbUser, isLoading, error } = useUserData(userIdToFetch);
  const { subscriptionStatus } = useSubscriptionStatusByUser(userIdToFetch);

  // Subscribe/unsubscribe functionality
  const {
    isSubscribed: subscribed,
    subscriberCount,
    toggleSubscribe,
    isLoading: subscribeLoading,
  } = useSubscribeUser(userIdToFetch);

  const isOwnUser = authUser?.id === userIdToFetch;

  // Derived values from zero row
  const fullName = useMemo(
    () => [dbUser?.first_name, dbUser?.last_name].filter(Boolean).join(' '),
    [dbUser?.first_name, dbUser?.last_name]
  );

  const hashtags = useMemo(
    () =>
      (dbUser?.user_hashtags ?? [])
        .map(j => j.hashtag)
        .filter((h): h is NonNullable<typeof h> => !!h?.id && !!h?.tag),
    [dbUser?.user_hashtags]
  );

  const collabCount = useMemo(
    () =>
      (dbUser?.amendment_collaborations ?? []).filter(
        c => c.status === 'admin' || c.status === 'collaborator'
      ).length,
    [dbUser?.amendment_collaborations]
  );

  const supportTier = useMemo(() => {
    const activeSubscription = subscriptionStatus?.subscriptions?.find(
      subscription => subscription.status === 'active'
    );

    if (!activeSubscription?.amount) {
      return {
        label: t('pages.user.profile.supportBadge.free.label'),
        description: t('pages.user.profile.supportBadge.free.description'),
      };
    }

    if (activeSubscription.amount === 200) {
      return {
        label: t('pages.user.profile.supportBadge.runningCosts.label'),
        description: t('pages.user.profile.supportBadge.runningCosts.description'),
      };
    }

    if (activeSubscription.amount === 1000) {
      return {
        label: t('pages.user.profile.supportBadge.development.label'),
        description: t('pages.user.profile.supportBadge.development.description'),
      };
    }

    return {
      label: t('pages.user.profile.supportBadge.yourChoice.label'),
      description: t('pages.user.profile.supportBadge.yourChoice.description'),
    };
  }, [subscriptionStatus?.subscriptions, t]);

  // Visibility access check: own profile always accessible
  const canAccess = checkEntityAccess(dbUser?.visibility, !!authUser, isOwnUser);
  const userLocation = formatLocation(dbUser);

  if (dbUser && !canAccess) {
    return <AccessDenied />;
  }

  return (
    <>
      {isLoading && (
        <div>
          <div className="flex items-center justify-center py-12">
            <div className="text-muted-foreground text-lg">Loading user...</div>
          </div>
        </div>
      )}

      {error && (
        <div>
          <div className="flex items-center justify-center py-12">
            <div className="text-lg text-red-500">Error loading user: {error}</div>
          </div>
        </div>
      )}

      {!isLoading && !error && !dbUser && (
        <div>
          <div className="flex flex-col items-center justify-center py-12">
            <div className="text-center">
              <h2 className="mb-2 text-2xl font-semibold">User Not Found</h2>
              <p className="text-muted-foreground">This user hasn't been created yet.</p>
            </div>
          </div>
        </div>
      )}

      {!isLoading && !error && dbUser && (
        <div>
          {/* Header with centered title and subtitle */}
          <div className="mb-8 text-center">
            <h1 className="text-4xl font-bold">
              <span className="inline-flex items-center gap-3">
                <span>{fullName}</span>
                <span className="bg-background/80 inline-flex items-center gap-1 rounded-full border px-2 py-1 shadow-sm">
                  <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-medium">
                    {supportTier.label}
                  </Badge>
                  <HoverCard openDelay={150}>
                    <HoverCardTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={supportTier.description}
                        className="text-muted-foreground hover:text-foreground h-7 w-7 rounded-full"
                      >
                        <CircleHelp className="h-4 w-4" />
                      </Button>
                    </HoverCardTrigger>
                    <HoverCardContent side="bottom" className="w-64 p-3 text-sm">
                      <p>{supportTier.description}</p>
                    </HoverCardContent>
                  </HoverCard>
                </span>
              </span>
            </h1>
            {dbUser.bio && <p className="text-muted-foreground">{dbUser.bio}</p>}
          </div>

          {/* User Image */}
          {dbUser.avatar && (
            <div className="mb-8">
              <img
                src={dbUser.avatar}
                alt={fullName}
                className="mx-auto h-64 w-full max-w-4xl rounded-lg object-cover shadow-lg"
              />
            </div>
          )}

          {/* Stats Bar */}
          <StatsBar
            stats={[
              { value: subscriberCount, labelKey: 'components.labels.subscribers' },
              {
                value: dbUser.group_count ?? dbUser.group_memberships?.length ?? 0,
                labelKey: 'components.labels.groups',
              },
              {
                value: dbUser.amendment_count ?? collabCount,
                labelKey: 'components.labels.amendments',
              },
            ]}
          />

          {/* Action Bar */}
          <ActionBar>
            {!isOwnUser && authUser && (
              <>
                <SubscribeButton
                  entityType="user"
                  entityId={userIdToFetch || ''}
                  isSubscribed={subscribed}
                  onToggleSubscribe={toggleSubscribe}
                  isLoading={subscribeLoading}
                />
                <Button
                  variant="outline"
                  onClick={() =>
                    navigate({
                      to: `/messages?userId=${encodeURIComponent(dbUser.id || '')}&name=${encodeURIComponent(fullName || '')}`,
                    })
                  }
                >
                  <Mail className="h-4 w-4" />
                  <span>{t('features.timeline.cards.message')}</span>
                </Button>
              </>
            )}
            <ShareButton
              url={`/user/${userIdToFetch}`}
              title={fullName || 'User'}
              description={dbUser.about || ''}
              shareContextItem={{
                id: userIdToFetch || '',
                type: 'user',
                title: fullName || 'User',
                description: dbUser.bio ?? dbUser.about ?? undefined,
                createdAt: new Date(),
                authorId: userIdToFetch || undefined,
                authorName: fullName || 'User',
                authorAvatar: dbUser.avatar ?? undefined,
                handle: dbUser.handle ?? undefined,
                location: userLocation ?? undefined,
                groupCount: dbUser.group_count ?? dbUser.group_memberships?.length ?? undefined,
                amendmentCount: collabCount,
                tags: hashtags.map(hashtag => hashtag.tag),
              }}
            />
          </ActionBar>

          {/* Hashtags */}
          {hashtags.length > 0 && (
            <div className="mb-6">
              <HashtagDisplay hashtags={hashtags} centered />
            </div>
          )}

          <SocialBar
            socialMedia={{
              website: dbUser.website ?? undefined,
              youtube: dbUser.youtube ?? undefined,
              linkedin: dbUser.linkedin ?? undefined,
              whatsapp: dbUser.whatsapp ?? undefined,
              instagram: dbUser.instagram ?? undefined,
              twitter: dbUser.twitter ?? dbUser.x ?? undefined,
              facebook: dbUser.facebook ?? undefined,
              snapchat: dbUser.snapchat ?? undefined,
              tiktok: dbUser.tiktok ?? undefined,
            }}
          />

          <InfoTabs
            about={dbUser.about ?? undefined}
            contact={{
              email: dbUser.email || '',
              website: dbUser.website || '',
              youtube: dbUser.youtube || '',
              linkedin: dbUser.linkedin || '',
              whatsapp: dbUser.whatsapp || '',
              instagram: dbUser.instagram || '',
              twitter: dbUser.twitter || dbUser.x || '',
              facebook: dbUser.facebook || '',
              snapchat: dbUser.snapchat || '',
              tiktok: dbUser.tiktok || '',
              country: dbUser.country || '',
              region: dbUser.region || '',
              post_code: dbUser.post_code || '',
              city: dbUser.city || '',
              street: dbUser.street || '',
              house_number: dbUser.house_number || '',
              latitude: dbUser.latitude ?? null,
              longitude: dbUser.longitude ?? null,
              location: userLocation || undefined,
            }}
            className="mb-12"
          />

          <StatementCarousel
            statements={dbUser.statements ?? []}
            authorName={fullName || t('common.labels.unspecifiedUser')}
            authorTitle={dbUser.bio ?? undefined}
            authorAvatar={dbUser.avatar ?? undefined}
          />

          <UserWikiContentTabs
            user={dbUser}
            authorName={fullName}
            authorAvatar={dbUser.avatar ?? ''}
            searchTerms={searchTerms}
            handleSearchChange={handleSearchChange}
          />
        </div>
      )}
    </>
  );
}
