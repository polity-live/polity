/* @vitest-environment jsdom */

import { createRef } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  AssistantMessageInputView,
  type AssistantMessageInputViewProps,
} from '../AssistantMessageInputView';

afterEach(cleanup);

function assistantChat(overrides: Record<string, unknown> = {}) {
  return {
    selectedSkills: [],
    selectedAttachments: [],
    isUploadingAttachments: false,
    uploadingAttachmentName: null,
    selectedModelKey: '',
    setSelectedModelKey: vi.fn(),
    selectedModel: null,
    models: [],
    reasoningEffort: 'medium',
    setReasoningEffort: vi.fn(),
    selectedTools: [],
    availableSkills: [],
    setToolSelection: vi.fn(),
    setSkillSelection: vi.fn(),
    removeAttachment: vi.fn(),
    addUploadedFiles: vi.fn(),
    isSending: false,
    ...overrides,
  };
}

function viewProps(overrides: Partial<AssistantMessageInputViewProps> = {}) {
  return {
    assistantChat: assistantChat(),
    t: (key: string) => key,
    textareaRef: createRef<HTMLTextAreaElement>(),
    messageText: '',
    setMessageText: vi.fn(),
    caretPosition: 0,
    setCaretPosition: vi.fn(),
    suggestionAnchorPosition: null,
    setSuggestionAnchorPosition: vi.fn(),
    textareaScrollVersion: 0,
    setTextareaScrollVersion: vi.fn(),
    createSkillOpen: true,
    setCreateSkillOpen: vi.fn(),
    assistantSettingsOpen: true,
    setAssistantSettingsOpen: vi.fn(),
    skillName: '',
    setSkillName: vi.fn(),
    skillSlug: '',
    setSkillSlug: vi.fn(),
    skillAliases: ' one, ,two ',
    setSkillAliases: vi.fn(),
    skillPrompt: '',
    setSkillPrompt: vi.fn(),
    selectedSkillKeySet: new Set<string>(),
    selectedToolKeySet: new Set<string>(),
    searchTools: [],
    createTools: [],
    updateTools: [],
    mentionQuery: null,
    skillCommand: '',
    toolCommand: '',
    selectedAttachmentKeys: new Set<string>(),
    attachmentTypeSuggestions: [],
    attachmentSuggestions: [],
    skillSuggestions: [],
    toolSuggestions: [],
    hasSuggestionPanel: false,
    suggestionAnchorIndex: 0,
    freeRouterLabel: 'Free router',
    freeRouterMessage: 'Free route',
    reliabilityMessage: 'Reliability',
    freeRouterModelKey: 'provider:free',
    getModelDisplayLabel: (model: any) => model.name,
    selectedModelHint: null,
    updateCaretPosition: vi.fn(),
    moveCaret: vi.fn(),
    applyMessageReplacement: vi.fn(),
    handleAttachmentTypeSelect: vi.fn(),
    handleAttachmentSelect: vi.fn(),
    handleSkillSelect: vi.fn(),
    handleToolSelect: vi.fn(),
    resetSkillForm: vi.fn(),
    handleCreateSkill: vi.fn(),
    handleSubmit: vi.fn(),
    ...overrides,
  } satisfies AssistantMessageInputViewProps;
}

function prompt() {
  return document.querySelector(
    '[data-action-id="messages.assistant.prompt.change"]'
  ) as HTMLTextAreaElement;
}

