/* @vitest-environment jsdom */

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface Model {
  provider: string;
  id: string;
  label: string;
  source?: string;
  free?: boolean;
}

interface CapturedViewProps {
  textareaRef: { current: HTMLTextAreaElement | null };
  messageText: string;
  setMessageText: (value: string) => void;
  setCaretPosition: (value: number) => void;
  setTextareaScrollVersion: (value: number | ((current: number) => number)) => void;
  setCreateSkillOpen: (value: boolean) => void;
  setAssistantSettingsOpen: (value: boolean) => void;
  setSkillName: (value: string) => void;
  setSkillSlug: (value: string) => void;
  setSkillAliases: (value: string) => void;
  setSkillPrompt: (value: string) => void;
  selectedSkillKeySet: Set<string>;
  selectedToolKeySet: Set<string>;
  selectedAttachmentKeys: Set<string>;
  searchTools: unknown[];
  createTools: unknown[];
  updateTools: unknown[];
  attachmentTypeSuggestions: { entityType: string }[];
  attachmentSuggestions: { key: string }[];
  skillSuggestions: { slug: string }[];
  toolSuggestions: { name: string }[];
  hasSuggestionPanel: boolean;
  suggestionAnchorIndex: number | null;
  freeRouterModelKey: string | null;
  getModelDisplayLabel: (model: Model) => string;
  selectedModelHint: { className: string; message: string } | null;
  updateCaretPosition: () => void;
  moveCaret: (position: number) => void;
  applyMessageReplacement: (start: number, end: number, value: string, caret: number) => void;
  handleAttachmentTypeSelect: (entityType: string) => void;
  handleAttachmentSelect: (option: { key: string; entityType: string; entityId: string }) => void;
  handleSkillSelect: (slug: string) => void;
  handleToolSelect: (name: string) => void;
  resetSkillForm: () => void;
  handleCreateSkill: () => void;
  handleSubmit: () => Promise<void>;
}

const view = vi.hoisted(() => ({
  latest: null as CapturedViewProps | null,
  attachTextarea: true,
}));

const composer = vi.hoisted(() => ({
  mention: null as null | {
    start: number;
    end: number;
    raw: string;
    entityType?: string;
    searchText: string;
  },
  skill: null as null | { start: number; end: number; raw: string; searchText: string },
  tool: null as null | { start: number; end: number; raw: string; searchText: string },
  getSuggestionAnchorPosition: vi.fn((_textarea: unknown, _message: string, _index: number) => ({
    top: 10,
    left: 20,
  })),
  replaceTextRange: vi.fn(
    (current: string, start: number, end: number, replacement: string) =>
      current.slice(0, start) + replacement + current.slice(end)
  ),
  slugifySkillName: vi.fn((name: string) => name.trim().toLowerCase().replaceAll(' ', '-')),
}));

const sideEffects = vi.hoisted(() => ({
  toastError: vi.fn((..._args: unknown[]) => undefined),
  reportTutorial: vi.fn((..._args: unknown[]) => undefined),
  requestSpotlight: vi.fn((..._args: unknown[]) => undefined),
  tutorialMatches: false,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/features/shared/theme', () => ({
  featureThemeClassName: (key: string) => `theme:${key}`,
}));

vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { error: (...args: unknown[]) => sideEffects.toastError(...args) },
}));

vi.mock('@/features/app-tutorial/events', () => ({
  reportAppTutorialAction: (...args: unknown[]) => sideEffects.reportTutorial(...args),
  requestAppTutorialSpotlightTarget: (...args: unknown[]) => sideEffects.requestSpotlight(...args),
}));

vi.mock('@/features/app-tutorial/catalog', () => ({
  matchesAppTutorialExpectedInput: () => sideEffects.tutorialMatches,
}));

