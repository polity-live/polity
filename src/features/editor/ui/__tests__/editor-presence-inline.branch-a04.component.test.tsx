/* @vitest-environment jsdom */

import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  plateProps: undefined as Record<string, any> | undefined,
  toggleProps: undefined as Record<string, any> | undefined,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => (key === 'common.unknownUser' ? 'Unknown user' : key),
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/features/shared/theme', () => ({
  featureThemeClassName: (key: string) => key,
  featureThemeGeneratedHsl: (hue: number) => `hsl(${hue} 70% 50%)`,
}));
vi.mock('@/features/shared/ui/navigation/SmartLink.tsx', () => ({
  SmartLink: ({ children, resetScroll: _resetScroll, ...props }: any) => (
    <a {...props}>{children}</a>
  ),
}));
vi.mock('@/features/shared/ui/ui/avatar', () => ({
  Avatar: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  AvatarFallback: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  AvatarImage: (props: any) => <img {...props} />,
}));
vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ asChild, children, size: _size, variant: _variant, ...props }: any) =>
    asChild ? (
      React.cloneElement(React.Children.only(children), props)
    ) : (
      <button {...props}>{children}</button>
    ),
}));
vi.mock('@/features/shared/ui/ui/popover', () => ({
  Popover: ({ children, onOpenChange }: any) => (
    <div>
      <button type="button" data-testid="popover-open" onClick={() => onOpenChange(true)} />
      <button type="button" data-testid="popover-close" onClick={() => onOpenChange(false)} />
      {children}
    </div>
  ),
  PopoverContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  PopoverTrigger: ({ children }: any) => <>{children}</>,
}));
vi.mock('@/features/shared/ui/feedback', () => ({
  SectionSkeleton: (props: any) => <div data-testid="skeleton" data-rows={props.rows} />,
}));
vi.mock('@/features/shared/ui/kit-platejs/plate-editor', () => ({
  PlateEditor: (props: Record<string, unknown>) => {
    state.plateProps = props;
    return <div data-testid="plate-editor" />;
  },
}));
vi.mock('../SuggestionViewToggle', () => ({
  SuggestionViewToggle: (props: Record<string, unknown>) => {
    state.toggleProps = props;
    return <div data-testid="suggestion-toggle" />;
  },
}));

import { InlineAmendmentEditorView } from '../InlineAmendmentEditorView';
import { OnlineCollaboratorAvatars } from '../OnlineCollaboratorAvatars';

