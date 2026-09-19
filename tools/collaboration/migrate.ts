import { dbProvider } from '../../src/zero/db-provider';
import { rows } from '../../src/server/collaboration/transaction';

// The editor migration is retired. Retain read-only status for existing tooling;
// Studio initialization belongs to project creation and the guarded local seed.
const command = process.argv[3] ?? 'status';
if (command !== 'status')
  throw new Error(
    'The all-editor migration has been reverted. Only Studio uses collaboration; amendments, blogs and Streetdesign use the legacy editors.'
  );
const result = await dbProvider.transaction(async tx => {
  const [control] = await rows<{ phase: string; compatibility: boolean }>(
    tx.dbTransaction,
    'select phase,compatibility from collaboration_control where singleton'
  );
  return { ...control, scope: 'studio-only' };
});
console.log(JSON.stringify(result, null, 2));
process.exit(0);
