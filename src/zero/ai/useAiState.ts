import { useQuery } from '@rocicorp/zero/react';
import { queries } from '../queries';

export function useAiState() {
  const [skills, skillsResult] = useQuery(queries.ai.skillsByUser({}));
  const [tools, toolsResult] = useQuery(queries.ai.toolsByUser({}));

  return {
    skills: skills ?? [],
    tools: tools ?? [],
    isLoading: skillsResult.type === 'unknown' || toolsResult.type === 'unknown',
  };
}
