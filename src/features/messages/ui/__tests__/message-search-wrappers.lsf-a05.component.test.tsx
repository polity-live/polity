/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  header: vi.fn(() => null),
  list: vi.fn(() => null),
  input: vi.fn(() => null),
  spatialController: vi.fn(() => ({ mapItems: [], cells: [] })),
  spatialMap: vi.fn(() => null),
  spatialList: vi.fn(() => null),
  virtualController: vi.fn(() => ({ rows: ['row'] })),
  virtualView: vi.fn(() => null),
}));

vi.mock('../ConversationHeader', () => ({ ConversationHeader: mocks.header }));
vi.mock('../MessageList', () => ({ MessageList: mocks.list }));
vi.mock('../AssistantMessageInput', () => ({ AssistantMessageInput: mocks.input }));
vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ session: { access_token: 'test-session' } }),
}));
vi.mock('@/features/search/hooks/useSpatialSearchController', () => ({
  useSpatialSearchController: mocks.spatialController,
}));
vi.mock('@/features/search/ui/SpatialSearchMap', () => ({ SpatialSearchMap: mocks.spatialMap }));
vi.mock('@/features/search/ui/SpatialSearchResultsList', () => ({
  SpatialSearchResultsList: mocks.spatialList,
}));
vi.mock('@/features/search/hooks/useVirtualSearchGridController', () => ({
  useVirtualSearchGridController: mocks.virtualController,
}));
vi.mock('@/features/search/ui/VirtualSearchGridView', () => ({
  VirtualSearchGridView: mocks.virtualView,
}));

import { AssistantMessageContentView } from '../AssistantMessageContentView';
import { SpatialSearchView } from '@/features/search/ui/SpatialSearchView';
import { VirtualSearchGrid } from '@/features/search/ui/VirtualSearchGrid';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('message and search LSF wrapper contracts', () => {
  it('renders context actions and opens the active trace through the real diagnostics surface', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ traces: [] }));
    vi.stubGlobal('fetch', fetch);
    const { container } = render(
      <AssistantMessageContentView
        {...({
          conversation: { id: 'conversation-1' },
          messages: [],
          onBack: vi.fn(),
          onTogglePin: vi.fn(),
          onDeleteClick: vi.fn(),
          onMembersClick: vi.fn(),
          onRenameConversation: vi.fn(),
          onAcceptConversation: vi.fn(),
          onRejectConversation: vi.fn(),
          assistantChat: {
            resolveAttachmentCardData: vi.fn(),
            activeTraceId: 'active-project-trace',
          },
          contextActions: <button>Inspect project context</button>,
          streamingAssistantMessage: null,
        } as any)}
      />
    );
    expect(screen.getByRole('button', { name: 'Inspect project context' })).toBeTruthy();
    const details = container.querySelector('details')!;
    expect(details).toBeTruthy();
    details.open = true;
    fireEvent(details, new Event('toggle'));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/ai/traces?traceId=active-project-trace',
        expect.objectContaining({ headers: { Authorization: 'Bearer test-session' } })
      )
    );
  });
  it('connects the assistant conversation to its three child surfaces', () => {
    const assistantChat = { resolveAttachmentCardData: vi.fn() };
    render(
      <AssistantMessageContentView
        {...({
          conversation: { id: 'conversation-1' },
          messages: [],
          onBack: vi.fn(),
          onTogglePin: vi.fn(),
          onDeleteClick: vi.fn(),
          onMembersClick: vi.fn(),
          onRenameConversation: vi.fn(),
          onAcceptConversation: vi.fn(),
          onRejectConversation: vi.fn(),
          assistantChat,
          streamingAssistantMessage: null,
        } as any)}
      />
    );
    expect(mocks.header).toHaveBeenCalledOnce();
    expect(mocks.list).toHaveBeenCalledWith(
      expect.objectContaining({
        resolveAttachmentCardData: assistantChat.resolveAttachmentCardData,
      }),
      undefined
    );
    expect(mocks.input).toHaveBeenCalledOnce();
  });

  it('connects spatial and virtual search controllers to their views', () => {
    const context = { query: 'Berlin' } as never;
    const onTotalChange = vi.fn();
    render(
      <>
        <SpatialSearchView context={context} permalinkID="result-1" onTotalChange={onTotalChange} />
        <VirtualSearchGrid context={context} permalinkID="result-1" onTotalChange={onTotalChange} />
      </>
    );
    expect(mocks.spatialController).toHaveBeenCalledWith({
      context,
      permalinkID: 'result-1',
      onTotalChange,
    });
    expect(mocks.spatialMap).toHaveBeenCalledOnce();
    expect(mocks.spatialList).toHaveBeenCalledOnce();
    expect(mocks.virtualController).toHaveBeenCalledWith({
      context,
      permalinkID: 'result-1',
      onTotalChange,
    });
    expect(mocks.virtualView).toHaveBeenCalledWith({ rows: ['row'] }, undefined);
  });
});
