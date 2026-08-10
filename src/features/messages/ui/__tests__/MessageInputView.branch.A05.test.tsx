// @vitest-environment jsdom

import { createRef } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MessageInputView, type MessageInputViewProps } from '../MessageInputView';

const mocks = vi.hoisted(() => ({ fileUploadProps: null as any }));

vi.mock('../ChatComposer', () => ({
  chatComposerTextareaClassName: 'composer-textarea',
  ChatComposer: ({ children, chips, toolbar, onSubmit }: any) => (
    <form data-testid="composer" onSubmit={onSubmit}>
      <div data-testid="chips">{chips}</div>
      <div data-testid="toolbar">{toolbar}</div>
      {children}
    </form>
  ),
}));

vi.mock('@/features/shared/ui/status', () => ({
  BadgeControl: ({ children }: any) => <span>{children}</span>,
}));

vi.mock('@/features/shared/ui/form', () => ({
  FileUploadTrigger: ({ children, ...props }: any) => {
    mocks.fileUploadProps = props;
    return <button type="button">{children}</button>;
  },
  FormControlTextarea: (props: any) => <textarea {...props} />,
}));

vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

vi.mock('@/features/shared/ui/ui/card', () => ({
  Card: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardContent: ({ children, separator: _separator, ...props }: any) => (
    <div {...props}>{children}</div>
  ),
}));

function props(overrides: Partial<MessageInputViewProps> = {}): MessageInputViewProps {
  return {
    conversation: { status: 'active' },
    currentUserId: 'user',
    onSendMessage: vi.fn(),
    t: (key: string, values?: any) => (values?.name ? `${key}:${values.name}` : key),
    textareaRef: createRef<HTMLTextAreaElement>(),
    attachments: {
      selectedAttachments: [],
      isUploadingAttachments: false,
      uploadingAttachmentName: null,
      removeAttachment: vi.fn(),
      addUploadedFiles: vi.fn(),
    },
    messageText: '',
    setMessageText: vi.fn(),
    caretPosition: 0,
    setCaretPosition: vi.fn(),
    suggestionAnchorPosition: null,
    setSuggestionAnchorPosition: vi.fn(),
    textareaScrollVersion: 0,
    setTextareaScrollVersion: vi.fn(),
    mentionQuery: '',
    selectedAttachmentKeys: new Set(),
    attachmentTypeSuggestions: [],
    attachmentSuggestions: [],
    hasSuggestionPanel: false,
    updateCaretPosition: vi.fn(),
    moveCaret: vi.fn(),
    applyMessageReplacement: vi.fn(),
    handleAttachmentTypeSelect: vi.fn(),
    handleAttachmentSelect: vi.fn(),
    handleSendMessage: vi.fn().mockResolvedValue(undefined),
    otherUser: null,
    otherParticipantName: 'Other Person',
    isPendingDirectConversation: false,
    isConversationRequester: false,
    ...overrides,
  };
}

