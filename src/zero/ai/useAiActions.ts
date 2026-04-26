import { useCallback } from 'react';
import { useZero } from '@rocicorp/zero/react';
import { gatedToast as toast } from '@/features/notifications/utils/gated-toast';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { mutators } from '../mutators';
import { onServerError } from '../mutate-with-server-check';

interface UpsertSkillArgs {
  id?: string;
  slug: string;
  name: string;
  aliases?: string;
  system_prompt: string;
}

export function useAiActions() {
  const zero = useZero();
  const { t } = useTranslation();

  const createSkill = useCallback(
    (args: UpsertSkillArgs) => {
      const result = zero.mutate(
        mutators.ai.createSkill({
          id: args.id ?? crypto.randomUUID(),
          slug: args.slug,
          name: args.name,
          aliases: args.aliases ?? '',
          system_prompt: args.system_prompt,
        })
      );

      onServerError(result, msg => console.error('AI skill create failed:', msg));
      toast.success(t('pages.user.ai.skills.created', 'Skill created'));
    },
    [t, zero]
  );

  const updateSkill = useCallback(
    (args: Required<Pick<UpsertSkillArgs, 'id'>> & Omit<UpsertSkillArgs, 'id'>) => {
      const result = zero.mutate(
        mutators.ai.updateSkill({
          id: args.id,
          slug: args.slug,
          name: args.name,
          aliases: args.aliases ?? '',
          system_prompt: args.system_prompt,
        })
      );

      onServerError(result, msg => console.error('AI skill update failed:', msg));
      toast.success(t('pages.user.ai.skills.updated', 'Skill updated'));
    },
    [t, zero]
  );

  const deleteSkill = useCallback(
    (id: string) => {
      const result = zero.mutate(mutators.ai.deleteSkill({ id }));
      onServerError(result, msg => console.error('AI skill delete failed:', msg));
      toast.success(t('pages.user.ai.skills.deleted', 'Skill deleted'));
    },
    [t, zero]
  );

  return {
    createSkill,
    updateSkill,
    deleteSkill,
  };
}
