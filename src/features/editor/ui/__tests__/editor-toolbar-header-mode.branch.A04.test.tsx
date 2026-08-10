/* @vitest-environment jsdom */

import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  modeChange: undefined as undefined | ((mode: string) => void | Promise<void>),
  shareProps: undefined as Record<string, unknown> | undefined,
  toastError: vi.fn(),
  versionProps: undefined as Record<string, unknown> | undefined,
}));

vi.mock('@/features/shared/ui/action-buttons/ShareButton.tsx', () => ({
  ShareButton: (props: Record<string, unknown>) => {
    state.shareProps = props;
    return <div data-testid="share" />;
  },
}));
vi.mock('../VersionControl', () => ({
  VersionControl: (props: Record<string, unknown>) => {
    state.versionProps = props;
    return <div data-testid="version" />;
  },
}));
vi.mock('@/features/shared/ui/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownMenuContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  DropdownMenuLabel: ({ children }: any) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuTrigger: ({ children }: any) => <>{children}</>,
}));
vi.mock('@/features/shared/ui/status', () => ({
  BadgeControl: ({ children }: any) => <span>{children}</span>,
  EditingModeMenuItems: ({ onValueChange }: any) => {
    state.modeChange = onValueChange;
    return <div data-testid="mode-items" />;
  },
  getEditingModeOption: (mode: string) => ({
    colorClass: 'mode-color',
    Icon: (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />,
    label: mode,
  }),
}));
vi.mock('@/features/shared/ui/ui/sonner', () => ({ toast: { error: state.toastError } }));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));

import { EditorHeader } from '../EditorHeader';
import { EditorToolbar } from '../EditorToolbar';
import { ModeSelector } from '../ModeSelector';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  vi.clearAllMocks();
  state.modeChange = undefined;
  state.shareProps = undefined;
  state.versionProps = undefined;
});

describe('EditorToolbar remaining branches', () => {
  const base = { entityType: 'document' as const, entityId: 'document-1' };

  it('short-circuits each optional capability input independently', () => {
    const restore = vi.fn();
    const mode = vi.fn();
    const { rerender } = render(
      <EditorToolbar
        {...base}
        capabilities={{ modeSelection: false, presence: false, sharing: false, versioning: false }}
      />
    );
    expect(screen.queryByTestId('share')).toBeNull();

    rerender(<EditorToolbar {...base} />);
    rerender(<EditorToolbar {...base} currentContent={[]} />);
    rerender(<EditorToolbar {...base} currentContent={[]} onRestoreVersion={restore} />);
    rerender(<EditorToolbar {...base} currentMode="edit" />);
    rerender(<EditorToolbar {...base} currentMode="edit" onModeChange={mode} />);
    expect(screen.queryByTestId('version')).toBeNull();
    expect(screen.queryByTestId('mode-items')).toBeTruthy();
  });

  it('renders all controls, avatar variants, singular/plural presence, and overflow', () => {
    const restore = vi.fn();
    const mode = vi.fn();
    const peer = (index: number, overrides: Record<string, unknown> = {}) => ({
      peerId: `peer-${index}`,
      userId: `user-${index}`,
      name: `Person ${index}`,
      color: '#123456',
      avatar: index === 0 ? 'avatar.png' : undefined,
      ...overrides,
    });
    const { rerender } = render(
      <EditorToolbar
        {...base}
        userId="user-1"
        shareTitle="Share"
        currentContent={[]}
        onRestoreVersion={restore}
        currentMode="edit"
        onModeChange={mode}
        onlinePeers={[peer(0)] as never}
        statusBadge="draft"
      />
    );
    expect(state.shareProps).toMatchObject({ title: 'Share', description: '' });
    expect(state.versionProps).toMatchObject({ currentUserId: 'user-1' });
    expect(screen.getByText(/1/)).toBeTruthy();

    rerender(
      <EditorToolbar
        {...base}
        userId="user-1"
        shareTitle="Share"
        shareDescription="Description"
        currentContent={[]}
        onRestoreVersion={restore}
        currentMode="edit"
        onModeChange={mode}
        isOwnerOrCollaborator
        onlinePeers={
          [peer(0), peer(1), peer(2), peer(3), peer(4), peer(5, { name: undefined })] as never
        }
      />
    );
    expect(screen.getByText('+1')).toBeTruthy();
  });

  it('computes an empty share URL during server rendering', () => {
    const currentWindow = globalThis.window;
    vi.stubGlobal('window', undefined);
    const tree = EditorToolbar({ ...base, shareTitle: 'SSR' }) as React.ReactElement<any>;
    const toolbar = React.Children.only(tree.props.children) as React.ReactElement<any>;
    const share = React.Children.toArray(toolbar.props.children).find(
      child =>
        React.isValidElement(child) && (child as React.ReactElement<any>).props.title === 'SSR'
    ) as React.ReactElement<any>;
    expect(share.props.url).toBe('');
    vi.stubGlobal('window', currentWindow);
  });
});

