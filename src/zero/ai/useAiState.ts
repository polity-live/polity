import { useQuery } from '@rocicorp/zero/react';
import { queries } from '../queries';
const EMPTY_ROWS: never[] = [];

export function useAiState() {
  const [skills, skillsResult] = useQuery(queries.ai.skillsByUser({}));
  const [tools, toolsResult] = useQuery(queries.ai.toolsByUser({}));

  return {
    skills: skills ?? EMPTY_ROWS,
    tools: tools ?? EMPTY_ROWS,
    isLoading: skillsResult.type === 'unknown' || toolsResult.type === 'unknown',
  };
}
