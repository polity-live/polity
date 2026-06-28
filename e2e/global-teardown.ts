import { cleanupE2ERows } from './fixtures/cleanup';

export default async function globalTeardown() {
  await cleanupE2ERows({
    prefix: 'E2E-',
    includeWorkerUsers: true,
    closeConnection: true,
  });
}
