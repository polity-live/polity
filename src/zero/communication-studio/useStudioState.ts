import { useQuery } from '@rocicorp/zero/react';
import { queries } from '../queries';
export function useStudioState(groupId: string | null, projectId?: string) {
  const [projects, listResult] = useQuery(queries.studio.list({ groupId }));
  const [exports, exportResult] = useQuery(
    projectId ? queries.studio.exports({ projectId }) : undefined
  );
  return {
    projects,
    exports: exports ?? [],
    isLoading: listResult.type === 'unknown',
    exportResult,
  };
}
