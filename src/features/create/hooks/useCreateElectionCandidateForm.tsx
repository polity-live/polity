import { useState, useMemo } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { useElectionActions } from '@/zero/elections/useElectionActions';
import { useElectionState } from '@/zero/elections/useElectionState';
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

export function useCreateElectionCandidateForm(): CreateFormConfig {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { addCandidate } = useElectionActions();
  const { electionsForSearch } = useElectionState({ includeElectionsForSearch: true });

  const [candidateId] = useState(() => crypto.randomUUID());
  const [electionId, setElectionId] = useState('');
  const [statement, setStatement] = useState('');
  const [imageURL, setImageURL] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const selectedElection = electionsForSearch.find(election => election.id === electionId);
  const selectedElectionTitle = selectedElection?.title || t('pages.create.common.notSelected');

  const handleSubmit = async (context?: CreateSubmitContext) => {
    if (!user) return createBlockedSubmitOutcome();
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
        { key: 'create', label: 'Erstellt Kandidatur' },
        { key: 'sync', label: 'Synchronisiert Wahlkontext' },
        { key: 'ready', label: 'Bereitet Zielseite vor' },
      ],
      steps: [
        {
          label: t('pages.create.electionCandidate.electionLabel'),
          isValid: () => !!electionId,
          fields: [
            {
              key: 'election',
              kind: 'customComponent',
              component: ElectionSearchInput,
              props: {
                value: electionId,
                onChange: setElectionId,
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
          isValid: () => !!electionId,
          fields: [
            {
              key: 'review',
              kind: 'customComponent',
              component: CreateSummaryStep,
              props: {
                entityType: 'election',
                badge: t('pages.create.electionCandidate.reviewBadge'),
                title: selectedElection?.title || 'Election Candidate',
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
                              value: 'Attached',
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
