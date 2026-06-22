import { useState, useMemo } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { useElectionActions } from '@/zero/elections/useElectionActions';
import { useElectionState } from '@/zero/elections/useElectionState';
import { useUserEventParticipations } from '@/zero/events/useEventState';
import { useCurrentUserActiveGroupIds } from '@/zero/groups/useGroupState';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import { toast } from '@/features/shared/ui/ui/sonner';
import { ImageUpload } from '@/features/file-upload/ui/ImageUpload.tsx';
import { ElectionSearchInput } from '../ui/inputs/ElectionSearchInput';
import { CreateSummaryStep } from '../ui/CreateSummaryStep';
import type { CreateFormConfig, CreateSubmitContext } from '../types/create-form.types';
import {
  createBlockedSubmitOutcome,
  createRouteSubmitTarget,
  createSuccessSubmitOutcome,
} from '../logic/createSubmitTargets';
import {
  getCreateSelectableEventIds,
  isCreateSelectableElection,
} from '../logic/createEligibility';

export function useCreateElectionCandidateForm(): CreateFormConfig {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { addCandidate } = useElectionActions();
  const { electionsForSearch } = useElectionState({ includeElectionsForSearch: true });
  const { activeGroupIds } = useCurrentUserActiveGroupIds();
  const { participations: userEventParticipations } = useUserEventParticipations(user?.id);

  const [candidateId] = useState(() => crypto.randomUUID());
  const [electionId, setElectionId] = useState('');
  const [statement, setStatement] = useState('');
  const [imageURL, setImageURL] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const selectableEventIds = useMemo(() => {
    const electionEvents = electionsForSearch.flatMap(election =>
      election.agenda_item?.event ? [election.agenda_item.event] : []
    );

    return getCreateSelectableEventIds(electionEvents, activeGroupIds, userEventParticipations);
  }, [activeGroupIds, electionsForSearch, userEventParticipations]);
  const eligibleElections = useMemo(
    () =>
      electionsForSearch.filter(election =>
        isCreateSelectableElection(election, selectableEventIds)
      ),
    [electionsForSearch, selectableEventIds]
  );
  const eligibleElectionIds = useMemo(
    () => eligibleElections.map(election => election.id),
    [eligibleElections]
  );
  const selectedElection = eligibleElections.find(election => election.id === electionId);
  const selectedElectionTitle = selectedElection?.title || t('pages.create.common.notSelected');

  const handleSubmit = async (context?: CreateSubmitContext) => {
    if (!user || !selectedElection) return createBlockedSubmitOutcome();
    setIsSubmitting(true);
    try {
      context?.reportProgress({ key: 'create', status: 'active' });
      await addCandidate({
        id: candidateId,
        name: '',
        description: statement.trim(),
        election_id: electionId,
        user_id: user.id,
        status: 'pending',
        order_index: 0,
        image_url: imageURL,
      });
      toast.success(t('pages.create.success.created'));
      context?.reportProgress({ key: 'create', status: 'complete' });
      context?.reportProgress({ key: 'sync', status: 'complete' });
      context?.reportProgress({ key: 'ready', status: 'active' });
      return createSuccessSubmitOutcome(
        createRouteSubmitTarget('election', {
          to: '/create',
        })
      );
    } catch (error) {
      toast.error(t('pages.create.error.createFailed'));
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  const config = useMemo(
    (): CreateFormConfig => ({
      entityType: 'election',
      title: translateText('generated.inline.0056_pages_create_electioncandidate_title_b1daefe6'),
      isSubmitting,
      onSubmit: handleSubmit,
      submissionSteps: [
        {
          key: 'create',
          label: t('pages.create.progress.submission.steps.electionCandidate.create'),
        },
        { key: 'sync', label: t('pages.create.progress.submission.steps.electionCandidate.sync') },
        {
          key: 'ready',
          label: t('pages.create.progress.submission.steps.electionCandidate.ready'),
        },
      ],
      steps: [
        {
          label: t('pages.create.electionCandidate.electionLabel'),
          isValid: () => Boolean(selectedElection),
          fields: [
            {
              key: 'election',
              kind: 'customComponent',
              component: ElectionSearchInput,
              props: {
                value: electionId,
                onChange: setElectionId,
                allowedElectionIds: eligibleElectionIds,
                label: t('pages.create.electionCandidate.electionLabel'),
                required: true,
                placeholder: t('pages.create.electionCandidate.electionPlaceholder'),
              },
            },
          ],
        },
        {
          label: t('pages.create.electionCandidate.descriptionLabel'),
          isValid: () => true,
          optional: true,
          fields: [
            {
              key: 'statement',
              kind: 'text',
              multiline: true,
              label: t('pages.create.electionCandidate.descriptionLabel'),
              hint: t('pages.create.electionCandidate.tips.description'),
              value: statement,
              onValueChange: setStatement,
              placeholder: t('pages.create.electionCandidate.descriptionPlaceholder'),
              rows: 5,
            },
            {
              key: 'image',
              kind: 'customComponent',
              component: ImageUpload,
              props: {
                currentImage: imageURL,
                onImageChange: setImageURL,
                entityType: 'election-candidates',
                entityId: candidateId,
                label: t('pages.create.electionCandidate.imageUrlLabel'),
                description: t('pages.create.electionCandidate.imageUrlOptional'),
              },
            },
          ],
        },
        {
          label: t('pages.create.common.review'),
          isValid: () => Boolean(selectedElection),
          fields: [
            {
              key: 'review',
              kind: 'customComponent',
              component: CreateSummaryStep,
              props: {
                entityType: 'election',
                badge: t('pages.create.electionCandidate.reviewBadge'),
                title: selectedElection?.title || t('pages.create.electionCandidate.reviewTitle'),
                subtitle: statement || undefined,
                media: imageURL
                  ? { imageUrl: imageURL, imageAlt: selectedElectionTitle }
                  : undefined,
                sections: [
                  {
                    title: t('pages.create.electionCandidate.electionLabel'),
                    fields: [
                      {
                        label: t('pages.create.electionCandidate.electionLabel'),
                        value: selectedElectionTitle,
                      },
                    ],
                  },
                  {
                    title: t('pages.create.electionCandidate.descriptionLabel'),
                    fields: [
                      {
                        label: t('pages.create.electionCandidate.descriptionLabel'),
                        value: statement || t('pages.create.common.notSelected'),
                      },
                      ...(imageURL
                        ? [
                            {
                              label: t('pages.create.electionCandidate.image'),
                              value: t('common.attached'),
                            },
                          ]
                        : []),
                    ],
                  },
                ],
              },
            },
          ],
        },
      ],
    }),
    [
      candidateId,
      electionId,
      eligibleElectionIds,
      imageURL,
      isSubmitting,
      selectedElection,
      selectedElectionTitle,
      statement,
      t,
    ]
  );

  return config;
}
