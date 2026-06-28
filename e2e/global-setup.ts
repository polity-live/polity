import { checkDatabase } from './fixtures/db';
import { cleanupE2ERows } from './fixtures/cleanup';

export default async function globalSetup() {
  await checkDatabase();
  await cleanupE2ERows({ prefix: 'E2E-' });
}
