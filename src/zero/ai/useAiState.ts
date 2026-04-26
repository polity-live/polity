import { useQuery } from '@rocicorp/zero/react';
import { queries } from '../queries';

export function useAiState() {
  const [skills, skillsResult] = useQuery(queries.ai.skillsByUser({}));

  return {
    skills: skills ?? [],
    isLoading: skillsResult.type === 'unknown',
  };
}
