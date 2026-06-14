import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from '@/features/shared/ui/ui/sonner';
import { DEFAULT_AI_SKILLS } from '@/features/assistant/logic/defaultAiSkills';
import type { AiProvider } from '@/lib/ai/schemas';
import { DEFAULT_AI_TOOLS, type AiToolName } from '@/lib/ai/defaultAiTools';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import { useAuth } from '@/providers/auth-provider';
import { useAiActions } from '@/zero/ai/useAiActions';
import { useAiState } from '@/zero/ai/useAiState';

export interface AiCredentialSummary {
  provider: AiProvider;
  has_key: boolean;
  key_hint: string | null;
  updated_at: string | null;
}

export interface AiCatalogModel {
  provider: AiProvider;
  id: string;
  label: string;
  source: 'app' | 'byok';
  free: boolean;
  supports_reasoning_effort: boolean;
  context_window: number | null;
}

interface AiCatalogResponse {
  credentials: AiCredentialSummary[];
  models: AiCatalogModel[];
}

interface SkillFormState {
  name: string;
  slug: string;
  aliases: string;
  systemPrompt: string;
}

type SkillFormField = keyof SkillFormState;

type SkillFormTouchedState = Record<SkillFormField, boolean>;

interface SkillFormErrors {
  name: string | null;
  slug: string | null;
  aliases: string | null;
  systemPrompt: string | null;
}

interface PendingSkillDeletion {
  id: string;
  name: string;
}

const PROVIDERS: readonly AiProvider[] = ['openrouter', 'openai', 'anthropic'];

function slugifySkillName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const EMPTY_SKILL_FORM: SkillFormState = {
  name: '',
  slug: '',
  aliases: '',
  systemPrompt: '',
};

const EMPTY_SKILL_FORM_TOUCHED: SkillFormTouchedState = {
  name: false,
  slug: false,
  aliases: false,
  systemPrompt: false,
};

