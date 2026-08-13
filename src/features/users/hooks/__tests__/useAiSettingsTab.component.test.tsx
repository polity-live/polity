/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAiSettingsTab } from '../useAiSettingsTab';

const mocks = vi.hoisted(() => ({
  session: null as { access_token: string } | null,
  skills: [] as any[],
  tools: [] as any[],
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  createSkill: vi.fn(),
  updateSkill: vi.fn(),
  deleteSkill: vi.fn(),
  createTool: vi.fn(),
  updateTool: vi.fn(),
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ session: mocks.session }),
}));

vi.mock('@/zero/ai/useAiState', () => ({
  useAiState: () => ({ skills: mocks.skills, tools: mocks.tools }),
}));

vi.mock('@/zero/ai/useAiActions', () => ({
  useAiActions: () => ({
    createSkill: mocks.createSkill,
    updateSkill: mocks.updateSkill,
    deleteSkill: mocks.deleteSkill,
    createTool: mocks.createTool,
    updateTool: mocks.updateTool,
  }),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}));

function response(options: { ok?: boolean; text?: string; json?: Record<string, unknown> }) {
  return {
    ok: options.ok ?? true,
    text: vi.fn().mockResolvedValue(options.text ?? 'request failed'),
    json: vi.fn().mockResolvedValue(options.json ?? {}),
  } as unknown as Response;
}

