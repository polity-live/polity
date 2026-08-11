/* @vitest-environment jsdom */

import { createRef, type ReactNode } from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AssistantMessageInputView } from '../AssistantMessageInputView';
import { MessageInputView } from '../MessageInputView';

vi.mock('@/features/shared/ui/form', async importOriginal => {
  const actual = await importOriginal<typeof import('@/features/shared/ui/form')>();
  const { createContext, useContext } = await import('react');
  const SelectContext = createContext<(value: string) => void>(() => undefined);
  return {
    ...actual,
    FormControlSelect: ({
      children,
      onValueChange,
      value: _value,
      disabled: _disabled,
      ...props
    }: any) => (
      <SelectContext.Provider value={onValueChange}>
        <div {...props}>{children}</div>
      </SelectContext.Provider>
    ),
    FormControlSelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    FormControlSelectItem: ({ children, value, textValue: _textValue, ...props }: any) => {
      const onValueChange = useContext(SelectContext);
      return (
        <button type="button" onClick={() => onValueChange(value)} {...props}>
          {children}
        </button>
      );
    },
    FormControlSelectTrigger: ({ children, ...props }: any) => (
      <button type="button" {...props}>
        {children}
      </button>
    ),
  };
});

vi.mock('@/features/shared/ui/ui/popover', () => ({
  Popover: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/features/shared/ui/ui/drawer', () => ({
  Drawer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DrawerContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DrawerDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DrawerHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
  DrawerTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

vi.mock('@/features/shared/ui/ui/dialog', () => ({
  Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: ReactNode }) => <footer>{children}</footer>,
  DialogHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

vi.mock('@/features/shared/ui/dialog', () => ({
  ScrollableDialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/features/shared/ui/ui/command', () => ({
  Command: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CommandEmpty: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CommandGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CommandInput: (props: any) => <input {...props} />,
  CommandItem: ({ children, onSelect, ...props }: any) => (
    <button type="button" onClick={onSelect} {...props}>
      {children}
    </button>
  ),
  CommandList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CommandSeparator: () => <hr />,
}));

vi.mock('@/features/shared/ui/hashtags', () => ({
  HashtagInput: (props: any) => <input aria-label="aliases" {...props} />,
}));

afterEach(cleanup);

const t = (key: string) => key;
const action = (id: string) => document.querySelector(`[data-action-id="${id}"]`) as HTMLElement;
const actions = (id: string) =>
  Array.from(document.querySelectorAll(`[data-action-id="${id}"]`)) as HTMLElement[];

describe('message composer action contracts', () => {
  it('runs regular composer input, attachment, suggestion, upload, send, and submit effects', () => {
    const attachments = {
      selectedAttachments: [{ entityType: 'document', entityId: 'document-1', title: 'Agenda' }],
      isUploadingAttachments: false,
      uploadingAttachmentName: null,
      addUploadedFiles: vi.fn(),
      removeAttachment: vi.fn(),
    };
    const setMessageText = vi.fn();
    const handleAttachmentTypeSelect = vi.fn();
    const handleAttachmentSelect = vi.fn();
    const handleSendMessage = vi.fn();
    render(
      <MessageInputView
        conversation={{ status: 'accepted' }}
        t={t}
        textareaRef={createRef<HTMLTextAreaElement>()}
        attachments={attachments}
        messageText="Hello"
        setMessageText={setMessageText}
        caretPosition={0}
        setCaretPosition={vi.fn()}
        suggestionAnchorPosition={{ left: 0, top: 0, width: 320 }}
        setSuggestionAnchorPosition={vi.fn()}
        textareaScrollVersion={0}
        setTextareaScrollVersion={vi.fn()}
        mentionQuery=""
        selectedAttachmentKeys={new Set()}
        attachmentTypeSuggestions={[{ entityType: 'group', label: 'Group', token: '@group' }]}
        attachmentSuggestions={[{ key: 'group:1', entityType: 'group', label: 'Council' }]}
        hasSuggestionPanel
        updateCaretPosition={vi.fn()}
        moveCaret={vi.fn()}
        applyMessageReplacement={vi.fn()}
        handleAttachmentTypeSelect={handleAttachmentTypeSelect}
        handleAttachmentSelect={handleAttachmentSelect}
        handleSendMessage={handleSendMessage}
        otherUser={null}
        otherParticipantName="Ada"
        isPendingDirectConversation={false}
        isConversationRequester={false}
      />
    );

    fireEvent.click(action('messages.composer.attachment.remove'));
    fireEvent.change(action('messages.composer.text.change'), {
      target: { value: 'Updated', selectionStart: 7 },
    });
    fireEvent.click(action('messages.composer.suggestion.attachment-type.select'));
    fireEvent.click(action('messages.composer.suggestion.attachment.select'));
    fireEvent.click(action('messages.composer.send'));
    fireEvent.submit(action('messages.composer.submit'));
    const uploadInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['agenda'], 'agenda.txt', { type: 'text/plain' });
    fireEvent.change(uploadInput, { target: { files: [file] } });

    expect(attachments.removeAttachment).toHaveBeenCalledWith('document', 'document-1');
    expect(setMessageText).toHaveBeenCalledWith('Updated');
    expect(handleAttachmentTypeSelect).toHaveBeenCalledWith('group');
    expect(handleAttachmentSelect).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'group:1' })
    );
    expect(handleSendMessage).toHaveBeenCalledTimes(2);
    expect(attachments.addUploadedFiles).toHaveBeenCalledWith([file]);
    expect(action('messages.composer.file.upload')).toBeTruthy();
  });

  it('runs every assistant composer intent against deterministic component boundaries', () => {
    const assistantChat = {
      selectedSkills: [{ slug: 'research', name: 'Research' }],
      selectedAttachments: [{ entityType: 'group', entityId: 'group-1', title: 'Council' }],
      isUploadingAttachments: false,
      uploadingAttachmentName: null,
      selectedModelKey: 'test:model',
      setSelectedModelKey: vi.fn(),
      selectedModel: {
        provider: 'test',
        id: 'model',
        name: 'Test model',
        context_window: 128000,
        free: true,
        source: 'builtin',
        supports_reasoning_effort: true,
      },
      models: [
        {
          provider: 'test',
          id: 'model-2',
          name: 'Second model',
          context_window: 128000,
          free: false,
          source: 'builtin',
          supports_reasoning_effort: true,
        },
      ],
      reasoningEffort: 'medium',
      setReasoningEffort: vi.fn(),
      selectedTools: [],
      availableSkills: [{ slug: 'research', name: 'Research', aliases: [], isBuiltIn: false }],
      setToolSelection: vi.fn(),
      setSkillSelection: vi.fn(),
      removeAttachment: vi.fn(),
      addUploadedFiles: vi.fn(),
      isSending: false,
    };
    const handlers = {
      setMessageText: vi.fn(),
      setAssistantSettingsOpen: vi.fn(),
      setCreateSkillOpen: vi.fn(),
      handleAttachmentTypeSelect: vi.fn(),
      handleAttachmentSelect: vi.fn(),
      handleSkillSelect: vi.fn(),
      handleToolSelect: vi.fn(),
      handleCreateSkill: vi.fn(),
      handleSubmit: vi.fn(),
    };
    render(
      <AssistantMessageInputView
        assistantChat={assistantChat}
        t={t}
        textareaRef={createRef<HTMLTextAreaElement>()}
        messageText="Question"
        setMessageText={handlers.setMessageText}
        caretPosition={0}
        setCaretPosition={vi.fn()}
        suggestionAnchorPosition={{ left: 0, top: 0, width: 320 }}
        setSuggestionAnchorPosition={vi.fn()}
        textareaScrollVersion={0}
        setTextareaScrollVersion={vi.fn()}
        createSkillOpen
        setCreateSkillOpen={handlers.setCreateSkillOpen}
        assistantSettingsOpen
        setAssistantSettingsOpen={handlers.setAssistantSettingsOpen}
        skillName="Planner"
        setSkillName={vi.fn()}
        skillSlug="planner"
        setSkillSlug={vi.fn()}
        skillAliases="plan"
        setSkillAliases={vi.fn()}
        skillPrompt="Plan carefully"
        setSkillPrompt={vi.fn()}
        selectedSkillKeySet={new Set(['research'])}
        selectedToolKeySet={new Set()}
        searchTools={[{ name: 'search', label: 'Search', description: 'Find', kind: 'search' }]}
        createTools={[{ name: 'create', label: 'Create', description: 'Create' }]}
        updateTools={[{ name: 'update', label: 'Update', description: 'Update' }]}
        mentionQuery=""
        skillCommand=""
        toolCommand=""
        selectedAttachmentKeys={new Set()}
        attachmentTypeSuggestions={[{ entityType: 'event', label: 'Event', token: '@event' }]}
        attachmentSuggestions={[{ key: 'event:1', entityType: 'event', label: 'Assembly' }]}
        skillSuggestions={[{ slug: 'research', name: 'Research' }]}
        toolSuggestions={[{ name: 'search', label: 'Search', description: 'Find', kind: 'search' }]}
        hasSuggestionPanel
        suggestionAnchorIndex={0}
        freeRouterLabel="Free"
        freeRouterMessage="Free"
        reliabilityMessage="Reliable"
        freeRouterModelKey="test:free"
        getModelDisplayLabel={(model: any) => model.name}
        selectedModelHint={null}
        updateCaretPosition={vi.fn()}
        moveCaret={vi.fn()}
        applyMessageReplacement={vi.fn()}
        handleAttachmentTypeSelect={handlers.handleAttachmentTypeSelect}
        handleAttachmentSelect={handlers.handleAttachmentSelect}
        handleSkillSelect={handlers.handleSkillSelect}
        handleToolSelect={handlers.handleToolSelect}
        resetSkillForm={vi.fn()}
        handleCreateSkill={handlers.handleCreateSkill}
        handleSubmit={handlers.handleSubmit}
      />
    );

    fireEvent.click(action('messages.assistant.skill.remove'));
    fireEvent.click(action('messages.assistant.attachment.remove'));
    fireEvent.change(action('messages.assistant.prompt.change'), {
      target: { value: 'Updated question', selectionStart: 16 },
    });
    for (const id of [
      'messages.assistant.suggestion.tool.select',
      'messages.assistant.suggestion.skill.select',
      'messages.assistant.suggestion.attachment-type.select',
      'messages.assistant.suggestion.attachment.select',
    ]) {
      fireEvent.click(action(id));
    }
    fireEvent.click(action('messages.assistant.model.option'));
    fireEvent.click(actions('messages.assistant.reasoning.option')[0]);
    for (const id of [
      'messages.assistant.tool.search.toggle',
      'messages.assistant.tool.create.toggle',
      'messages.assistant.tool.update.toggle',
      'messages.assistant.skill.toggle',
      'messages.assistant.skill.create.open',
      'messages.assistant.settings.drawer.open',
      'messages.assistant.drawer.tool.toggle',
      'messages.assistant.drawer.skill.toggle',
      'messages.assistant.drawer.skill-create.open',
      'messages.assistant.skill-dialog.cancel',
      'messages.assistant.skill-dialog.create',
      'messages.assistant.send',
    ]) {
      fireEvent.click(action(id));
    }
    fireEvent.submit(action('messages.composer.submit'));
    const uploadInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['context'], 'context.txt', { type: 'text/plain' });
    fireEvent.change(uploadInput, { target: { files: [file] } });

    expect(assistantChat.setSkillSelection).toHaveBeenCalled();
    expect(assistantChat.removeAttachment).toHaveBeenCalledWith('group', 'group-1');
    expect(handlers.setMessageText).toHaveBeenCalledWith('Updated question');
    expect(handlers.handleToolSelect).toHaveBeenCalledWith('search');
    expect(handlers.handleSkillSelect).toHaveBeenCalledWith('research');
    expect(handlers.handleAttachmentTypeSelect).toHaveBeenCalledWith('event');
    expect(handlers.handleAttachmentSelect).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'event:1' })
    );
    expect(assistantChat.setSelectedModelKey).toHaveBeenCalledWith('test:model-2');
    expect(assistantChat.setReasoningEffort).toHaveBeenCalledWith('low');
    expect(assistantChat.setToolSelection).toHaveBeenCalled();
    expect(handlers.setAssistantSettingsOpen).toHaveBeenCalled();
    expect(handlers.setCreateSkillOpen).toHaveBeenCalled();
    expect(handlers.handleCreateSkill).toHaveBeenCalledOnce();
    expect(handlers.handleSubmit).toHaveBeenCalledTimes(2);
    expect(assistantChat.addUploadedFiles).toHaveBeenCalledWith([file]);
    expect(action('messages.assistant.file.upload')).toBeTruthy();
    expect(actions('messages.assistant.model.select')).not.toHaveLength(0);
    expect(actions('messages.assistant.reasoning.select')).not.toHaveLength(0);
    expect(action('messages.assistant.settings.popover.open')).toBeTruthy();
  });
});