describe('MessageInputView branch coverage', () => {
  beforeEach(() => {
    mocks.fileUploadProps = null;
  });

  afterEach(cleanup);

  it('renders requester waiting and rejected terminal states', () => {
    const waiting = props({
      isPendingDirectConversation: true,
      isConversationRequester: true,
    });
    const rendered = render(<MessageInputView {...waiting} />);
    expect(document.body.textContent).toContain(
      'features.messages.conversation.waitingForAccept:Other Person'
    );
    expect(screen.queryByTestId('composer')).toBeNull();

    rendered.rerender(
      <MessageInputView
        {...props({
          conversation: { status: 'rejected' },
          isPendingDirectConversation: true,
          isConversationRequester: false,
        })}
      />
    );
    expect(document.body.textContent).toContain('features.messages.conversation.rejected');
  });

  it('renders attachment kinds, upload states, removes items, and submits', async () => {
    const attachments = {
      selectedAttachments: [
        { entityType: 'document', entityId: 'doc', title: 'Document' },
        { entityType: 'group', entityId: 'group', title: 'Group' },
      ],
      isUploadingAttachments: true,
      uploadingAttachmentName: 'upload.pdf',
      removeAttachment: vi.fn(),
      addUploadedFiles: vi.fn(),
    };
    const handleSendMessage = vi.fn().mockResolvedValue(undefined);
    render(
      <MessageInputView {...props({ messageText: 'Hello', attachments, handleSendMessage })} />
    );

    expect(document.body.textContent).toContain('Document');
    expect(document.body.textContent).toContain('Group');
    expect(document.body.textContent).toContain('upload.pdf');
    const removeButtons = screen.getAllByLabelText('features.messages.compose.removeAttachment');
    fireEvent.click(removeButtons[0]);
    fireEvent.click(removeButtons[1]);
    expect(attachments.removeAttachment).toHaveBeenCalledWith('document', 'doc');
    expect(attachments.removeAttachment).toHaveBeenCalledWith('group', 'group');

    fireEvent.submit(screen.getByTestId('composer'));
    expect(handleSendMessage).toHaveBeenCalled();
    await act(async () => undefined);
  });

  it('covers upload selection, upload icon alternatives, and send disabled combinations', () => {
    const base = props();
    const rendered = render(<MessageInputView {...base} />);
    expect((screen.getByLabelText('common.send') as HTMLButtonElement).disabled).toBe(true);
    expect(mocks.fileUploadProps.disabled).toBe(false);
    const file = new File(['data'], 'file.txt');
    mocks.fileUploadProps.onFilesSelected([file]);
    expect(base.attachments.addUploadedFiles).toHaveBeenCalledWith([file]);

    rendered.rerender(<MessageInputView {...props({ messageText: 'text' })} />);
    expect((screen.getByLabelText('common.send') as HTMLButtonElement).disabled).toBe(false);

    const selected = {
      ...base.attachments,
      selectedAttachments: [{ entityType: 'group', entityId: 'g', title: 'G' }],
    };
    rendered.rerender(<MessageInputView {...props({ attachments: selected })} />);
    expect((screen.getByLabelText('common.send') as HTMLButtonElement).disabled).toBe(false);

    const uploadingWithoutName = {
      ...base.attachments,
      isUploadingAttachments: true,
      uploadingAttachmentName: '',
    };
    rendered.rerender(
      <MessageInputView {...props({ messageText: 'text', attachments: uploadingWithoutName })} />
    );
    expect((screen.getByLabelText('common.send') as HTMLButtonElement).disabled).toBe(true);
    expect(document.body.textContent).not.toContain('features.messages.compose.uploading');
  });

  it('updates text, caret, scroll version, and forwards basic textarea events', () => {
    const base = props();
    const { rerender } = render(<MessageInputView {...base} />);
    const textarea = screen.getByPlaceholderText('features.messages.compose.messagePlaceholder');
    fireEvent.change(textarea, { target: { value: 'abc', selectionStart: 2 } });
    expect(base.setMessageText).toHaveBeenCalledWith('abc');
    expect(base.setCaretPosition).toHaveBeenCalledWith(2);
    fireEvent.click(textarea);
    fireEvent.keyUp(textarea);
    fireEvent.select(textarea);
    expect(base.updateCaretPosition).toHaveBeenCalledTimes(4);
    fireEvent.scroll(textarea);
    const updater = base.setTextareaScrollVersion.mock.calls[0][0];
    expect(updater(4)).toBe(5);

    const noSelection = props();
    rerender(<MessageInputView {...noSelection} />);
    const nextTextarea = screen.getByPlaceholderText(
      'features.messages.compose.messagePlaceholder'
    ) as HTMLTextAreaElement;
    Object.defineProperty(nextTextarea, 'selectionStart', { configurable: true, value: null });
    fireEvent.change(nextTextarea, { target: { value: 'long' } });
    expect(noSelection.setCaretPosition).toHaveBeenCalledWith(4);
  });

  it('handles Escape, ignored keys, shifted Enter, and each Enter action priority', async () => {
    const attachment = { key: 'item', entityType: 'group', label: 'Group' };
    const type = { entityType: 'todo', label: 'Todo', token: '@todo' };
    const base = props({
      attachmentSuggestions: [attachment],
      attachmentTypeSuggestions: [type],
    });
    const rendered = render(<MessageInputView {...base} />);
    const textarea = screen.getByPlaceholderText(
      'features.messages.compose.messagePlaceholder'
    ) as HTMLTextAreaElement;
    Object.defineProperty(textarea, 'selectionStart', { configurable: true, value: 1 });
    fireEvent.keyDown(textarea, { key: 'Escape' });
    expect(base.setCaretPosition).toHaveBeenCalledWith(1);
    fireEvent.keyDown(textarea, { key: 'a' });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
    expect(base.handleSendMessage).not.toHaveBeenCalled();

    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(base.handleAttachmentSelect).toHaveBeenCalledWith(attachment);

    const typeOnly = props({ attachmentTypeSuggestions: [type] });
    rendered.rerender(<MessageInputView {...typeOnly} />);
    fireEvent.keyDown(screen.getByPlaceholderText('features.messages.compose.messagePlaceholder'), {
      key: 'Enter',
    });
    expect(typeOnly.handleAttachmentTypeSelect).toHaveBeenCalledWith('todo');

    const noSuggestions = props();
    rendered.rerender(<MessageInputView {...noSuggestions} />);
    await act(async () => {
      fireEvent.keyDown(
        screen.getByPlaceholderText('features.messages.compose.messagePlaceholder'),
        { key: 'Enter' }
      );
    });
    expect(noSuggestions.handleSendMessage).toHaveBeenCalled();

    const nullRef = props({
      textareaRef: {
        get current() {
          return null;
        },
        set current(_value: HTMLTextAreaElement | null) {
          void _value;
        },
      },
    });
    rendered.rerender(<MessageInputView {...nullRef} />);
    fireEvent.keyDown(screen.getByPlaceholderText('features.messages.compose.messagePlaceholder'), {
      key: 'Escape',
    });
    expect(nullRef.setCaretPosition).toHaveBeenCalledWith(0);
  });

  it('renders both suggestion groups, subtitle variants, and selection clicks', () => {
    const handleAttachmentTypeSelect = vi.fn();
    const handleAttachmentSelect = vi.fn();
    const type = { entityType: 'todo', label: 'Todo', token: '@todo' };
    const suggestions = [
      { key: 'with', entityType: 'group', label: 'With subtitle', subtitle: 'Detail' },
      { key: 'without', entityType: 'event', label: 'Without subtitle', subtitle: '' },
    ];
    const rendered = render(
      <MessageInputView
        {...props({
          hasSuggestionPanel: true,
          suggestionAnchorPosition: { left: 1, top: 2, width: 3 },
          attachmentTypeSuggestions: [type],
          attachmentSuggestions: suggestions,
          handleAttachmentTypeSelect,
          handleAttachmentSelect,
        })}
      />
    );
    fireEvent.click(screen.getByText('Todo').closest('button') as HTMLButtonElement);
    fireEvent.click(screen.getByText('With subtitle').closest('button') as HTMLButtonElement);
    expect(handleAttachmentTypeSelect).toHaveBeenCalledWith('todo');
    expect(handleAttachmentSelect).toHaveBeenCalledWith(suggestions[0]);
    expect(screen.getByText('Detail')).toBeTruthy();

    rendered.rerender(
      <MessageInputView {...props({ hasSuggestionPanel: true, suggestionAnchorPosition: null })} />
    );
    expect(screen.queryByText('features.messages.ai.attachTypes')).toBeNull();
  });
});
