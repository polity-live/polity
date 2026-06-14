import { usePersistedNetworkLayout } from './usePersistedNetworkLayout';

export function useGroupNetworkLayout(groupId: string) {
  return usePersistedNetworkLayout({
    scopeKey: `group:${groupId}`,
  });
}