describe('AssistantMessageInputView remaining branches', () => {
  it('handles every prompt key path in priority order', () => {
    const setTextareaScrollVersion = vi.fn((update: (value: number) => number) => update(1));
    const base = viewProps({
      messageText: 'Question',
      setTextareaScrollVersion,
      hasSuggestionPanel: true,
      suggestionAnchorPosition: { left: 0, top: 0, width: 320 },
    });
    const rendered = render(<AssistantMessageInputView {...base} />);
    fireEvent.scroll(prompt());
    Object.defineProperty(prompt(), 'selectionStart', { configurable: true, value: null });
    fireEvent.change(prompt(), { target: { value: 'Changed' } });
    base.textareaRef.current = null;
    fireEvent.keyDown(prompt(), { key: 'Escape' });
    fireEvent.keyDown(prompt(), { key: 'a' });
    fireEvent.keyDown(prompt(), { key: 'Enter', shiftKey: true });
    fireEvent.keyDown(prompt(), { key: 'Enter' });
    expect(base.handleSubmit).toHaveBeenCalledOnce();

    const cases = [
      {
        props: { skillSuggestions: [{ slug: 'skill-1', name: 'Skill', isBuiltIn: true }] },
        assertion: () => expect(base.handleSkillSelect).toHaveBeenCalledWith('skill-1'),
      },
      {
        props: { toolSuggestions: [{ name: 'tool-1' }] },
        assertion: () => expect(base.handleToolSelect).toHaveBeenCalledWith('tool-1'),
      },
      {
        props: {
          attachmentSuggestions: [
            { key: 'group:1', entityType: 'group', label: 'Group', subtitle: 'Subtitle' },
          ],
        },
        assertion: () => expect(base.handleAttachmentSelect).toHaveBeenCalled(),
      },
      {
        props: { attachmentTypeSuggestions: [{ entityType: 'group' }] },
        assertion: () => expect(base.handleAttachmentTypeSelect).toHaveBeenCalledWith('group'),
      },
    ];
    for (const testCase of cases) {
      rendered.rerender(<AssistantMessageInputView {...base} {...testCase.props} />);
      fireEvent.keyDown(prompt(), { key: 'Enter' });
      testCase.assertion();
    }
  });

  it('formats all context-window ranges and renders selected and placeholder model states', () => {
    const models = [
      { provider: 'provider', id: 'none', name: 'None', context_window: 0, source: 'byok' },
      { provider: 'provider', id: 'small', name: 'Small', context_window: 999, free: true },
      { provider: 'provider', id: 'large', name: 'Large', context_window: 2_000_000 },
      { provider: 'provider', id: 'free', name: 'Free route', context_window: 1_000 },
    ];
    const base = viewProps({
      assistantChat: assistantChat({ models, reasoningEffort: 'unsupported' }),
    });
    const rendered = render(<AssistantMessageInputView {...base} />);
    expect(screen.getByText('features.messages.ai.modelPlaceholder')).toBeTruthy();
    expect(screen.getByText(/n\/a/)).toBeTruthy();
    expect(screen.getByText(/999/)).toBeTruthy();
    expect(screen.getByText(/2.0M/)).toBeTruthy();

    rendered.rerender(
      <AssistantMessageInputView
        {...base}
        selectedModelHint={{ message: 'Model warning', className: 'warning' }}
        assistantChat={assistantChat({
          models,
          selectedModelKey: 'provider:none',
          selectedModel: models[0],
          reasoningEffort: 'unsupported',
        })}
      />
    );
    expect(screen.getByLabelText('Model warning')).toBeTruthy();
  });

  it('renders uploading, sending, always-active, selected and unselected tool and skill states', () => {
    const chat = assistantChat({
      selectedSkills: [{ slug: 'selected', name: 'Selected' }],
      selectedAttachments: [{ entityType: 'group', entityId: '1', title: 'Group' }],
      isUploadingAttachments: true,
      uploadingAttachmentName: 'context.pdf',
      selectedModel: { provider: 'p', id: 'm', name: 'Model', context_window: 500 },
      selectedModelKey: 'p:m',
      models: [],
      isSending: true,
      availableSkills: [
        { slug: 'selected', name: 'Selected', aliases: [] },
        { slug: 'plain', name: 'Plain', aliases: [] },
      ],
    });
    const base = viewProps({
      assistantChat: chat,
      messageText: 'Send',
      selectedSkillKeySet: new Set(['selected']),
      selectedToolKeySet: new Set(['selected-tool', 'plain-tool', 'update-tool']),
      searchTools: [
        { name: 'always', label: 'Always', description: 'Always', alwaysActive: true },
        { name: 'selected-tool', label: 'Selected', description: 'Selected' },
      ],
      createTools: [{ name: 'plain-tool', label: 'Plain', description: 'Plain' }],
      updateTools: [{ name: 'update-tool', label: 'Update', description: 'Update' }],
    });
    const rendered = render(<AssistantMessageInputView {...base} />);
    expect(rendered.container.textContent).toContain('context.pdf');

    rendered.rerender(
      <AssistantMessageInputView
        {...base}
        assistantChat={assistantChat({
          selectedModel: null,
          isUploadingAttachments: true,
          uploadingAttachmentName: null,
        })}
      />
    );
    rendered.rerender(
      <AssistantMessageInputView
        {...base}
        messageText=""
        assistantChat={assistantChat({ selectedModel: null, isUploadingAttachments: false })}
      />
    );
  });

  it('executes skill form field callbacks and both slug-placeholder branches', () => {
    const base = viewProps({ skillName: '', skillSlug: '', skillPrompt: '' });
    const rendered = render(<AssistantMessageInputView {...base} />);
    const inputs = [...document.querySelectorAll('input')].filter(
      input => input.type !== 'file' && input.type !== 'hidden'
    );
    const textareas = document.querySelectorAll('textarea');

    fireEvent.change(inputs[0], { target: { value: 'Planner' } });
    fireEvent.change(inputs[1], { target: { value: 'planner' } });
    if (inputs[2]) {
      fireEvent.change(inputs[2], { target: { value: 'three' } });
      fireEvent.keyDown(inputs[2], { key: 'Enter' });
    }
    fireEvent.change(textareas[textareas.length - 1], { target: { value: 'Prompt' } });
    expect(base.setSkillName).toHaveBeenCalledWith('Planner');
    expect(base.setSkillSlug).toHaveBeenCalledWith('planner');
    expect(base.setSkillPrompt).toHaveBeenCalledWith('Prompt');

    rendered.rerender(<AssistantMessageInputView {...base} skillName="Campaign Planner" />);
    expect(document.querySelector('input[placeholder="campaign-planner"]')).toBeTruthy();
  });
});
