/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AiSettingsTabView } from '../AiSettingsTabView';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));
vi.mock('@/features/shared/ui/data-table', () => ({
  DataTable: (props: any) => (
    <div>
      {props.data?.map((item: any) => (
        <span key={props.getRowId?.(item)} />
      ))}
    </div>
  ),
}));
vi.mock('@/features/shared/ui/hashtags', () => ({
  HashtagInput: (props: any) => (
    <button type="button" data-testid="alias-change" onClick={() => props.onChange(['one', 'two'])}>
      aliases
    </button>
  ),
}));
vi.mock('@/features/shared/ui/form', () => ({
  FormFieldShell: ({ children }: { children: ReactNode | ((props: any) => ReactNode) }) => (
    <div>{typeof children === 'function' ? children({ id: 'aliases-id' }) : children}</div>
  ),
  PasswordField: (props: any) => (
    <input data-testid={props.id} value={props.value} onChange={props.onChange} />
  ),
  TextField: (props: any) => (
    <div>
      <button
        type="button"
        data-testid={`${props.id}-value`}
        onClick={() => props.onValueChange?.('new value')}
      >
        value
      </button>
      <button type="button" data-testid={`${props.id}-blur`} onClick={() => props.onBlur?.()}>
        blur
      </button>
    </div>
  ),
}));
vi.mock('@/features/shared/ui/dialog', () => ({
  DangerConfirmDialog: (props: any) => (
    <div>
      <span>{props.description}</span>
      <button type="button" data-testid="danger-open" onClick={() => props.onOpenChange(true)} />
      <button type="button" data-testid="danger-close" onClick={() => props.onOpenChange(false)} />
      <button type="button" data-testid="danger-confirm" onClick={props.onConfirm} />
    </div>
  ),
  ScrollableDialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/ui/dialog', () => ({
  Dialog: ({ children, onOpenChange }: any) => (
    <div>
      {children}
      <button type="button" data-testid="dialog-open" onClick={() => onOpenChange(true)} />
      <button type="button" data-testid="dialog-close" onClick={() => onOpenChange(false)} />
    </div>
  ),
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: ReactNode }) => <footer>{children}</footer>,
  DialogHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

afterEach(cleanup);

describe('AiSettingsTabView action contracts', () => {
  it('creates skills, mutates credentials, and closes or saves the skill dialog', () => {
    const ai = {
      builtInTools: [],
      builtInSkills: [],
      credentialsByProvider: {
        openrouter: { has_key: true },
        openai: { has_key: true },
        anthropic: { has_key: true },
      },
      providerInputs: { openrouter: '', openai: '', anthropic: '' },
      savingProvider: null,
      deletingProvider: null,
      updateProviderInput: vi.fn(),
      saveCredential: vi.fn(),
      deleteCredential: vi.fn(),
      startCreateSkill: vi.fn(),
      isSkillDialogOpen: true,
      setIsSkillDialogOpen: vi.fn(),
      cancelSkillEdit: vi.fn(),
      skillForm: { name: '', slug: '', aliases: '', systemPrompt: '' },
      touchSkillField: vi.fn(),
      updateSkillForm: vi.fn(),
      visibleSkillFormErrors: {
        name: null,
        slug: null,
        aliases: null,
        systemPrompt: 'Prompt error',
      },
      isSkillFormValid: true,
      saveSkill: vi.fn(),
      editingSkillId: null,
      pendingSkillDeletion: null,
      cancelDeleteSkill: vi.fn(),
      confirmDeleteSkill: vi.fn(),
    };
    render(
      <AiSettingsTabView
        {...({
          t: (key: string) => key,
          ai,
          skillFieldEvaluated: {
            name: false,
            slug: false,
            aliases: false,
            systemPrompt: false,
          },
          builtInSlugSet: new Set(),
          builtInOverridesBySlug: new Map(),
          builtInToolOverridesByName: new Map(),
          customSkills: [],
          isEditingBuiltIn: false,
          skillDialogTitle: 'Skill',
          skillDialogDescription: 'Description',
          modelColumns: [],
          toolColumns: [],
          builtInSkillColumns: [],
          customSkillColumns: [],
          aiSettingsOverviewCard: null,
          availableModelsCard: null,
        } as any)}
      />
    );

    fireEvent.click(document.querySelector('[data-action-id="users.ai.custom-skill.create"]')!);
    fireEvent.click(document.querySelector('[data-action-id="users.ai.credential.save"]')!);
    fireEvent.click(document.querySelector('[data-action-id="users.ai.credential.delete"]')!);
    fireEvent.click(document.querySelector('[data-action-id="users.ai.skill-dialog.cancel"]')!);
    fireEvent.click(document.querySelector('[data-action-id="users.ai.skill-dialog.save"]')!);
    expect(ai.startCreateSkill).toHaveBeenCalledOnce();
    expect(ai.saveCredential).toHaveBeenCalledWith('openrouter');
    expect(ai.deleteCredential).toHaveBeenCalledWith('openrouter');
    expect(ai.cancelSkillEdit).toHaveBeenCalledOnce();
    expect(ai.saveSkill).toHaveBeenCalledOnce();
  });

  it('covers provider, form-validation, dialog, and deletion presentation states', () => {
    const ai = {
      builtInTools: [{ name: 'search' }],
      builtInSkills: [{ slug: 'summary' }],
      credentialsByProvider: {
        openrouter: {
          has_key: true,
          key_hint: 'sk-…1234',
          updated_at: '2026-01-01T12:00:00.000Z',
        },
        openai: { has_key: false, key_hint: null, updated_at: null },
        anthropic: { has_key: true, key_hint: null, updated_at: null },
      },
      providerInputs: { openrouter: 'or-key', openai: '', anthropic: 'an-key' },
      savingProvider: 'openrouter',
      deletingProvider: 'anthropic',
      updateProviderInput: vi.fn(),
      saveCredential: vi.fn(),
      deleteCredential: vi.fn(),
      startCreateSkill: vi.fn(),
      isSkillDialogOpen: true,
      setIsSkillDialogOpen: vi.fn(),
      cancelSkillEdit: vi.fn(),
      skillForm: {
        name: '',
        slug: 'valid-slug',
        aliases: '',
        systemPrompt: 'Prompt',
      },
      touchSkillField: vi.fn(),
      updateSkillForm: vi.fn(),
      visibleSkillFormErrors: {
        name: 'Name required',
        slug: null,
        aliases: null,
        systemPrompt: null,
      },
      isSkillFormValid: false,
      saveSkill: vi.fn(),
      editingSkillId: 'skill-1',
      pendingSkillDeletion: { id: 'skill-1', name: 'Delete me' },
      cancelDeleteSkill: vi.fn(),
      confirmDeleteSkill: vi.fn(),
    };
    const props = {
      t: (key: string) => key,
      ai,
      skillFieldEvaluated: { name: true, slug: true, aliases: false, systemPrompt: true },
      builtInSlugSet: new Set(),
      builtInOverridesBySlug: new Map(),
      builtInToolOverridesByName: new Map(),
      customSkills: [{ id: 'custom-1' }],
      isEditingBuiltIn: true,
      skillDialogTitle: 'Edit skill',
      skillDialogDescription: 'Edit description',
      modelColumns: [],
      toolColumns: [],
      builtInSkillColumns: [],
      customSkillColumns: [],
      aiSettingsOverviewCard: <div>Overview</div>,
      availableModelsCard: <div>Models</div>,
    };
    const { rerender } = render(<AiSettingsTabView {...(props as any)} />);

    fireEvent.change(document.querySelector('[data-testid="ai-provider-openrouter"]')!, {
      target: { value: 'new-key' },
    });
    expect(ai.updateProviderInput).toHaveBeenCalledWith('openrouter', 'new-key');
    for (const id of [
      'ai-skill-name-value',
      'ai-skill-name-blur',
      'ai-skill-slug-value',
      'ai-skill-slug-blur',
      'ai-skill-prompt-value',
      'ai-skill-prompt-blur',
      'alias-change',
      'dialog-open',
      'dialog-close',
      'danger-open',
      'danger-close',
      'danger-confirm',
    ]) {
      fireEvent.click(document.querySelector(`[data-testid="${id}"]`)!);
    }
    expect(ai.setIsSkillDialogOpen).toHaveBeenCalledWith(true);
    expect(ai.cancelSkillEdit).toHaveBeenCalled();
    expect(ai.touchSkillField).toHaveBeenCalledWith('aliases');
    expect(ai.updateSkillForm).toHaveBeenCalledWith('aliases', 'one,two');
    expect(ai.cancelDeleteSkill).toHaveBeenCalled();
    expect(ai.confirmDeleteSkill).toHaveBeenCalled();
    expect(document.body.textContent).toContain('sk-…1234');

    rerender(
      <AiSettingsTabView
        {...({
          ...props,
          ai: {
            ...ai,
            skillForm: { ...ai.skillForm, name: 'Name', systemPrompt: '' },
            visibleSkillFormErrors: {
              name: null,
              slug: 'Bad slug',
              aliases: 'Bad aliases',
              systemPrompt: null,
            },
            editingSkillId: null,
            pendingSkillDeletion: null,
          },
          skillFieldEvaluated: {
            name: true,
            slug: true,
            aliases: true,
            systemPrompt: true,
          },
          isEditingBuiltIn: false,
        } as any)}
      />
    );
    expect(document.body.textContent).toContain('pages.user.ai.skills.create');

    rerender(
      <AiSettingsTabView
        {...({
          ...props,
          ai: {
            ...ai,
            visibleSkillFormErrors: {
              name: null,
              slug: null,
              aliases: null,
              systemPrompt: null,
            },
          },
          skillFieldEvaluated: {
            name: false,
            slug: false,
            aliases: false,
            systemPrompt: false,
          },
        } as any)}
      />
    );
  });
});
