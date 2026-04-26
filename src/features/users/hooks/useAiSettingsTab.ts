import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { DEFAULT_AI_SKILLS } from '@/features/assistant/logic/defaultAiSkills';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useAuth } from '@/providers/auth-provider';
import type { AiProvider } from '@/server/ai-types';
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

interface SkillFormErrors {
  name: string | null;
  slug: string | null;
  aliases: string | null;
  systemPrompt: string | null;
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

const SKILL_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function useAiSettingsTab() {
  const { session } = useAuth();
  const { t } = useTranslation();
  const { skills } = useAiState();
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
      toast.error('Failed to load AI settings.');
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
        toast.error(
          t(
            'features.messages.ai.sessionMissing',
            'Your session has expired. Please sign in again.'
          )
        );
        return;
      }

      const apiKey = providerInputs[provider]?.trim();
      if (!apiKey) {
        toast.error(t('pages.user.ai.credentials.validation', 'Enter an API key first.'));
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
        toast.success(t('pages.user.ai.credentials.saved', 'API key saved'));
      } catch (error) {
        console.error(`Failed to save ${provider} credential:`, error);
        toast.error(t('pages.user.ai.credentials.saveFailed', 'Failed to save API key'));
      } finally {
        setSavingProvider(null);
      }
    },
    [providerInputs, session?.access_token, t, updateProviderInput]
  );

  const deleteCredential = useCallback(
    async (provider: AiProvider) => {
      if (!session?.access_token) {
        toast.error(
          t(
            'features.messages.ai.sessionMissing',
            'Your session has expired. Please sign in again.'
          )
        );
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
        toast.success(t('pages.user.ai.credentials.deleted', 'API key removed'));
      } catch (error) {
        console.error(`Failed to delete ${provider} credential:`, error);
        toast.error(t('pages.user.ai.credentials.deleteFailed', 'Failed to remove API key'));
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

  const skillFormErrors = useMemo<SkillFormErrors>(() => {
    const name = skillForm.name.trim();
    const rawSlug = skillForm.slug.trim();
    const resolvedSlug = editingBuiltInSlug || rawSlug || slugifySkillName(name);
    const aliases = skillForm.aliases
      .split(',')
      .map(alias => alias.trim())
      .filter(Boolean);

    const nameError = name ? null : t('pages.user.ai.skills.validationName', 'Name is required.');
    const slugError = editingBuiltInSlug
      ? null
      : !resolvedSlug
        ? t('pages.user.ai.skills.validationSlug', 'Slug is required.')
        : SKILL_SLUG_PATTERN.test(resolvedSlug)
          ? null
          : t(
              'pages.user.ai.skills.validationSlugPattern',
              'Skill slug may only contain letters, numbers, and hyphens'
            );
    const aliasesError = aliases.every(alias => SKILL_SLUG_PATTERN.test(alias))
      ? null
      : t(
          'pages.user.ai.skills.validationAliasPattern',
          'Each alias may only contain letters, numbers, and hyphens'
        );
    const systemPromptError = skillForm.systemPrompt.trim()
      ? null
      : t('pages.user.ai.skills.validationPrompt', 'System prompt is required.');

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

  const startCreateSkill = useCallback(() => {
    setIsSkillDialogOpen(true);
    setEditingSkillId(null);
    setEditingBuiltInSlug(null);
    setSkillForm(EMPTY_SKILL_FORM);
  }, []);

  const startEditSkill = useCallback(
    (skillId: string) => {
      const skill = skills.find(currentSkill => currentSkill.id === skillId);
      if (!skill) {
        return;
      }

      setEditingSkillId(skillId);
      setEditingBuiltInSlug(null);
      setIsSkillDialogOpen(true);
      setSkillForm({
        name: skill.name,
        slug: skill.slug,
        aliases: skill.aliases,
        systemPrompt: skill.system_prompt,
      });
    },
    [skills]
  );

  const startEditBuiltInSkill = useCallback(
    (skillSlug: string) => {
      const builtInSkill = builtInSkillBySlug.get(skillSlug);
      if (!builtInSkill) {
        return;
      }

      const customOverride = skills.find(skill => skill.slug === skillSlug) ?? null;

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
    [builtInSkillBySlug, skills]
  );

  const cancelSkillEdit = useCallback(() => {
    setIsSkillDialogOpen(false);
    setEditingSkillId(null);
    setEditingBuiltInSlug(null);
    setSkillForm(EMPTY_SKILL_FORM);
  }, []);

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
    const name = skillForm.name.trim();
    const slug = (editingBuiltInSlug || skillForm.slug.trim() || slugifySkillName(name)).trim();
    const systemPrompt = skillForm.systemPrompt.trim();

    if (!isSkillFormValid || !name || !slug || !systemPrompt) {
      toast.error(t('pages.user.ai.skills.validation', 'Name, slug, and prompt are required.'));
      return;
    }

    if (builtInSkillSlugs.has(slug) && !editingSkillId && !editingBuiltInSlug) {
      toast.error(
        t('pages.user.ai.skills.slugExists', 'This slug is reserved by a built-in skill.')
      );
      return;
    }

    const slugTakenByAnotherSkill = skills.some(
      skill => skill.slug === slug && skill.id !== editingSkillId
    );
    if (slugTakenByAnotherSkill) {
      toast.error(t('pages.user.ai.skills.slugExists', 'This skill slug already exists.'));
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

  return {
    builtInSkills: DEFAULT_AI_SKILLS,
    skills,
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
    isSkillFormValid,
    updateSkillForm,
    startCreateSkill,
    startEditBuiltInSkill,
    startEditSkill,
    cancelSkillEdit,
    saveSkill,
    deleteSkill,
  };
}
