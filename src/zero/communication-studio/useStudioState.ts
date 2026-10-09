import { useQuery } from '@/zero/observed-query';
import { queries } from '../queries';
export function useStudioState(groupId: string | null, projectId?: string) {
  const [projects, listResult] = useQuery(queries.studio.list({ groupId }));
  const [project] = useQuery(projectId ? queries.studio.project({ id: projectId }) : undefined);
  const [exports, exportResult] = useQuery(
    projectId ? queries.studio.exports({ projectId }) : undefined
  );
  return {
    projects,
    project,
    exports: exports ?? [],
    isLoading: listResult.type === 'unknown',
    listError: listResult.type === 'error' ? listResult.error.message : '',
    exportResult,
  };
}