describe('EditorHeader remaining branches', () => {
  function props(overrides: Record<string, unknown> = {}) {
    return {
      title: 'Title',
      onTitleChange: vi.fn(),
      isEditingTitle: false,
      setIsEditingTitle: vi.fn(),
      isSavingTitle: false,
      saveStatus: 'saved' as const,
      hasUnsavedChanges: false,
      ...overrides,
    };
  }

  it('edits through change, blur, Enter, Escape, and ignored keys', () => {
    const inputProps = props({ isEditingTitle: true });
    const { rerender } = render(<EditorHeader {...inputProps} />);
    const input = screen.getByDisplayValue('Title');
    fireEvent.change(input, { target: { value: 'Renamed' } });
    fireEvent.keyDown(input, { key: 'Other' });
    fireEvent.keyDown(input, { key: 'Escape' });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.blur(input);
    expect(inputProps.onTitleChange).toHaveBeenCalledWith('Renamed');
    expect(inputProps.setIsEditingTitle).toHaveBeenCalledWith(false);

    const readOnly = props({ title: '', isEditingTitle: true, canEditTitle: false });
    rerender(<EditorHeader {...readOnly} />);
    expect(screen.getByText('features.editor.header.untitled')).toBeTruthy();
    expect(document.querySelector('[data-action-id="editor.header.title.edit"]')).toBeNull();

    const editable = props();
    rerender(<EditorHeader {...editable} />);
    fireEvent.click(document.querySelector('[data-action-id="editor.header.title.edit"]')!);
    expect(editable.setIsEditingTitle).toHaveBeenCalledWith(true);
  });

  it('renders every save state and both saving causes', () => {
    const { rerender } = render(<EditorHeader {...props({ saveStatus: 'saving' })} />);
    expect(screen.getByText('features.editor.header.saving')).toBeTruthy();
    rerender(<EditorHeader {...props({ isSavingTitle: true })} />);
    expect(screen.getByText('features.editor.header.saving')).toBeTruthy();
    rerender(<EditorHeader {...props({ saveStatus: 'error' })} />);
    expect(screen.getByText(/features.editor.header.saveFailed/)).toBeTruthy();
    rerender(<EditorHeader {...props({ hasUnsavedChanges: true })} />);
    expect(screen.getByText('features.editor.header.unsavedChanges')).toBeTruthy();
    rerender(
      <EditorHeader {...props()} presenceSlot={<i>presence</i>} statusBadge={<b>status</b>} />
    );
    expect(screen.getByText('features.editor.header.allSaved')).toBeTruthy();
  });
});

describe('ModeSelector remaining branches', () => {
  async function choose(mode: string) {
    await act(async () => state.modeChange?.(mode));
  }

  it('selects each tutorial anchor and validates no-op and authorization paths', async () => {
    const { rerender } = render(
      <ModeSelector
        entityType="amendment"
        entityId="amendment-1"
        currentMode="suggest_internal"
        isOwnerOrCollaborator
      />
    );
    expect(
      document.querySelector('[data-tutorial-anchor="amendment-mode-vote-internal"]')
    ).toBeTruthy();
    await choose('suggest_internal');
    await choose('edit');

    rerender(
      <ModeSelector
        entityType="amendment"
        entityId="amendment-1"
        currentMode="edit"
        isOwnerOrCollaborator={false}
      />
    );
    expect(
      document.querySelector('[data-tutorial-anchor="amendment-mode-suggest-internal"]')
    ).toBeTruthy();
    await choose('view');
    expect(state.toastError).toHaveBeenCalled();

    rerender(
      <ModeSelector
        entityType="document"
        entityId="document-1"
        currentMode="edit"
        isOwnerOrCollaborator
      />
    );
    expect(document.querySelector('[data-tutorial-anchor]')).toBeNull();
  });

  it('awaits successful mode changes and reports failures', async () => {
    const success = vi.fn(async () => undefined);
    const failure = vi.fn(async () => {
      throw new Error('failed');
    });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { rerender } = render(
      <ModeSelector
        entityType="document"
        entityId="document-1"
        currentMode="edit"
        isOwnerOrCollaborator
        onModeChange={success}
      />
    );
    await choose('view');
    expect(success).toHaveBeenCalledWith('view');

    rerender(
      <ModeSelector
        entityType="document"
        entityId="document-1"
        currentMode="edit"
        isOwnerOrCollaborator
        onModeChange={failure}
      />
    );
    await choose('view');
    expect(consoleError).toHaveBeenCalled();
    expect(state.toastError).toHaveBeenCalled();
  });
});