const SKILL_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function useAiSettingsTab() {
  const { session } = useAuth();
  const { t } = useTranslation();
  const { skills, tools } = useAiState();
  const aiActions = useAiActions();

  const [credentials, setCredentials] = useState<AiCredentialSummary[]>([]);
  const [models, setModels] = useState<AiCatalogModel[]>([]);
  const [providerInputs, setProviderInputs] = useState<Record<AiProvider, string>>({
    openrouter: '',
    openai: '',
    anthropic: '',
  });
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);
  const [savingProvider, setSavingProvider] = useState<AiProvider | null>(null);
  const [deletingProvider, setDeletingProvider] = useState<AiProvider | null>(null);
  const [isSkillDialogOpen, setIsSkillDialogOpen] = useState(false);
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);
  const [editingBuiltInSlug, setEditingBuiltInSlug] = useState<string | null>(null);
  const [skillForm, setSkillForm] = useState<SkillFormState>(EMPTY_SKILL_FORM);
  const [skillFormTouched, setSkillFormTouched] =
    useState<SkillFormTouchedState>(EMPTY_SKILL_FORM_TOUCHED);
  const [hasAttemptedSkillSubmit, setHasAttemptedSkillSubmit] = useState(false);
  const [pendingSkillDeletion, setPendingSkillDeletion] = useState<PendingSkillDeletion | null>(
    null
  );

  const credentialsByProvider = useMemo(() => {
    const byProvider = new Map(credentials.map(credential => [credential.provider, credential]));

    return PROVIDERS.reduce<Record<AiProvider, AiCredentialSummary>>(
      (accumulator, provider) => {
        accumulator[provider] = byProvider.get(provider) ?? {
          provider,
          has_key: false,
          key_hint: null,
          updated_at: null,
        };
        return accumulator;
      },
      {} as Record<AiProvider, AiCredentialSummary>
    );
  }, [credentials]);

  const builtInSkillSlugs = useMemo(() => new Set(DEFAULT_AI_SKILLS.map(skill => skill.slug)), []);

  const loadCatalog = useCallback(async () => {
    if (!session?.access_token) {
      setCredentials([]);
      setModels([]);
      return;
    }

    setIsCatalogLoading(true);

    try {
      const response = await fetch('/api/ai/catalog', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const payload = (await response.json()) as AiCatalogResponse;
      setCredentials(payload.credentials ?? []);
      setModels(payload.models ?? []);
    } catch (error) {
      console.error('Failed to load AI settings catalog:', error);
      toast.error(translateText('generated.inline.1179_failed_to_load_ai_settings_809836c9'));
    } finally {
      setIsCatalogLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const updateProviderInput = useCallback((provider: AiProvider, value: string) => {
    setProviderInputs(currentInputs => ({
      ...currentInputs,
      [provider]: value,
    }));
  }, []);

  const saveCredential = useCallback(
    async (provider: AiProvider) => {
      if (!session?.access_token) {
        toast.error(t('features.messages.ai.sessionMissing'));
        return;
      }

      const apiKey = providerInputs[provider]?.trim();
      if (!apiKey) {
        toast.error(t('pages.user.ai.credentials.validation'));
        return;
      }

      setSavingProvider(provider);

      try {
        const response = await fetch('/api/ai/credentials', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ provider, apiKey }),
        });

        if (!response.ok) {
          throw new Error(await response.text());
        }

        const payload = (await response.json()) as AiCatalogResponse;
        setCredentials(payload.credentials ?? []);
        setModels(payload.models ?? []);
        updateProviderInput(provider, '');
        toast.success(t('pages.user.ai.credentials.saved'));
      } catch (error) {
        console.error(`Failed to save ${provider} credential:`, error);
        toast.error(t('pages.user.ai.credentials.saveFailed'));
      } finally {
        setSavingProvider(null);
      }
    },
    [providerInputs, session?.access_token, t, updateProviderInput]
  );

  const deleteCredential = useCallback(
    async (provider: AiProvider) => {
      if (!session?.access_token) {
        toast.error(t('features.messages.ai.sessionMissing'));
        return;
      }

      setDeletingProvider(provider);

      try {
        const response = await fetch('/api/ai/credentials', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ provider }),
        });

        if (!response.ok) {
          throw new Error(await response.text());
        }

        const payload = (await response.json()) as AiCatalogResponse;
        setCredentials(payload.credentials ?? []);
        setModels(payload.models ?? []);
        updateProviderInput(provider, '');
        toast.success(t('pages.user.ai.credentials.deleted'));
      } catch (error) {
        console.error(`Failed to delete ${provider} credential:`, error);
        toast.error(t('pages.user.ai.credentials.deleteFailed'));
      } finally {
        setDeletingProvider(null);
      }
    },
    [session?.access_token, t, updateProviderInput]
  );

  const builtInSkillBySlug = useMemo(
    () => new Map(DEFAULT_AI_SKILLS.map(skill => [skill.slug, skill])),
    []
  );

  const builtInToolByName = useMemo(
    () => new Map(DEFAULT_AI_TOOLS.map(tool => [tool.name, tool])),
    []
  );

  const skillFormErrors = useMemo<SkillFormErrors>(() => {
    const name = skillForm.name.trim();
    const rawSlug = skillForm.slug.trim();
    const resolvedSlug = editingBuiltInSlug || rawSlug || slugifySkillName(name);
    const aliases = skillForm.aliases
      .split(',')
      .map(alias => alias.trim())
      .filter(Boolean);

    const nameError = name ? null : t('pages.user.ai.skills.validationName');
    const slugError = editingBuiltInSlug
      ? null
      : !resolvedSlug
        ? t('pages.user.ai.skills.validationSlug')
        : SKILL_SLUG_PATTERN.test(resolvedSlug)
          ? null
          : t('pages.user.ai.skills.validationSlugPattern');
    const aliasesError = aliases.every(alias => SKILL_SLUG_PATTERN.test(alias))
      ? null
      : t('pages.user.ai.skills.validationAliasPattern');
    const systemPromptError = skillForm.systemPrompt.trim()
      ? null
      : t('pages.user.ai.skills.validationPrompt');

    return {
      name: nameError,
      slug: slugError,
      aliases: aliasesError,
      systemPrompt: systemPromptError,
    };
  }, [editingBuiltInSlug, skillForm, t]);

  const isSkillFormValid = useMemo(
    () => Object.values(skillFormErrors).every(error => !error),
    [skillFormErrors]
  );

  const visibleSkillFormErrors = useMemo<SkillFormErrors>(
    () => ({
      name: hasAttemptedSkillSubmit || skillFormTouched.name ? skillFormErrors.name : null,
      slug: hasAttemptedSkillSubmit || skillFormTouched.slug ? skillFormErrors.slug : null,
      aliases: hasAttemptedSkillSubmit || skillFormTouched.aliases ? skillFormErrors.aliases : null,
      systemPrompt:
        hasAttemptedSkillSubmit || skillFormTouched.systemPrompt
          ? skillFormErrors.systemPrompt
          : null,
    }),
    [hasAttemptedSkillSubmit, skillFormErrors, skillFormTouched]
  );

  const resetSkillFormValidationState = useCallback(() => {
    setSkillFormTouched(EMPTY_SKILL_FORM_TOUCHED);
    setHasAttemptedSkillSubmit(false);
  }, []);

  const touchSkillField = useCallback((field: SkillFormField) => {
    setSkillFormTouched(currentTouched => {
      if (currentTouched[field]) {
        return currentTouched;
      }

      return {
        ...currentTouched,
        [field]: true,
      };
    });
  }, []);

  const startCreateSkill = useCallback(() => {
    resetSkillFormValidationState();
    setIsSkillDialogOpen(true);
    setEditingSkillId(null);
    setEditingBuiltInSlug(null);
    setSkillForm(EMPTY_SKILL_FORM);
  }, [resetSkillFormValidationState]);

  const startEditSkill = useCallback(
    (skillId: string) => {
      const skill = skills.find(currentSkill => currentSkill.id === skillId);
      if (!skill) {
        return;
      }

      resetSkillFormValidationState();
      setEditingSkillId(skillId);
      setEditingBuiltInSlug(null);
      setIsSkillDialogOpen(true);
      setSkillForm({
        name: skill.name,
        slug: skill.slug,
        aliases: skill.aliases ?? '',
        systemPrompt: skill.system_prompt ?? '',
      });
    },
    [resetSkillFormValidationState, skills]
  );

  const startEditBuiltInSkill = useCallback(
    (skillSlug: string) => {
      const builtInSkill = builtInSkillBySlug.get(skillSlug);
      if (!builtInSkill) {
        return;
      }

      const customOverride = skills.find(skill => skill.slug === skillSlug) ?? null;

      resetSkillFormValidationState();
      setIsSkillDialogOpen(true);
      setEditingBuiltInSlug(skillSlug);
      setEditingSkillId(customOverride?.id ?? null);
      setSkillForm({
        name: customOverride?.name ?? builtInSkill.name,
        slug: builtInSkill.slug,
        aliases: customOverride?.aliases ?? builtInSkill.aliases.join(','),
        systemPrompt: customOverride?.system_prompt ?? builtInSkill.systemPrompt,
      });
    },
    [builtInSkillBySlug, resetSkillFormValidationState, skills]
  );

  const cancelSkillEdit = useCallback(() => {
    resetSkillFormValidationState();
    setIsSkillDialogOpen(false);
    setEditingSkillId(null);
    setEditingBuiltInSlug(null);
    setSkillForm(EMPTY_SKILL_FORM);
  }, [resetSkillFormValidationState]);

  const updateSkillForm = useCallback(
    <K extends keyof SkillFormState>(field: K, value: SkillFormState[K]) => {
      setSkillForm(currentForm => ({
        ...currentForm,
        [field]: value,
      }));
    },
    []
  );

  const saveSkill = useCallback(() => {
    setHasAttemptedSkillSubmit(true);

    const name = skillForm.name.trim();
    const slug = (editingBuiltInSlug || skillForm.slug.trim() || slugifySkillName(name)).trim();
    const systemPrompt = skillForm.systemPrompt.trim();

    if (!isSkillFormValid || !name || !slug || !systemPrompt) {
      toast.error(t('pages.user.ai.skills.validation'));
      return;
    }

    if (builtInSkillSlugs.has(slug) && !editingSkillId && !editingBuiltInSlug) {
      toast.error(t('pages.user.ai.skills.slugExists'));
      return;
    }

    const slugTakenByAnotherSkill = skills.some(
      skill => skill.slug === slug && skill.id !== editingSkillId
    );
    if (slugTakenByAnotherSkill) {
      toast.error(t('pages.user.ai.skills.slugExists'));
      return;
    }

    if (editingSkillId) {
      aiActions.updateSkill({
        id: editingSkillId,
        slug,
        name,
        aliases: skillForm.aliases,
        system_prompt: systemPrompt,
      });
    } else {
      aiActions.createSkill({
        slug,
        name,
        aliases: skillForm.aliases,
        system_prompt: systemPrompt,
      });
    }

    cancelSkillEdit();
  }, [
    aiActions,
    builtInSkillSlugs,
    cancelSkillEdit,
    editingBuiltInSlug,
    editingSkillId,
    isSkillFormValid,
    skillForm,
    skills,
    t,
  ]);

  const deleteSkill = useCallback(
    (skillId: string) => {
      if (editingSkillId === skillId) {
        cancelSkillEdit();
      }

      aiActions.deleteSkill(skillId);
    },
    [aiActions, cancelSkillEdit, editingSkillId]
  );

  const requestDeleteSkill = useCallback(
    (skillId: string) => {
      const skill = skills.find(currentSkill => currentSkill.id === skillId);
      if (!skill) {
        return;
      }

      setPendingSkillDeletion({
        id: skill.id,
        name: skill.name,
      });
    },
    [skills]
  );

  const cancelDeleteSkill = useCallback(() => {
    setPendingSkillDeletion(null);
  }, []);

  const confirmDeleteSkill = useCallback(() => {
    if (!pendingSkillDeletion) {
      return;
    }

    deleteSkill(pendingSkillDeletion.id);
    setPendingSkillDeletion(null);
  }, [deleteSkill, pendingSkillDeletion]);

  const toggleCustomSkillEnabled = useCallback(
    (skillId: string, enabled: boolean) => {
      const skill = skills.find(currentSkill => currentSkill.id === skillId);
      if (!skill) {
        return;
      }

      aiActions.updateSkill({
        id: skill.id,
        slug: skill.slug,
        name: skill.name,
        aliases: skill.aliases ?? '',
        system_prompt: skill.system_prompt,
        enabled,
      });
    },
    [aiActions, skills]
  );

  const toggleBuiltInSkillEnabled = useCallback(
    (skillSlug: string, enabled: boolean) => {
      const builtInSkill = builtInSkillBySlug.get(skillSlug);
      if (!builtInSkill) {
        return;
      }

      const customOverride = skills.find(skill => skill.slug === skillSlug) ?? null;

      if (customOverride) {
        aiActions.updateSkill({
          id: customOverride.id,
          slug: customOverride.slug,
          name: customOverride.name,
          aliases: customOverride.aliases ?? '',
          system_prompt: customOverride.system_prompt,
          enabled,
        });
        return;
      }

      if (enabled) {
        return;
      }

      aiActions.createSkill({
        slug: builtInSkill.slug,
        name: builtInSkill.name,
        aliases: builtInSkill.aliases.join(','),
        system_prompt: builtInSkill.systemPrompt,
        enabled: false,
      });
    },
    [aiActions, builtInSkillBySlug, skills]
  );

  const toggleBuiltInToolEnabled = useCallback(
    (toolName: AiToolName, enabled: boolean) => {
      const builtInTool = builtInToolByName.get(toolName);
      if (!builtInTool) {
        return;
      }

      const toolOverride = tools.find(tool => tool.tool_name === toolName) ?? null;

      if (toolOverride) {
        aiActions.updateTool({
          id: toolOverride.id,
          tool_name: toolName,
          enabled,
        });
        return;
      }

      if (enabled) {
        return;
      }

      aiActions.createTool({
        tool_name: builtInTool.name,
        enabled: false,
      });
    },
    [aiActions, builtInToolByName, tools]
  );

  return {
    builtInTools: DEFAULT_AI_TOOLS,
    builtInSkills: DEFAULT_AI_SKILLS,
    skills,
    tools,
    models,
    credentialsByProvider,
    providerInputs,
    updateProviderInput,
    loadCatalog,
    saveCredential,
    deleteCredential,
    isCatalogLoading,
    savingProvider,
    deletingProvider,
    isSkillDialogOpen,
    setIsSkillDialogOpen,
    editingSkillId,
    editingBuiltInSlug,
    skillForm,
    skillFormErrors,
    visibleSkillFormErrors,
    skillFormTouched,
    hasAttemptedSkillSubmit,
    isSkillFormValid,
    touchSkillField,
    updateSkillForm,
    startCreateSkill,
    startEditBuiltInSkill,
    startEditSkill,
    cancelSkillEdit,
    saveSkill,
    deleteSkill,
    pendingSkillDeletion,
    requestDeleteSkill,
    cancelDeleteSkill,
    confirmDeleteSkill,
    toggleBuiltInToolEnabled,
    toggleBuiltInSkillEnabled,
    toggleCustomSkillEnabled,
  };
}
