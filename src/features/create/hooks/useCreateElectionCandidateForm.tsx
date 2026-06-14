import { useState, useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAuth } from '@/providers/auth-provider';
import { useElectionActions } from '@/zero/elections/useElectionActions';
import { useElectionState } from '@/zero/elections/useElectionState';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import { toast } from 'sonner';
import { ImageUpload } from '@/features/file-upload/ui/ImageUpload.tsx';
import { ElectionSearchInput } from '../ui/inputs/ElectionSearchInput';
import { CreateSummaryStep } from '../ui/CreateSummaryStep';
import { CreateTextareaField } from '../ui/CreateFields';
import type { CreateFormConfig } from '../types/create-form.types';

export function useCreateElectionCandidateForm(): CreateFormConfig {
  const { t } = useTranslation();
  const navigate = useNavigate();
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

  const handleSubmit = async () => {
    if (!user) return;
    setIsSubmitting(true);
    try {
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
      navigate({ to: '/create' });
    } catch {
      toast.error(t('pages.create.error.createFailed'));
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
      steps: [
        {
          label: t('pages.create.electionCandidate.electionLabel'),
          isValid: () => !!electionId,
          content: (
            <ElectionSearchInput
              value={electionId}
              onChange={setElectionId}
              label={t('pages.create.electionCandidate.electionLabel')}
              required
              placeholder={t('pages.create.electionCandidate.electionPlaceholder')}
            />
          ),
        },
        {
          label: t('pages.create.electionCandidate.descriptionLabel'),
          isValid: () => true,
          optional: true,
          content: (
            <div className="space-y-4">
              <CreateTextareaField
                label={t('pages.create.electionCandidate.descriptionLabel')}
                hint={t('pages.create.electionCandidate.tips.description')}
                value={statement}
                onValueChange={setStatement}
                placeholder={t('pages.create.electionCandidate.descriptionPlaceholder')}
                rows={5}
              />
              <ImageUpload
                currentImage={imageURL}
                onImageChange={setImageURL}
                entityType="election-candidates"
                entityId={candidateId}
                label={t('pages.create.electionCandidate.imageUrlLabel')}
                description={t('pages.create.electionCandidate.imageUrlOptional')}
              />
            </div>
          ),
        },
        {
          label: t('pages.create.common.review'),
          isValid: () => !!electionId,
          content: (
            <CreateSummaryStep
              entityType="election"
              badge={t('pages.create.electionCandidate.reviewBadge')}
              title={selectedElection?.title || 'Election Candidate'}
              subtitle={statement || undefined}
              media={imageURL ? { imageUrl: imageURL, imageAlt: selectedElectionTitle } : undefined}
              sections={[
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
                      ? [{ label: t('pages.create.electionCandidate.image'), value: 'Attached' }]
                      : []),
                  ],
                },
              ]}
            />
          ),
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
