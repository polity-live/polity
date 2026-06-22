import { Zero, type ZeroOptions } from '@rocicorp/zero';
import { schema } from '@/zero/schema';
import { mutators } from '@/zero/mutators';
import { getRequiredEnvVar } from '@/lib/env';

export function createZeroClient(userID: string, email: string) {
  const cacheURL = getRequiredEnvVar(import.meta.env.VITE_ZERO_CACHE_URL, 'VITE_ZERO_CACHE_URL');
  const appURL = getRequiredEnvVar(import.meta.env.VITE_APP_URL, 'VITE_APP_URL');
  const opts: ZeroOptions = {
    schema,
    mutators,
    userID,
    context: { userID, email },
    cacheURL,
    queryURL: `${appURL}/api/zero/query`,
    mutateURL: `${appURL}/api/zero/mutate`,
  };

  return new Zero(opts);
}
