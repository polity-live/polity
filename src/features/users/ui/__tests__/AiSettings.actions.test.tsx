/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AiSettingsTab } from '../AiSettingsTab';

const mocks = vi.hoisted(() => ({
  ai: {} as any,
  probeAll: false,
}));

vi.mock('../../hooks/useAiSettingsTab', () => ({
  useAiSettingsTab: () => mocks.ai,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/features/shared/ui/form', () => ({
  InlineSwitch: ({ onCheckedChange, ...props }: any) => (
    <button type="button" onClick={() => onCheckedChange(true)} {...props}>
      Toggle
    </button>
  ),
  FormFieldShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PasswordField: (props: any) => <input value={props.value} onChange={props.onChange} />,
  TextField: (props: any) => <input value={props.value} onChange={() => undefined} />,
}));
vi.mock('@/features/shared/ui/hashtags', () => ({ HashtagInput: () => null }));
vi.mock('@/features/shared/ui/data-table', () => ({
  DataTable: (props: any) => (
    <div>
      {props.data?.map((item: any) => (
        <span key={props.getRowId?.(item)} />
      ))}
    </div>
  ),
}));
vi.mock('@/features/shared/ui/dialog', () => ({
  DangerConfirmDialog: () => null,
  ScrollableDialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/ui/dialog', () => ({
  Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: ReactNode }) => <footer>{children}</footer>,
  DialogHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

vi.mock('../AiSettingsTabView', () => ({
  AiSettingsTabView: (props: any) => {
    const cell = (columns: any[], id: string, original: any) => {
      const column = columns.find(item => item.id === id || item.accessorKey === id);
      return column?.cell?.({ row: { original } }) ?? null;
    };
    if (!mocks.probeAll)
      return (
        <div>
          {cell(props.toolColumns, 'enabled', { name: 'search' })}
          {cell(props.builtInSkillColumns, 'enabled', { slug: 'summary', name: 'Summary' })}
          {cell(props.builtInSkillColumns, 'actions', { slug: 'summary', name: 'Summary' })}
          {cell(props.customSkillColumns, 'enabled', {
            id: 'custom-1',
            slug: 'custom',
            enabled: false,
          })}
          {cell(props.customSkillColumns, 'actions', {
            id: 'custom-1',
            slug: 'custom',
            enabled: false,
          })}
        </div>
      );

    const renderRows = (columns: any[], rows: any[]) =>
      rows.flatMap((original, rowIndex) =>
        columns.map((column, columnIndex) => (
          <div key={`${rowIndex}-${columnIndex}`}>
            {column.cell?.({ row: { original } }) ?? String(original[column.accessorKey] ?? '')}
          </div>
        ))
      );

    return (
      <div>
        {renderRows(props.modelColumns, props.ai.models)}
        {renderRows(props.toolColumns, props.ai.builtInTools)}
        {renderRows(props.builtInSkillColumns, props.ai.builtInSkills)}
        {renderRows(props.customSkillColumns, props.customSkills)}
        {props.aiSettingsOverviewCard}
        {props.availableModelsCard}
        <span>{props.skillDialogTitle}</span>
        <span>{props.skillDialogDescription}</span>
        <span>{String(props.skillFieldEvaluated.name)}</span>
        <span>{String(props.skillFieldEvaluated.slug)}</span>
        <span>{String(props.skillFieldEvaluated.aliases)}</span>
        <span>{String(props.skillFieldEvaluated.systemPrompt)}</span>
      </div>
    );
  },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mocks.probeAll = false;
});

describe('AI settings action contracts', () => {
  it('wires built-in and custom table actions to stable row intents', () => {
    mocks.ai = {
      hasAttemptedSkillSubmit: false,
      skillFormTouched: { name: false, slug: false, aliases: false, systemPrompt: false },
      builtInSkills: [{ slug: 'summary', name: 'Summary', aliases: [] }],
      builtInTools: [{ name: 'search' }],
      skills: [{ id: 'custom-1', slug: 'custom', name: 'Custom', aliases: '', enabled: false }],
      tools: [],
      models: [],
      editingBuiltInSlug: null,
      editingSkillId: null,
      toggleBuiltInToolEnabled: vi.fn(),
      toggleBuiltInSkillEnabled: vi.fn(),
      startEditBuiltInSkill: vi.fn(),
      toggleCustomSkillEnabled: vi.fn(),
      startEditSkill: vi.fn(),
      requestDeleteSkill: vi.fn(),
    };
    render(<AiSettingsTab />);

    for (const id of [
      'built-in-tool.toggle',
      'built-in-skill.toggle',
      'built-in-skill.edit',
      'custom-skill.toggle',
      'custom-skill.edit',
      'custom-skill.delete',
    ]) {
      fireEvent.click(document.querySelector(`[data-action-id="users.ai.${id}"]`)!);
    }
    expect(mocks.ai.toggleBuiltInToolEnabled).toHaveBeenCalledWith('search', true);
    expect(mocks.ai.startEditBuiltInSkill).toHaveBeenCalledWith('summary');
    expect(mocks.ai.requestDeleteSkill).toHaveBeenCalledWith('custom-1');
  });

  it('renders every model, tool, built-in, override, and custom column state', () => {
    mocks.probeAll = true;
    mocks.ai = {
      hasAttemptedSkillSubmit: false,
      skillFormTouched: { name: true, slug: false, aliases: true, systemPrompt: false },
      builtInSkills: [
        { slug: 'default-skill', name: 'Default', aliases: [] },
        { slug: 'overridden-skill', name: 'Built in', aliases: ['builtin'] },
      ],
      builtInTools: [
        { name: 'create-tool', label: 'Create', kind: 'create', description: 'Create things' },
        { name: 'update-tool', label: 'Update', kind: 'update', description: 'Update things' },
        { name: 'read-tool', label: 'Read', kind: 'read', description: 'Read things' },
      ],
      skills: [
        {
          id: 'override-1',
          slug: 'overridden-skill',
          name: 'Override',
          aliases: null,
          enabled: false,
        },
        { id: 'custom-empty', slug: 'custom-empty', name: 'Empty', aliases: null, enabled: true },
        {
          id: 'custom-aliases',
          slug: 'custom-aliases',
          name: 'Aliases',
          aliases: 'one, two',
          enabled: false,
        },
      ],
      tools: [{ id: 'tool-override', tool_name: 'update-tool', enabled: false }],
      models: [
        {
          id: 'none',
          label: 'None',
          provider: 'openai',
          context_window: null,
          source: 'byok',
          free: false,
        },
        {
          id: 'million',
          label: 'Million',
          provider: 'openrouter',
          context_window: 1_500_000,
          source: 'app',
          free: true,
        },
        {
          id: 'thousand',
          label: 'Thousand',
          provider: 'anthropic',
          context_window: 12_500,
          source: 'byok',
          free: true,
        },
        {
          id: 'small',
          label: 'Small',
          provider: 'openai',
          context_window: 512,
          source: 'app',
          free: false,
        },
      ],
      editingBuiltInSlug: null,
      editingSkillId: null,
      toggleBuiltInToolEnabled: vi.fn(),
      toggleBuiltInSkillEnabled: vi.fn(),
      startEditBuiltInSkill: vi.fn(),
      toggleCustomSkillEnabled: vi.fn(),
      startEditSkill: vi.fn(),
      requestDeleteSkill: vi.fn(),
    };

    const { rerender } = render(<AiSettingsTab />);
    expect(document.body.textContent).toContain('1.5M');
    expect(document.body.textContent).toContain('13k');
    expect(document.body.textContent).toContain('512');
    expect(document.body.textContent).toContain('generated.inline.0176_none_71f8e797');

    mocks.ai = {
      ...mocks.ai,
      hasAttemptedSkillSubmit: true,
      skillFormTouched: { name: false, slug: false, aliases: false, systemPrompt: false },
      editingSkillId: 'custom-empty',
      editingBuiltInSlug: 'overridden-skill',
    };
    rerender(<AiSettingsTab />);
    expect(document.body.textContent).toContain('pages.user.ai.editBuiltInDescription');
  });
});