vi.mock('../../logic/assistantComposer', () => ({
  ASSISTANT_ATTACHMENT_TYPE_OPTIONS: [
    { entityType: 'group', label: 'Groups' },
    { entityType: 'event', label: 'Meetings' },
  ],
  parseActiveMentionQuery: () => composer.mention,
  parseActiveSkillCommand: () => composer.skill,
  parseActiveToolCommand: () => composer.tool,
  getSuggestionAnchorPosition: (...args: [HTMLTextAreaElement, string, number]) =>
    composer.getSuggestionAnchorPosition(...args),
  replaceTextRange: (...args: [string, number, number, string]) =>
    composer.replaceTextRange(...args),
  slugifySkillName: (name: string) => composer.slugifySkillName(name),
}));

vi.mock('../AssistantMessageInputView', () => ({
  AssistantMessageInputView: (props: CapturedViewProps) => {
    view.latest = props;
    return view.attachTextarea ? (
      <textarea ref={props.textareaRef} defaultValue={props.messageText} />
    ) : null;
  },
}));

import { AssistantMessageInput } from '../AssistantMessageInput';

function currentProps(): CapturedViewProps {
  if (!view.latest) throw new Error('AssistantMessageInputView was not rendered');
  return view.latest;
}

function createAssistantChat(overrides: Record<string, unknown> = {}) {
  return {
    selectedSkillSlugs: ['selected-skill'],
    selectedToolNames: ['selected-tool'],
    selectedAttachments: [{ entityType: 'group', entityId: 'selected' }],
    availableTools: [
      {
        name: 'selected-tool',
        label: 'Selected search',
        description: 'selected',
        kind: 'search',
      },
      { name: 'search-tool', label: 'Find records', description: 'lookup', kind: 'search' },
      { name: 'create-tool', label: 'Create event', description: 'create', kind: 'create' },
      { name: 'update-tool', label: 'Update group', description: 'update', kind: 'update' },
    ],
    attachmentOptions: [
      {
        key: 'group:selected',
        entityType: 'group',
        entityId: 'selected',
        searchText: 'selected council',
      },
      {
        key: 'group:council',
        entityType: 'group',
        entityId: 'council',
        searchText: 'town council',
      },
      {
        key: 'event:summit',
        entityType: 'event',
        entityId: 'summit',
        searchText: 'annual summit',
      },
    ],
    availableSkills: [
      { name: 'Selected Skill', slug: 'selected-skill', aliases: ['chosen'] },
      { name: 'Create Event', slug: 'create-event', aliases: ['meeting'] },
    ],
    models: [] as Model[],
    selectedModel: null as Model | null,
    isSending: false,
    isUploadingAttachments: false,
    isTutorialConversation: false,
    addAttachment: vi.fn(),
    toggleSelectedSkillSlug: vi.fn(),
    setToolSelection: vi.fn(),
    createSkill: vi.fn(() => 'created-skill'),
    setSkillSelection: vi.fn(),
    sendAssistantMessage: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

beforeEach(() => {
  view.latest = null;
  view.attachTextarea = true;
  composer.mention = null;
  composer.skill = null;
  composer.tool = null;
  composer.getSuggestionAnchorPosition.mockClear();
  composer.replaceTextRange.mockClear();
  composer.slugifySkillName.mockClear();
  sideEffects.toastError.mockReset();
  sideEffects.reportTutorial.mockReset();
  sideEffects.requestSpotlight.mockReset();
  sideEffects.tutorialMatches = false;
  vi.spyOn(window, 'addEventListener');
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
});

describe('AssistantMessageInput A05 branch contracts', () => {
  it('derives selected sets, tool categories, model labels and reliability hints', () => {
    const freeLabel = 'features.messages.ai.freeRouterModel';
    const labeledFree: Model = {
      provider: 'openrouter',
      id: 'free-labeled',
      label: freeLabel,
      source: 'app',
      free: true,
    };
    const warningModel: Model = {
      provider: 'custom',
      id: 'paid',
      label: 'Paid model',
    };
    const chat = createAssistantChat({
      models: [labeledFree, warningModel],
      selectedModel: labeledFree,
    });
    const rendered = render(<AssistantMessageInput assistantChat={chat as never} />);

    expect(currentProps().selectedSkillKeySet).toEqual(new Set(['selected-skill']));
    expect(currentProps().selectedToolKeySet).toEqual(new Set(['selected-tool']));
    expect(currentProps().selectedAttachmentKeys).toEqual(new Set(['group:selected']));
    expect(currentProps().searchTools).toHaveLength(2);
    expect(currentProps().createTools).toHaveLength(1);
    expect(currentProps().updateTools).toHaveLength(1);
    expect(currentProps().freeRouterModelKey).toBe('openrouter:free-labeled');
    expect(currentProps().getModelDisplayLabel(labeledFree)).toBe(freeLabel);
    expect(currentProps().getModelDisplayLabel(warningModel)).toBe('Paid model');
    expect(currentProps().selectedModelHint).toEqual({
      className: 'theme:messageAssistantMessageInputSuccessRoundIcon',
      message: 'features.messages.ai.modelReliability.freeRouter',
    });

    rendered.rerender(
      <AssistantMessageInput
        assistantChat={
          createAssistantChat({
            models: [
              {
                provider: 'openrouter',
                id: 'fallback',
                label: 'Fallback',
                source: 'app',
                free: true,
              },
              warningModel,
            ],
            selectedModel: warningModel,
          }) as never
        }
      />
    );
    expect(currentProps().freeRouterModelKey).toBe('openrouter:fallback');
    expect(currentProps().selectedModelHint).toEqual({
      className: 'theme:messageAssistantMessageInputWarningRoundIcon',
      message: 'features.messages.ai.modelReliability.warning',
    });

    rendered.rerender(
      <AssistantMessageInput
        assistantChat={
          createAssistantChat({ models: [warningModel], selectedModel: null }) as never
        }
      />
    );
    expect(currentProps().freeRouterModelKey).toBeNull();
    expect(currentProps().selectedModelHint).toBeNull();
  });

  it('filters attachment, skill and tool suggestions across empty, typed and selected states', () => {
    const chat = createAssistantChat();
    const rendered = render(<AssistantMessageInput assistantChat={chat as never} />);
    expect(currentProps().hasSuggestionPanel).toBe(false);
    expect(currentProps().suggestionAnchorIndex).toBeNull();

    composer.mention = { start: 0, end: 1, raw: '@', searchText: '' };
    act(() => {
      currentProps().setMessageText('@');
      currentProps().setCaretPosition(1);
    });
    expect(currentProps().attachmentTypeSuggestions).toHaveLength(2);
    expect(currentProps().attachmentSuggestions).toHaveLength(0);
    expect(currentProps().suggestionAnchorIndex).toBe(0);

    composer.mention = {
      start: 4,
      end: 18,
      raw: '@group@council',
      entityType: 'group',
      searchText: 'council',
    };
    act(() => currentProps().setMessageText('Ask @group@council'));
    expect(currentProps().attachmentTypeSuggestions).toHaveLength(0);
    expect(currentProps().attachmentSuggestions.map(option => option.key)).toEqual([
      'group:council',
    ]);

    composer.mention = { start: 0, end: 4, raw: '@mee', searchText: 'mee' };
    act(() => currentProps().setMessageText('@mee'));
    expect(currentProps().attachmentTypeSuggestions.map(option => option.entityType)).toEqual([
      'event',
    ]);

    composer.mention = null;
    composer.skill = { start: 0, end: 1, raw: '/', searchText: '' };
    act(() => currentProps().setMessageText('/'));
    expect(currentProps().skillSuggestions).toHaveLength(2);
    expect(currentProps().suggestionAnchorIndex).toBe(0);

    composer.skill = { start: 0, end: 7, raw: '/meeting', searchText: 'meeting' };
    act(() => currentProps().setMessageText('/meeting'));
    expect(currentProps().skillSuggestions.map(skill => skill.slug)).toEqual(['create-event']);

    composer.skill = null;
    composer.tool = { start: 4, end: 5, raw: '#', searchText: '' };
    act(() => currentProps().setMessageText('Use #'));
    expect(currentProps().toolSuggestions.map(tool => tool.name)).toEqual([
      'search-tool',
      'create-tool',
      'update-tool',
    ]);
    expect(currentProps().suggestionAnchorIndex).toBe(4);

    composer.tool = { start: 4, end: 11, raw: '#lookup', searchText: 'lookup' };
    act(() => currentProps().setMessageText('Use #lookup'));
    expect(currentProps().toolSuggestions.map(tool => tool.name)).toEqual(['search-tool']);

    const resizeCalls = (
      window.addEventListener as unknown as {
        mock: { calls: [eventType: unknown, listener: unknown][] };
      }
    ).mock.calls;
    const resizeListener = resizeCalls.find(([eventType]) => eventType === 'resize')?.[1];
    if (typeof resizeListener === 'function') {
      currentProps().textareaRef.current = null;
      act(() => Reflect.apply(resizeListener, window, [new Event('resize')]));
    }

    rendered.unmount();
  });

  it('applies caret movement and all suggestion selection handlers', () => {
    const chat = createAssistantChat();
    render(<AssistantMessageInput assistantChat={chat as never} />);

    currentProps().handleAttachmentTypeSelect('group');
    currentProps().handleAttachmentSelect({
      key: 'group:council',
      entityType: 'group',
      entityId: 'council',
    });
    currentProps().handleSkillSelect('create-event');
    currentProps().handleToolSelect('create-tool');

    composer.mention = {
      start: 4,
      end: 18,
      raw: '@group@council',
      entityType: 'group',
      searchText: 'council',
    };
    act(() => currentProps().setMessageText('Ask @group@council next'));
    act(() => currentProps().handleAttachmentTypeSelect('event'));
    expect(composer.replaceTextRange).toHaveBeenCalledWith(
      'Ask @group@council next',
      4,
      18,
      '@event@'
    );

    act(() => currentProps().setMessageText('Ask @group@council!'));
    act(() =>
      currentProps().handleAttachmentSelect({
        key: 'group:council',
        entityType: 'group',
        entityId: 'council',
      })
    );
    expect(chat.addAttachment).toHaveBeenCalled();
    expect(composer.replaceTextRange).toHaveBeenLastCalledWith('Ask @group@council!', 4, 18, ' ');

    composer.mention = {
      start: 0,
      end: 4,
      raw: '@all',
      searchText: 'all',
    };
    act(() => currentProps().setMessageText('@all next'));
    act(() =>
      currentProps().handleAttachmentSelect({
        key: 'group:council',
        entityType: 'group',
        entityId: 'council',
      })
    );
    expect(composer.replaceTextRange).toHaveBeenLastCalledWith('@all next', 0, 4, '');

    composer.mention = null;
    composer.skill = { start: 0, end: 13, raw: '/create-event', searchText: 'create-event' };
    act(() => currentProps().setMessageText('/create-event'));
    act(() => currentProps().handleSkillSelect('create-event'));
    expect(chat.toggleSelectedSkillSlug).toHaveBeenCalledWith('create-event');

    composer.skill = null;
    composer.tool = { start: 4, end: 16, raw: '#create-tool', searchText: 'create-tool' };
    act(() => currentProps().setMessageText('Use #create-tool'));
    act(() => currentProps().handleToolSelect('create-tool'));
    expect(chat.setToolSelection).toHaveBeenCalledWith('create-tool', true);

    const textarea = currentProps().textareaRef.current;
    expect(textarea).not.toBeNull();
    textarea?.setSelectionRange(1, 1);
    act(() => currentProps().updateCaretPosition());
    act(() => currentProps().moveCaret(2));
    expect(textarea?.selectionStart).toBe(2);

    currentProps().textareaRef.current = null;
    act(() => currentProps().updateCaretPosition());
    act(() => currentProps().moveCaret(3));
  });

  it('validates, creates and resets skills with explicit and generated slugs', () => {
    const chat = createAssistantChat();
    render(<AssistantMessageInput assistantChat={chat as never} />);

    act(() => currentProps().handleCreateSkill());
    expect(sideEffects.toastError).toHaveBeenCalledWith('pages.user.ai.skills.validation');

    act(() => {
      currentProps().setSkillName(' Duplicate ');
      currentProps().setSkillSlug('create-event');
      currentProps().setSkillPrompt(' Prompt ');
    });
    act(() => currentProps().handleCreateSkill());
    expect(sideEffects.toastError).toHaveBeenCalledWith('pages.user.ai.skills.slugExists');

    act(() => {
      currentProps().setSkillName(' New Skill ');
      currentProps().setSkillSlug('');
      currentProps().setSkillAliases('one, two');
      currentProps().setSkillPrompt(' System prompt ');
    });
    act(() => currentProps().handleCreateSkill());
    expect(composer.slugifySkillName).toHaveBeenCalledWith('New Skill');
    expect(chat.createSkill).toHaveBeenCalledWith({
      name: 'New Skill',
      slug: 'new-skill',
      aliases: 'one, two',
      systemPrompt: 'System prompt',
    });
    expect(chat.setSkillSelection).toHaveBeenCalledWith('created-skill', true);

    act(() => currentProps().resetSkillForm());
  });

  it('guards submission and reports tutorial success and retry spotlight states', async () => {
    const guardedChat = createAssistantChat({ isSending: true });
    const rendered = render(<AssistantMessageInput assistantChat={guardedChat as never} />);
    await act(() => currentProps().handleSubmit());
    expect(guardedChat.sendAssistantMessage).not.toHaveBeenCalled();

    rendered.rerender(
      <AssistantMessageInput
        assistantChat={createAssistantChat({ isUploadingAttachments: true }) as never}
      />
    );
    act(() => currentProps().setMessageText('blocked'));
    await act(() => currentProps().handleSubmit());

    sideEffects.tutorialMatches = true;
    const successChat = createAssistantChat({
      isTutorialConversation: true,
      sendAssistantMessage: vi.fn(
        async (_message: string, options: { onUserMessageSent?: () => void }) => {
          options.onUserMessageSent?.();
          return true;
        }
      ),
    });
    rendered.rerender(<AssistantMessageInput assistantChat={successChat as never} />);
    act(() => currentProps().setMessageText(' tutorial request '));
    await act(() => currentProps().handleSubmit());
    expect(sideEffects.requestSpotlight).toHaveBeenCalledWith('tutorial-assistant-chat');
    expect(sideEffects.reportTutorial).toHaveBeenCalledWith({
      type: 'input',
      value: 'tutorial request',
    });

    const retryChat = createAssistantChat({
      isTutorialConversation: true,
      sendAssistantMessage: vi.fn().mockResolvedValue(false),
    });
    rendered.rerender(<AssistantMessageInput assistantChat={retryChat as never} />);
    act(() => currentProps().setMessageText('retry request'));
    await act(() => currentProps().handleSubmit());
    expect(sideEffects.requestSpotlight).toHaveBeenCalledWith('message-composer');

    sideEffects.tutorialMatches = false;
    const regularChat = createAssistantChat();
    rendered.rerender(<AssistantMessageInput assistantChat={regularChat as never} />);
    act(() => currentProps().setMessageText('regular request'));
    await act(() => currentProps().handleSubmit());
    expect(regularChat.sendAssistantMessage).toHaveBeenCalledWith(
      'regular request',
      expect.any(Object)
    );
  });
});
