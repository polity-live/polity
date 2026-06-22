import { useEffect, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import type { CarouselApi } from '@/features/shared/ui/ui/carousel';
import { useAgendaActions } from '@/zero/agendas/useAgendaActions';
import { useElectionActions } from '@/zero/elections/useElectionActions';
import { useVoteActions } from '@/zero/votes/useVoteActions';
import { useAllEvents, useAllAmendments, useRolesWithGroups } from '@/zero/events/useEventState';
import { useAuth } from '@/providers/auth-provider';
import { toast } from '@/features/shared/ui/ui/sonner';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { VOTE_PHASE, VOTE_PURPOSE } from '@/zero/votes/vote-workflow';

export interface CreateAgendaItemFormData {
  title: string;
  description: string;
  type: 'election' | 'vote' | 'speech' | 'discussion' | 'accreditation';
  order: number;
  duration: string;
  eventId: string;
  amendmentId: string;
  roleId: string;
}

export function useCreateAgendaItemFormController() {
  const navigate = useNavigate();
  const searchParams = useSearch({ strict: false });
  const { user } = useAuth();
  const { createAgendaItem } = useAgendaActions();
  const { createElection } = useElectionActions();
  const { createVote, createVoteChoice } = useVoteActions();

  const eventIdParam = (searchParams as Record<string, string | undefined>).eventId;

  const [formData, setFormData] = useState<CreateAgendaItemFormData>({
    title: '',
    description: '',
    type: 'discussion',
    order: 1,
    duration: '',
    eventId: eventIdParam || '',
    amendmentId: '',
    roleId: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (!carouselApi) {
      return;
    }

    carouselApi.on('select', () => {
      setCurrentStep(carouselApi.selectedScrollSnap());
    });
  }, [carouselApi]);

  const { events: userEvents } = useAllEvents();
  const { amendments: userAmendments } = useAllAmendments();
  const { roles: userRoles } = useRolesWithGroups();

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      if (!user?.id) {
        toast.error(
          translateText(
            'generated.inline.0021_you_must_be_logged_in_to_create_an_agenda_ite_959a22b0'
          )
        );
        setIsSubmitting(false);
        return;
      }

      if (!formData.eventId) {
        toast.error(
          translateText(
            'generated.inline.0022_please_select_an_event_for_this_agenda_item_e6169d47'
          )
        );
        setIsSubmitting(false);
        return;
      }

      const agendaItemId = crypto.randomUUID();

      await createAgendaItem({
        id: agendaItemId,
        title: formData.title,
        description: formData.description || '',
        type: formData.type,
        order_index: formData.order,
        duration: formData.duration ? parseInt(formData.duration) : 0,
        status: 'pending',
        forwarding_status: '',
        scheduled_time: '',
        start_time: 0,
        end_time: 0,
        activated_at: 0,
        completed_at: 0,
        event_id: formData.eventId,
        amendment_id: formData.amendmentId || '',
        majority_type: null,
        time_limit: null,
        voting_phase: null,
      });

      if (formData.type === 'election') {
        const electionId = crypto.randomUUID();
        await createElection({
          id: electionId,
          title: formData.title,
          description: formData.description || null,
          status: 'indicative',
          majority_type: 'relative',
          closing_type: null,
          closing_duration_seconds: null,
          closing_end_time: null,
          visibility: 'public',
          max_votes: 1,
          agenda_item_id: agendaItemId,
          role_id: formData.roleId || null,
        });
      }

      if (formData.type === 'vote') {
        const voteId = crypto.randomUUID();
        await createVote({
          id: voteId,
          title: formData.title,
          description: formData.description || null,
          status: VOTE_PHASE.indicative,
          purpose: VOTE_PURPOSE.closing,
          majority_type: 'relative',
          closing_type: null,
          closing_duration_seconds: null,
          closing_end_time: null,
          visibility: 'public',
          agenda_item_id: agendaItemId,
          amendment_id: formData.amendmentId || null,
        });

        const defaultChoices = ['Yes', 'No', 'Abstain'];
        for (let i = 0; i < defaultChoices.length; i++) {
          await createVoteChoice({
            id: crypto.randomUUID(),
            vote_id: voteId,
            label: defaultChoices[i],
            order_index: i + 1,
          });
        }
      }

      toast.success(
        translateText('generated.inline.0023_agenda_item_created_successfully_4eb7ae08')
      );
      navigate({ to: `/event/${formData.eventId}/agenda` });
    } catch (error) {
      console.error('Failed to create agenda item:', error);
      toast.error(
        translateText(
          'generated.inline.0024_failed_to_create_agenda_item_please_try_again_b0524017'
        )
      );
      setIsSubmitting(false);
    }
  };

  return {
    formData,
    setFormData,
    isSubmitting,
    carouselApi,
    setCarouselApi,
    currentStep,
    userEvents,
    userAmendments,
    userRoles,
    handleSubmit,
  };
}

export type CreateAgendaItemFormController = ReturnType<typeof useCreateAgendaItemFormController>;
