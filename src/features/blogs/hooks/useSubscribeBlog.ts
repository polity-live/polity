import { useState, useEffect, useRef } from 'react';
import { useBlogState } from '@/zero/blogs/useBlogState';
import { useBlogActions } from '@/zero/blogs/useBlogActions';
import { useAuth } from '@/providers/auth-provider';
import { toast } from '@/features/shared/ui/ui/sonner';
import { waitForClientApply } from '@/zero/mutate-with-server-check';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import type {
  ProjectedSubscriptionState,
  SubscriptionRowState,
} from '@/features/search/types/projected-card-state';

/**
 * Hook to handle blog subscription functionality
 * @param targetBlogId - The ID of the blog to subscribe/unsubscribe
 */
export function useSubscribeBlog(
  targetBlogId?: string,
  projectedState?: ProjectedSubscriptionState
) {
  const { user: authUser } = useAuth();
  const { subscribers, subscriberCount: persistedSubscriberCount } = useBlogState({
    blogId: projectedState ? undefined : targetBlogId,
    includeSubscribers: !projectedState,
  });
  const { subscribeToBlog, unsubscribeFromBlog } = useBlogActions();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscriberCount, setSubscriberCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const optimisticTargetRef = useRef<boolean | null>(null);
  const createdSubscriptionIdRef = useRef<string | null>(null);

  const subscriptionData = {
    subscribers: (projectedState
      ? projectedState.subscriptions
      : (subscribers ?? [])) as readonly SubscriptionRowState[],
  };
  const resolvedPersistedSubscriberCount =
    projectedState?.subscriberCount ?? persistedSubscriberCount;
  const subscriptionLoading = projectedState?.isLoading ?? false;

  // Update subscription state when data changes
  useEffect(() => {
    const subs = subscriptionData?.subscribers || [];

    // Check if the current user is subscribed
    const subscribed = authUser?.id
      ? subs.some(
          sub => sub.subscriber_id === authUser.id || sub.subscriber_user?.id === authUser.id
        )
      : false;

    if (optimisticTargetRef.current !== null) {
      // Only clear optimistic state once DB data matches expected state
      if (subscribed === optimisticTargetRef.current) {
        optimisticTargetRef.current = null;
        createdSubscriptionIdRef.current = null;
        setSubscriberCount(resolvedPersistedSubscriberCount);
      }
      return;
    }

    setIsSubscribed(subscribed);
    setSubscriberCount(resolvedPersistedSubscriberCount);
  }, [subscriptionData, authUser?.id, subscriptionLoading, resolvedPersistedSubscriberCount]);

  // Subscribe to a blog
  const subscribe = async () => {
    if (!authUser?.id || !targetBlogId) {
      return;
    }

    // Prevent duplicate subscriptions
    const existing = (subscriptionData?.subscribers || []).find(
      sub => sub.subscriber_id === authUser.id || sub.subscriber_user?.id === authUser.id
    );
    if (existing) return;

    // Optimistic update
    optimisticTargetRef.current = true;
    setIsSubscribed(true);
    setSubscriberCount(prev => prev + 1);
    setIsLoading(true);
    try {
      const subscriptionId = crypto.randomUUID();
      createdSubscriptionIdRef.current = subscriptionId;

      await waitForClientApply(
        subscribeToBlog({
          id: subscriptionId,
          user_id: null,
          group_id: null,
          amendment_id: null,
          event_id: null,
          blog_id: targetBlogId,
        })
      );
      toast.success(
        translateText('generated.inline.0223_successfully_subscribed_to_blog_4377e4d5')
      );
    } catch (error) {
      // Revert optimistic update
      optimisticTargetRef.current = null;
      createdSubscriptionIdRef.current = null;
      setIsSubscribed(false);
      setSubscriberCount(prev => prev - 1);
      console.error('Failed to subscribe to blog:', error);
      toast.error(
        translateText('generated.inline.0224_failed_to_subscribe_to_blog_please_try_again_8f89bbc2')
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Unsubscribe from a blog
  const unsubscribe = async () => {
    if (!authUser?.id || !targetBlogId) {
      return;
    }

    const subs = subscriptionData?.subscribers || [];
    let subsToDelete = subs.filter(
      sub => sub.subscriber_id === authUser.id || sub.subscriber_user?.id === authUser.id
    );

    // Fallback: if reactive query hasn't caught up, use stored subscription ID
    if (subsToDelete.length === 0 && createdSubscriptionIdRef.current) {
      subsToDelete = [{ id: createdSubscriptionIdRef.current } as (typeof subs)[0]];
    }

    if (subsToDelete.length === 0) {
      return;
    }

    // Optimistic update
    optimisticTargetRef.current = false;
    setIsSubscribed(false);
    setSubscriberCount(prev => Math.max(0, prev - subsToDelete.length));
    setIsLoading(true);
    try {
      await Promise.all(subsToDelete.map(sub => waitForClientApply(unsubscribeFromBlog(sub.id))));
      createdSubscriptionIdRef.current = null;
      toast.success(
        translateText('generated.inline.0225_successfully_unsubscribed_from_blog_6bcfcb00')
      );
    } catch (error) {
      // Revert optimistic update
      optimisticTargetRef.current = null;
      setIsSubscribed(true);
      setSubscriberCount(prev => prev + subsToDelete.length);
      console.error('Failed to unsubscribe from blog:', error);
      toast.error(
        translateText(
          'generated.inline.0226_failed_to_unsubscribe_from_blog_please_try_ag_13af4c37'
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle subscribe/unsubscribe
  const toggleSubscribe = async () => {
    if (isLoading) return;
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

  return {
    isSubscribed,
    subscriberCount,
    isLoading,
    subscribe,
    unsubscribe,
    toggleSubscribe,
    canSubscribe: !!authUser?.id && !!targetBlogId,
  };
}
