import { useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';

import { checkEntityAccess } from '@/features/auth/logic/checkEntityAccess';
import { useAuth } from '@/providers/auth-provider';
import { useSubscribeUser } from '@/features/payments/hooks/useSubscribeUser';
import { richTextToPlainText } from '@/features/shared/logic/richText';
import { formatLocation } from '@/features/shared/logic/locationHelpers';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useSubscriptionStatusByUser } from '@/zero/payments/usePaymentState';
import { useUserWikiContentSearch } from '../state/useUserWikiContentSearch';
import type { TabSearchState, UserProfile } from '../types/user.types';
import { useUserData } from './useUserData';

interface UserWikiPageOptions {
  userId?: string;
  searchFilters?: Partial<TabSearchState>;
}

interface UserWikiCopy {
  loading: string;
  error: string;
  notFoundTitle: string;
  notFoundDescription: string;
  freeSupportLabel: string;
  freeSupportDescription: string;
  message: string;
}

export type UserWikiPageState =
  | {
      status: 'loading';
      copy: UserWikiCopy;
    }
  | {
      status: 'not-found';
      copy: UserWikiCopy;
    }
  | {
      status: 'access-denied';
      copy: UserWikiCopy;
    }
  | {
      status: 'error';
      copy: UserWikiCopy;
      error: unknown;
    }
  | {
      status: 'ready';
      copy: UserWikiCopy;
      user: UserProfile;
      userId: string;
      isOwnUser: boolean;
      isAuthenticated: boolean;
      fullName: string;
      bioText?: string;
      aboutText?: string;
      supportTier: {
        label: string;
        description: string;
      };
      subscriberCount: number;
      groupCount: number;
      amendmentCount: number;
      subscribed: boolean;
      subscribeLoading: boolean;
      hashtags: { id: string; tag: string }[];
      userLocation?: string;
      shareDescription?: string;
      shareContextItem: unknown;
      searchTerms: TabSearchState;
      onSearchChange: (tab: keyof TabSearchState, value: string) => void;
      onToggleSubscribe: () => void | Promise<void>;
      onMessage: () => void;
    };

function buildCopy(t: ReturnType<typeof useTranslation>['t']): UserWikiCopy {
  return {
    loading: t('common.loading.pageSkeleton.profile'),
    error: t('generated.inline.1228_error_loading_user_e23bf06c'),
    notFoundTitle: t('generated.inline.1229_user_not_found_9acd6234'),
    notFoundDescription: t('generated.inline.1230_this_user_hasn_t_been_created_yet_b3697b01'),
    freeSupportLabel: t('pages.user.profile.supportBadge.free.label'),
    freeSupportDescription: t('pages.user.profile.supportBadge.free.description'),
    message: t('features.timeline.cards.message'),
  };
}

export function useUserWikiPage({ userId }: UserWikiPageOptions): UserWikiPageState {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const copy = buildCopy(t);
  const { searchTerms, handleSearchChange } = useUserWikiContentSearch();
  const { user: authUser } = useAuth();
  const userIdToFetch = userId || authUser?.id;
  const { user, isLoading, error } = useUserData(userIdToFetch);
  const { subscriptionStatus } = useSubscriptionStatusByUser(userIdToFetch);
  const {
    isSubscribed: subscribed,
    subscriberCount,
    toggleSubscribe,
    isLoading: subscribeLoading,
  } = useSubscribeUser(userIdToFetch);

  const isOwnUser = authUser?.id === userIdToFetch;
  const fullName = useMemo(
    () => [user?.first_name, user?.last_name].filter(Boolean).join(' '),
    [user?.first_name, user?.last_name]
  );
  const hashtags = useMemo(
    () =>
      (user?.user_hashtags ?? []).flatMap(join =>
        join.hashtag?.id && join.hashtag.tag ? [{ id: join.hashtag.id, tag: join.hashtag.tag }] : []
      ),
    [user?.user_hashtags]
  );
  const supportTier = useMemo(() => {
    const activeSubscription = subscriptionStatus?.subscriptions?.find(
      subscription => subscription.status === 'active'
    );

    if (!activeSubscription?.amount) {
      return {
        label: copy.freeSupportLabel,
        description: copy.freeSupportDescription,
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
  }, [copy.freeSupportDescription, copy.freeSupportLabel, subscriptionStatus?.subscriptions, t]);

  if (isLoading) {
    return { status: 'loading', copy };
  }

  if (error) {
    return { status: 'error', copy, error };
  }

  if (!user || !userIdToFetch) {
    return { status: 'not-found', copy };
  }

  if (!checkEntityAccess(user.visibility, Boolean(authUser), isOwnUser)) {
    return { status: 'access-denied', copy };
  }

  const userLocation = formatLocation(user) || undefined;
  const bioText = richTextToPlainText(user.bio) || undefined;
  const aboutText = richTextToPlainText(user.about) || undefined;
  const shareDescription = bioText || aboutText;
  const resolvedFullName = fullName || 'User';
  const resolvedAmendmentCount = user.amendment_count;

  return {
    status: 'ready',
    copy,
    user,
    userId: userIdToFetch,
    isOwnUser,
    isAuthenticated: Boolean(authUser),
    fullName: resolvedFullName,
    bioText,
    aboutText,
    supportTier,
    subscriberCount,
    groupCount: user.group_count,
    amendmentCount: resolvedAmendmentCount,
    subscribed,
    subscribeLoading,
    hashtags,
    userLocation,
    shareDescription,
    shareContextItem: {
      id: userIdToFetch,
      type: 'user',
      title: resolvedFullName,
      description: shareDescription,
      createdAt: new Date(),
      authorId: userIdToFetch,
      authorName: resolvedFullName,
      authorAvatar: user.avatar ?? undefined,
      handle: user.handle ?? undefined,
      location: userLocation,
      groupCount: user.group_count,
      amendmentCount: resolvedAmendmentCount,
      tags: hashtags.map(hashtag => hashtag.tag),
    },
    searchTerms,
    onSearchChange: handleSearchChange,
    onToggleSubscribe: toggleSubscribe,
    onMessage: () =>
      navigate({
        to: '/messages',
        search: { userId: user.id },
      }),
  };
}
