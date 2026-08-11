import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAgendaItemDetail } from '@/features/agendas/hooks/useAgendaItemDetail';
import { useGroupNetworkLayout } from '@/features/network/hooks/useGroupNetworkLayout';
import { useIsMobileScreen } from '../useIsMobileScreen';

const mocks = vi.hoisted(() => ({
  useFacadeAgendaItemDetail: vi.fn(),
  usePersistedNetworkLayout: vi.fn(),
  useScreenStore: vi.fn((selector: (state: { isMobileScreen: boolean }) => unknown) =>
    selector({ isMobileScreen: true })
  ),
}));

vi.mock('@/zero/events/useEventState', () => ({
  useAgendaItemDetail: (id: string) => mocks.useFacadeAgendaItemDetail(id),
}));

vi.mock('@/features/network/hooks/usePersistedNetworkLayout', () => ({
  usePersistedNetworkLayout: (options: object) => mocks.usePersistedNetworkLayout(options),
}));

vi.mock('@/features/shared/global-state/screen.store.tsx', () => ({
  useScreenStore: (selector: (state: { isMobileScreen: boolean }) => unknown) =>
    mocks.useScreenStore(selector),
}));

describe('small facade hooks', () => {
  beforeEach(() => {
    mocks.useFacadeAgendaItemDetail.mockReset();
    mocks.usePersistedNetworkLayout.mockReset();
  });

  it('forwards agenda item ids to the Zero facade', () => {
    const result = { item: { id: 'agenda-1' } };
    mocks.useFacadeAgendaItemDetail.mockReturnValue(result);
    expect(useAgendaItemDetail('agenda-1')).toBe(result);
    expect(mocks.useFacadeAgendaItemDetail).toHaveBeenCalledWith('agenda-1');
  });

  it('namespaces persisted group layout state', () => {
    const result = { nodes: [] };
    mocks.usePersistedNetworkLayout.mockReturnValue(result);
    expect(useGroupNetworkLayout('group-1')).toBe(result);
    expect(mocks.usePersistedNetworkLayout).toHaveBeenCalledWith({ scopeKey: 'group:group-1' });
  });

  it('selects only the mobile screen flag from the shared store', () => {
    expect(useIsMobileScreen()).toBe(true);
    expect(mocks.useScreenStore).toHaveBeenCalledOnce();
  });
});
