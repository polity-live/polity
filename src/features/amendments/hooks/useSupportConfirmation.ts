/**
 * useSupportConfirmation Hook
 *
 * Manages support confirmations for groups when change requests are accepted
 * on amendments they support.
 */

import { useState, useMemo, useCallback } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { toast } from '@/features/shared/ui/ui/sonner';
import { useAmendmentActions } from '@/zero/amendments/useAmendmentActions';
import { useAmendmentState } from '@/zero/amendments/useAmendmentState';
import { waitForClientApply } from '@/zero/mutate-with-server-check';
import type { SupportConfirmationRow } from '@/zero/amendments/queries';
import { mutators } from '@/zero/mutators';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface UseSupportConfirmationResult {
  pendingConfirmations: SupportConfirmationRow[];
  isLoading: boolean;
  confirmSupport: (confirmationId: string) => Promise<void>;
  declineSupport: (confirmationId: string) => Promise<void>;
}

export function useSupportConfirmation(groupId?: string): UseSupportConfirmationResult {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const { updateSupportConfirmation: updateSupportAction } = useAmendmentActions();

  // Query support confirmations for the group via facade
  const { supportConfirmationsByGroup: confirmationsData, isLoading: queryLoading } =
    useAmendmentState({
      includeSupportConfirmationsByGroup: true,
      groupId,
    });

  const pendingConfirmations = useMemo((): SupportConfirmationRow[] => {
    if (!confirmationsData) return [];
    return confirmationsData;
  }, [confirmationsData]);

  const confirmSupport = useCallback(
    async (confirmationId: string) => {
      if (!user) {
        toast.error(translateText('generated.inline.0159_you_must_be_logged_in_702ab856'));
        return;
      }

      const confirmation = pendingConfirmations.find(c => c.id === confirmationId);
      if (!confirmation) {
        toast.error(translateText('generated.inline.0160_confirmation_not_found_98db8f71'));
        return;
      }

      setIsLoading(true);
      try {
        await waitForClientApply(
          updateSupportAction({
            id: confirmationId,
            status: 'confirmed',
            confirmed_at: Date.now(),
          })
        );

        toast.success(translateText('generated.inline.0161_support_confirmed_9a48851e'));
      } catch (error) {
        console.error('Error confirming support:', error);
        toast.error(translateText('generated.inline.0162_failed_to_confirm_support_deffd413'));
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [user, pendingConfirmations]
  );

  const declineSupport = useCallback(
    async (confirmationId: string) => {
      if (!user) {
        toast.error(translateText('generated.inline.0159_you_must_be_logged_in_702ab856'));
        return;
      }

      const confirmation = pendingConfirmations.find(c => c.id === confirmationId);
      if (!confirmation) {
        toast.error(translateText('generated.inline.0160_confirmation_not_found_98db8f71'));
        return;
      }

      setIsLoading(true);
      try {
        await waitForClientApply(
          updateSupportAction({
            id: confirmationId,
            status: 'declined',
            confirmed_at: Date.now(),
          })
        );

        // Known limitation: Zero has no unlink operation. Supporter removal requires direct record deletion.
        toast.success(translateText('generated.inline.0163_support_declined_10a02268'));
      } catch (error) {
        console.error('Error declining support:', error);
        toast.error(translateText('generated.inline.0164_failed_to_decline_support_6fb6e4aa'));
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [user, pendingConfirmations]
  );

  return {
    pendingConfirmations,
    isLoading: isLoading || queryLoading,
    confirmSupport,
    declineSupport,
  };
}

/**
 * Trigger support confirmation when a change request is accepted.
 * Accepts a mutate function (from useMutate) instead of a Zero instance.
 * Caller must provide supporterGroups since this is a plain function, not a hook.
 */
export async function triggerSupporterConfirmation(
  mutate: (
    mutation:
      | ReturnType<typeof mutators.amendments.createSupportConfirmation>
      | ReturnType<typeof mutators.agendas.createAgendaItem>
  ) => Promise<unknown>,
  params: {
    amendmentId: string;
    changeRequestId: string;
    changeRequestTitle?: string | null;
    userId: string;
    amendmentTitle?: string;
    supporterGroups?: readonly { id: string }[];
  }
): Promise<void> {
  const { amendmentId, supporterGroups, amendmentTitle } = params;

  if (!supporterGroups?.length) {
    return; // No supporter groups to confirm
  }

  for (const group of supporterGroups) {
    const confirmationId = crypto.randomUUID();

    // Create support confirmation record
    await mutate(
      mutators.amendments.createSupportConfirmation({
        id: confirmationId,
        status: 'pending',
        amendment_id: amendmentId,
        group_id: group.id,
        event_id: '',
        confirmed_by_id: '',
        confirmed_at: 0,
      })
    );

    // Create agenda item for confirmation at group's next event
    const agendaItemId = crypto.randomUUID();
    await mutate(
      mutators.agendas.createAgendaItem({
        id: agendaItemId,
        title: translateText('generated.inline.0017_support_confirmation_value2d94_314c8fde', {
          value2d94: amendmentTitle || 'Amendment',
        }),
        type: 'support_confirmation',
        status: 'scheduled',
        amendment_id: amendmentId,
        event_id: null,
        description: '',
        forwarding_status: '',
        order_index: 0,
        duration: 0,
        scheduled_time: '',
        start_time: 0,
        end_time: 0,
        activated_at: 0,
        completed_at: 0,
        majority_type: null,
        time_limit: null,
        voting_phase: null,
      })
    );

    // NOTE: agenda_item_id column does not exist on support_confirmation table
  }
}

/**
 * Create a confirmation agenda item for a specific group's event.
 * Accepts a mutate function (from useMutate) instead of a Zero instance.
 */
export async function createConfirmationAgendaItem(
  mutate: (mutation: ReturnType<typeof mutators.agendas.createAgendaItem>) => Promise<unknown>,
  params: {
    confirmationId: string;
    amendmentTitle: string;
    eventId: string;
    groupId: string;
  }
): Promise<string> {
  const { amendmentTitle, eventId } = params;

  const agendaItemId = crypto.randomUUID();

  await mutate(
    mutators.agendas.createAgendaItem({
      id: agendaItemId,
      title: translateText('generated.inline.0018_support_confirmation_amendmenttitle_27308ec0', {
        amendmentTitle: amendmentTitle,
      }),
      type: 'support_confirmation',
      status: 'scheduled',
      description: translateText(
        'generated.inline.0019_vote_to_confirm_or_decline_continued_support__f391ad7a'
      ),
      event_id: eventId,
      amendment_id: null,
      forwarding_status: '',
      order_index: 0,
      duration: 0,
      scheduled_time: '',
      start_time: 0,
      end_time: 0,
      activated_at: 0,
      completed_at: 0,
      majority_type: null,
      time_limit: null,
      voting_phase: null,
    })
  );

  // NOTE: agenda_item_id column does not exist on support_confirmation table

  return agendaItemId;
}
