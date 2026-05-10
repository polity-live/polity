import { useState, useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAuth } from '@/providers/auth-provider';
import { useGroupActions } from '@/zero/groups/useGroupActions';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { toast } from 'sonner';
import { CreateSummaryStep } from '../ui/CreateSummaryStep';
import { CreateInputField, CreateTextareaField } from '../ui/CreateFields';
import { CreateTypeaheadField } from '../ui/CreateFields';
import type { CreateFormConfig } from '../types/create-form.types';

export function useCreatePositionForm(): CreateFormConfig {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { createPosition } = useGroupActions();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [term, setTerm] = useState('4');
  const [firstTermStart, setFirstTermStart] = useState('');
  const [groupId, setGroupId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const positionId = crypto.randomUUID();
      await createPosition({
        id: positionId,
        title: title.trim(),
        description: description.trim(),
        term: String(parseInt(term, 10)),
        first_term_start: new Date(firstTermStart).getTime(),
        scheduled_revote_date: null,
        group_id: groupId,
        event_id: null,
      });
      toast.success(t('pages.create.success.created'));
      navigate({ to: '/group/$id', params: { id: groupId } });
    } catch {
      toast.error(t('pages.create.error.createFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const config = useMemo(
    (): CreateFormConfig => ({
      entityType: 'group',
      title: 'pages.create.position.title',
      isSubmitting,
      onSubmit: handleSubmit,
      steps: [
        {
          label: t('pages.create.position.groupLabel'),
          isValid: () => !!groupId,
          content: (
            <CreateTypeaheadField
              label={t('pages.create.position.groupLabel')}
              required
              entityTypes={['group']}
              value={groupId || undefined}
              onChange={item => {
                setGroupId(item?.id ?? '');
              }}
              placeholder={t('pages.create.common.searchGroup')}
            />
          ),
        },
        {
          label: t('pages.create.position.titleLabel'),
          isValid: () => !!title.trim(),
          content: (
            <div className="space-y-4">
              <CreateInputField
                label={t('pages.create.position.titleLabel')}
                required
                hint={t('pages.create.position.tips.title')}
                value={title}
                onValueChange={setTitle}
                placeholder={t('pages.create.position.titlePlaceholder')}
              />
              <CreateTextareaField
                label={t('pages.create.position.descriptionLabel')}
                hint={t('pages.create.position.tips.description')}
                value={description}
                onValueChange={setDescription}
                placeholder={t('pages.create.position.descriptionPlaceholder')}
                rows={3}
              />
            </div>
          ),
        },
        {
          label: t('pages.create.position.termLabel'),
          isValid: () => parseInt(term, 10) >= 1 && !!firstTermStart,
          content: (
            <div className="space-y-4">
              <CreateInputField
                label={t('pages.create.position.termLabel')}
                required
                hint={`${t('pages.create.position.tips.termLength')} ${t('pages.create.position.termHint')}`}
                type="number"
                min={1}
                value={term}
                onValueChange={setTerm}
              />
              <CreateInputField
                label={t('pages.create.position.firstTermStartLabel')}
                required
                hint={t('pages.create.position.firstTermStartHint')}
                type="date"
                value={firstTermStart}
                onValueChange={setFirstTermStart}
              />
            </div>
          ),
        },
        {
          label: t('pages.create.common.review'),
          isValid: () => !!groupId && !!title.trim() && parseInt(term, 10) >= 1 && !!firstTermStart,
          content: (
            <CreateSummaryStep
              entityType="group"
              badge={t('pages.create.position.reviewBadge')}
              title={title || 'Untitled Position'}
              subtitle={description || undefined}
              fields={[
                {
                  label: t('pages.create.position.termLength'),
                  value: t('pages.create.position.termMonths', { months: term }),
                },
                { label: t('pages.create.position.firstTermStarts'), value: firstTermStart },
              ]}
            />
          ),
        },
      ],
    }),
    [title, description, term, firstTermStart, groupId, isSubmitting, t]
  );

  return config;
}
