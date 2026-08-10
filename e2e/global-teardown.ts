import { closeDb } from './fixtures/db';

export default async function globalTeardown() {
  await closeDb();
}
