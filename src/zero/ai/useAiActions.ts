import { useCallback } from 'react';
import { useZero } from '@rocicorp/zero/react';
import { gatedToast as toast } from '@/features/notifications/utils/gated-toast';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import type { AiToolName } from '@/lib/ai/schemas';
import { mutators } from '../mutators';
import { onServerError } from '../mutate-with-server-check';
import {
  trackCreationUnlessSilent,
  type CreationMutationOptions,
} from '@/features/notifications/utils/mutation-finalization';

interface UpsertSkillArgs {
  id?: string;
  slug: string;
  name: string;
  aliases?: string;
  system_prompt: string;
  enabled?: boolean;
}

interface UpsertToolArgs {
  id?: string;
  tool_name: AiToolName;
  enabled?: boolean;
}

export function useAiActions() {
  const zero = useZero();
  const { t } = useTranslation();

  const createSkill = useCallback(
    (args: UpsertSkillArgs, options?: CreationMutationOptions) => {
      const id = args.id ?? crypto.randomUUID();
      const result = zero.mutate(
        mutators.ai.createSkill({
          id,
          slug: args.slug,
          name: args.name,
          aliases: args.aliases ?? '',
          system_prompt: args.system_prompt,
          enabled: args.enabled ?? true,
        })
      );

      trackCreationUnlessSilent(result, 'aiSkill', options, id);
      return result;
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
          enabled: args.enabled,
        })
      );

      onServerError(result, msg => console.error('AI skill update failed:', msg));
      toast.success(t('pages.user.ai.skills.updated'));
      return result;
    },
    [t, zero]
  );

  const deleteSkill = useCallback(
    (id: string) => {
      const result = zero.mutate(mutators.ai.deleteSkill({ id }));
      onServerError(result, msg => console.error('AI skill delete failed:', msg));
      toast.success(t('pages.user.ai.skills.deleted'));
      return result;
    },
    [t, zero]
  );

  const createTool = useCallback(
    (args: UpsertToolArgs, options?: CreationMutationOptions) => {
      const id = args.id ?? crypto.randomUUID();
      const result = zero.mutate(
        mutators.ai.createTool({
          id,
          tool_name: args.tool_name,
          enabled: args.enabled ?? true,
        })
      );

      trackCreationUnlessSilent(result, 'aiTool', options, id);
      return result;
    },
    [t, zero]
  );

  const updateTool = useCallback(
    (args: Required<Pick<UpsertToolArgs, 'id'>> & Omit<UpsertToolArgs, 'id'>) => {
      const result = zero.mutate(
        mutators.ai.updateTool({
          id: args.id,
          tool_name: args.tool_name,
          enabled: args.enabled,
        })
      );

      onServerError(result, msg => console.error('AI tool update failed:', msg));
      toast.success(t('pages.user.ai.tools.updated'));
      return result;
    },
    [t, zero]
  );

  return {
    createSkill,
    updateSkill,
    deleteSkill,
    createTool,
    updateTool,
  };
}