beforeEach(() => {
  vi.useFakeTimers();
  state.plateProps = undefined;
  state.toggleProps = undefined;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function collaborator(id: string, user: Record<string, unknown>) {
  return { id: `collaborator-${id}`, user: { id, ...user } } as never;
}

describe('OnlineCollaboratorAvatars remaining branches', () => {
  it('filters disabled and offline collaborators', () => {
    const collaborators = [collaborator('offline', { name: 'Offline' })];
    const { rerender } = render(
      <OnlineCollaboratorAvatars
        collaborators={collaborators}
        onlinePeerMap={new Map()}
        activeCursorUserIds={new Set()}
        enabled={false}
      />
    );
    expect(
      document.querySelector('[data-action-id="editor.presence.collaborator.open"]')
    ).toBeNull();
    rerender(
      <OnlineCollaboratorAvatars
        collaborators={collaborators}
        onlinePeerMap={new Map()}
        activeCursorUserIds={new Set()}
      />
    );
    expect(
      document.querySelector('[data-action-id="editor.presence.collaborator.open"]')
    ).toBeNull();
  });

  it('derives every online, name, initial, image, and color fallback', () => {
    const collaborators = [
      collaborator('peer', {
        name: 'Explicit Name',
        firstName: 'Explicit',
        lastName: 'Name',
        avatarUrl: 'avatar.png',
      }),
      collaborator('active', { firstName: 'Solo' }),
      collaborator('current', { name: 'Multi Word' }),
      collaborator('blank', { name: '   ' }),
      collaborator('unknown', {}),
      collaborator('offline', { name: 'Offline' }),
    ];
    const onlinePeerMap = new Map([
      ['peer', { peerId: 'p1', userId: 'peer', name: 'Peer', color: '#111111' }],
      ['blank', { peerId: 'p2', userId: 'blank', name: 'Blank', color: '#222222' }],
      ['unknown', { peerId: 'p3', userId: 'unknown', name: 'Unknown', color: '#333333' }],
    ]) as never;
    const view = render(
      <OnlineCollaboratorAvatars
        collaborators={collaborators}
        onlinePeerMap={onlinePeerMap}
        activeCursorUserIds={new Set(['active'])}
        currentUserId="current"
        presenceColorByUserId={new Map([['peer', '#abcdef']])}
        className="custom"
      />
    );

    expect(screen.getByRole('button', { name: 'Explicit Name' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Solo' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Multi Word' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '?' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Unknown user' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Offline' })).toBeNull();
    expect(screen.getAllByText('EN').length).toBeGreaterThan(0);
    expect(screen.getAllByText('SO').length).toBeGreaterThan(0);
    expect(screen.getAllByText('MW').length).toBeGreaterThan(0);
    expect(screen.getAllByText('?').length).toBeGreaterThan(0);
    expect(screen.getAllByText('UU').length).toBeGreaterThan(0);

    const presence = screen.getByRole('button', { name: 'Explicit Name' });
    fireEvent.click(presence);
    fireEvent.click(presence);
    fireEvent.focus(presence);
    fireEvent.mouseLeave(presence);
    fireEvent.mouseEnter(presence);
    fireEvent.mouseLeave(presence);
    act(() => vi.advanceTimersByTime(120));
    fireEvent.click(screen.getAllByTestId('popover-open')[0]!);
    fireEvent.click(screen.getAllByTestId('popover-close')[0]!);

    fireEvent.mouseLeave(presence);
    view.unmount();
  });
});

describe('InlineAmendmentEditorView remaining branches', () => {
  const base = {
    amendmentId: 'amendment-1',
    userId: 'user-1',
    userRecord: null,
    agendaItemId: null,
    resolvedMode: 'edit',
    content: [],
    discussions: [],
    mode: 'edit',
    selectedCrIds: null,
    setContent: vi.fn(),
    setDiscussions: vi.fn(),
    setSelectedCrIds: vi.fn(),
    contentEntityId: 'document-1',
    amendmentIdFromEntity: 'amendment-1',
    editorOps: {},
    currentUser: null,
    editorUsers: [],
    handleChangeRequestCreate: vi.fn(),
    onSuggestionAccepted: vi.fn(),
    onSuggestionDeclined: vi.fn(),
    onEventSuggestionConfirm: vi.fn(),
    onEventSuggestionCancel: vi.fn(),
  };

  it('renders loading, absent entity, and metadata fallbacks independently', () => {
    const { rerender } = render(<InlineAmendmentEditorView {...base} entity={null} isLoading />);
    expect(screen.getByTestId('skeleton')).toBeTruthy();
    rerender(<InlineAmendmentEditorView {...base} entity={null} isLoading={false} />);
    expect(screen.queryByTestId('plate-editor')).toBeNull();
    rerender(
      <InlineAmendmentEditorView {...base} entity={{ metadata: undefined }} isLoading={false} />
    );
    expect(state.plateProps?.currentUser).toBeUndefined();
    expect(state.plateProps?.datasetContext).toEqual({
      defaultGroupId: null,
      defaultGroupName: null,
      canViewDatasets: false,
      canManageDatasets: false,
      canUploadDatasets: true,
    });
    expect(screen.queryByTestId('suggestion-toggle')).toBeNull();
  });

  it('passes current user, discussions, and explicit dataset permissions', () => {
    const currentUser = { id: 'user-1', name: 'Ada', avatarUrl: 'ada.png' };
    render(
      <InlineAmendmentEditorView
        {...base}
        currentUser={currentUser}
        discussions={[{ id: 'discussion-1' }]}
        selectedCrIds={new Set(['cr-1'])}
        entity={{
          metadata: {
            groupId: 'group-1',
            groupName: 'Group',
            canViewDatasets: true,
            canManageDatasets: true,
          },
        }}
        isLoading={false}
      />
    );
    expect(state.toggleProps).toMatchObject({ discussions: [{ id: 'discussion-1' }] });
    expect(state.plateProps?.currentUser).toEqual({ id: 'user-1', name: 'Ada', avatar: 'ada.png' });
    expect(state.plateProps?.datasetContext).toEqual({
      defaultGroupId: 'group-1',
      defaultGroupName: 'Group',
      canViewDatasets: true,
      canManageDatasets: true,
      canUploadDatasets: true,
    });
  });
});