beforeEach(() => {
  mocks.session = null;
  mocks.skills = [];
  mocks.tools = [];
  vi.clearAllMocks();
  vi.stubGlobal('fetch', vi.fn());
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('useAiSettingsTab', () => {
  it('provides credential defaults and exposes validation only after touch or submit', async () => {
    const { result } = renderHook(() => useAiSettingsTab());

    expect(fetch).not.toHaveBeenCalled();
    expect(result.current.credentialsByProvider).toEqual({
      openrouter: { provider: 'openrouter', has_key: false, key_hint: null, updated_at: null },
      openai: { provider: 'openai', has_key: false, key_hint: null, updated_at: null },
      anthropic: { provider: 'anthropic', has_key: false, key_hint: null, updated_at: null },
    });
    expect(result.current.isSkillFormValid).toBe(false);
    expect(result.current.visibleSkillFormErrors.name).toBeNull();

    act(() => {
      result.current.touchSkillField('name');
      result.current.touchSkillField('name');
      result.current.updateSkillForm('slug', 'Bad Slug');
      result.current.updateSkillForm('aliases', 'valid,bad alias');
    });
    expect(result.current.visibleSkillFormErrors.name).toBe('pages.user.ai.skills.validationName');
    expect(result.current.skillFormErrors.slug).toBe('pages.user.ai.skills.validationSlugPattern');
    expect(result.current.skillFormErrors.aliases).toBe(
      'pages.user.ai.skills.validationAliasPattern'
    );

    act(() => result.current.saveSkill());
    expect(result.current.hasAttemptedSkillSubmit).toBe(true);
    expect(result.current.visibleSkillFormErrors.systemPrompt).toBe(
      'pages.user.ai.skills.validationPrompt'
    );
    expect(mocks.toastError).toHaveBeenCalledWith('pages.user.ai.skills.validation');

    await act(async () => {
      await result.current.saveCredential('openai');
      await result.current.deleteCredential('openai');
      await result.current.loadCatalog();
    });
    expect(mocks.toastError).toHaveBeenCalledWith('features.messages.ai.sessionMissing');
  });

  it('loads, saves, and deletes credentials across success and transport failures', async () => {
    mocks.session = { access_token: 'token-1' };
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(
        response({
          json: {
            credentials: [
              {
                provider: 'openai',
                has_key: true,
                key_hint: 'sk-…1234',
                updated_at: 'now',
              },
            ],
            models: [{ provider: 'openai', id: 'model-1', label: 'Model' }],
          },
        })
      )
      .mockResolvedValueOnce(response({ json: { credentials: undefined, models: undefined } }))
      .mockResolvedValueOnce(response({ json: { credentials: [], models: [] } }))
      .mockResolvedValueOnce(response({ ok: false, text: 'catalog failed' }))
      .mockRejectedValueOnce(new Error('save network'))
      .mockRejectedValueOnce(new Error('delete network'));

    const { result } = renderHook(() => useAiSettingsTab());
    await waitFor(() => expect(result.current.isCatalogLoading).toBe(false));
    expect(result.current.credentialsByProvider.openai).toMatchObject({
      has_key: true,
      key_hint: 'sk-…1234',
    });
    expect(result.current.models).toHaveLength(1);
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/ai/catalog', {
      headers: { Authorization: 'Bearer token-1' },
    });

    await act(async () => result.current.saveCredential('anthropic'));
    expect(mocks.toastError).toHaveBeenCalledWith('pages.user.ai.credentials.validation');

    act(() => result.current.updateProviderInput('anthropic', '  key-value  '));
    await act(async () => result.current.saveCredential('anthropic'));
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/ai/credentials',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ provider: 'anthropic', apiKey: 'key-value' }),
      })
    );
    expect(result.current.providerInputs.anthropic).toBe('');
    expect(mocks.toastSuccess).toHaveBeenCalledWith('pages.user.ai.credentials.saved');

    await act(async () => result.current.deleteCredential('openai'));
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      '/api/ai/credentials',
      expect.objectContaining({ method: 'DELETE', body: JSON.stringify({ provider: 'openai' }) })
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith('pages.user.ai.credentials.deleted');

    await act(async () => result.current.loadCatalog());
    expect(mocks.toastError).toHaveBeenCalledWith(
      'generated.inline.1179_failed_to_load_ai_settings_809836c9'
    );

    act(() => result.current.updateProviderInput('openrouter', 'key'));
    await act(async () => result.current.saveCredential('openrouter'));
    expect(mocks.toastError).toHaveBeenCalledWith('pages.user.ai.credentials.saveFailed');
    await act(async () => result.current.deleteCredential('openrouter'));
    expect(mocks.toastError).toHaveBeenCalledWith('pages.user.ai.credentials.deleteFailed');

    fetchMock.mockResolvedValueOnce(response({ json: {} }));
    await act(async () => result.current.loadCatalog());
    expect(result.current.models).toEqual([]);
    expect(result.current.credentialsByProvider.openai.has_key).toBe(false);

    act(() => result.current.updateProviderInput('openai', 'key'));
    fetchMock.mockResolvedValueOnce(response({ ok: false, text: 'save rejected' }));
    await act(async () => result.current.saveCredential('openai'));
    fetchMock.mockResolvedValueOnce(response({ ok: false, text: 'delete rejected' }));
    await act(async () => result.current.deleteCredential('openai'));
    fetchMock.mockResolvedValueOnce(response({ json: {} }));
    await act(async () => result.current.deleteCredential('anthropic'));
    expect(result.current.savingProvider).toBeNull();
    expect(result.current.deletingProvider).toBeNull();
  });

  it('creates, edits, deletes, and toggles custom and built-in skills and tools', () => {
    mocks.skills = [
      {
        id: 'custom-1',
        slug: 'custom-skill',
        name: 'Custom Skill',
        aliases: null,
        system_prompt: 'Custom prompt',
        enabled: true,
      },
      {
        id: 'custom-empty',
        slug: 'custom-empty',
        name: 'Custom Empty',
        aliases: '',
        system_prompt: null,
        enabled: true,
      },
    ];
    const { result, rerender } = renderHook(() => useAiSettingsTab());
    const builtInSkill = result.current.builtInSkills[0];
    const builtInTool = result.current.builtInTools[0];

    act(() => {
      result.current.startEditSkill('missing');
      result.current.startEditBuiltInSkill('missing');
      result.current.requestDeleteSkill('missing');
      result.current.toggleCustomSkillEnabled('missing', false);
      result.current.toggleBuiltInSkillEnabled('missing', false);
      result.current.toggleBuiltInToolEnabled('missing' as any, false);
      result.current.confirmDeleteSkill();
    });
    expect(mocks.updateSkill).not.toHaveBeenCalled();

    act(() => result.current.startCreateSkill());
    act(() => {
      result.current.updateSkillForm('name', '  My New Skill  ');
      result.current.updateSkillForm('slug', '');
      result.current.updateSkillForm('aliases', 'first,second');
      result.current.updateSkillForm('systemPrompt', '  Do useful work  ');
    });
    expect(result.current.isSkillFormValid).toBe(true);
    act(() => result.current.saveSkill());
    expect(mocks.createSkill).toHaveBeenCalledWith({
      slug: 'my-new-skill',
      name: 'My New Skill',
      aliases: 'first,second',
      system_prompt: 'Do useful work',
    });
    expect(result.current.isSkillDialogOpen).toBe(false);

    act(() => result.current.startEditSkill('custom-1'));
    expect(result.current.skillForm).toMatchObject({
      name: 'Custom Skill',
      slug: 'custom-skill',
      aliases: '',
      systemPrompt: 'Custom prompt',
    });
    act(() => result.current.updateSkillForm('name', 'Updated'));
    act(() => result.current.saveSkill());
    expect(mocks.updateSkill).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'custom-1', name: 'Updated' })
    );

    act(() => result.current.startEditSkill('custom-empty'));
    expect(result.current.skillForm.systemPrompt).toBe('');

    act(() => result.current.startCreateSkill());
    act(() => {
      result.current.updateSkillForm('name', 'Duplicate custom');
      result.current.updateSkillForm('slug', 'custom-skill');
      result.current.updateSkillForm('systemPrompt', 'Prompt');
    });
    act(() => result.current.saveSkill());
    expect(mocks.toastError).toHaveBeenCalledWith('pages.user.ai.skills.slugExists');

    act(() => result.current.startCreateSkill());
    act(() => {
      result.current.updateSkillForm('name', builtInSkill.name);
      result.current.updateSkillForm('slug', builtInSkill.slug);
      result.current.updateSkillForm('systemPrompt', 'Prompt');
    });
    act(() => result.current.saveSkill());
    expect(mocks.toastError).toHaveBeenCalledWith('pages.user.ai.skills.slugExists');

    act(() => result.current.startEditBuiltInSkill(builtInSkill.slug));
    expect(result.current.editingBuiltInSlug).toBe(builtInSkill.slug);
    act(() => result.current.saveSkill());
    expect(mocks.createSkill).toHaveBeenCalledWith(
      expect.objectContaining({ slug: builtInSkill.slug })
    );

    act(() => result.current.toggleBuiltInSkillEnabled(builtInSkill.slug, true));
    expect(mocks.createSkill).toHaveBeenCalledTimes(2);
    act(() => result.current.toggleBuiltInSkillEnabled(builtInSkill.slug, false));
    expect(mocks.createSkill).toHaveBeenLastCalledWith(
      expect.objectContaining({ slug: builtInSkill.slug, enabled: false })
    );
    act(() => result.current.toggleBuiltInToolEnabled(builtInTool.name, true));
    expect(mocks.createTool).not.toHaveBeenCalled();
    act(() => result.current.toggleBuiltInToolEnabled(builtInTool.name, false));
    expect(mocks.createTool).toHaveBeenCalledWith({ tool_name: builtInTool.name, enabled: false });

    act(() => result.current.toggleCustomSkillEnabled('custom-1', false));
    expect(mocks.updateSkill).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'custom-1', enabled: false, aliases: '' })
    );

    mocks.skills = [
      ...mocks.skills,
      {
        id: 'override-1',
        slug: builtInSkill.slug,
        name: 'Override',
        aliases: null,
        system_prompt: 'Override prompt',
      },
    ];
    mocks.tools = [{ id: 'tool-override', tool_name: builtInTool.name, enabled: false }];
    rerender();
    act(() => result.current.startEditBuiltInSkill(builtInSkill.slug));
    expect(result.current.editingSkillId).toBe('override-1');
    act(() => result.current.toggleBuiltInSkillEnabled(builtInSkill.slug, true));
    expect(mocks.updateSkill).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'override-1', enabled: true, aliases: '' })
    );
    act(() => result.current.toggleBuiltInToolEnabled(builtInTool.name, true));
    expect(mocks.updateTool).toHaveBeenCalledWith({
      id: 'tool-override',
      tool_name: builtInTool.name,
      enabled: true,
    });

    act(() => result.current.requestDeleteSkill('custom-1'));
    expect(result.current.pendingSkillDeletion).toEqual({
      id: 'custom-1',
      name: 'Custom Skill',
    });
    act(() => result.current.cancelDeleteSkill());
    expect(result.current.pendingSkillDeletion).toBeNull();
    act(() => result.current.requestDeleteSkill('custom-1'));
    act(() => result.current.confirmDeleteSkill());
    expect(mocks.deleteSkill).toHaveBeenCalledWith('custom-1');
    expect(result.current.pendingSkillDeletion).toBeNull();

    act(() => result.current.startEditSkill('custom-1'));
    act(() => result.current.deleteSkill('custom-1'));
    expect(result.current.isSkillDialogOpen).toBe(false);
    act(() => result.current.cancelSkillEdit());
  });
});
