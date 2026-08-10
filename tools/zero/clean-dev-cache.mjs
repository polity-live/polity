import { rm } from 'node:fs/promises';
import { createConnection } from 'node:net';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { runCliIfMain } from '../shared/run-cli-if-main.mjs';

export const ZERO_REPLICA_FILES = ['zero.db', 'zero.db-wal', 'zero.db-wal2', 'zero.db-shm'];

export function isZeroCachePortInUse(options = {}) {
  const connectionFactory = options.connectionFactory ?? createConnection;
  const timeoutMs = options.timeoutMs ?? 1_500;
  return new Promise(resolve => {
    const socket = connectionFactory({ host: '127.0.0.1', port: 4848 });
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

export async function cleanZeroReplica(options = {}) {
  const projectRoot = path.resolve(
    options.projectRoot ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
  );
  const remove = options.remove ?? rm;
  const logger = options.logger ?? console;
  const portInUse = options.portInUse ?? isZeroCachePortInUse;
  if (await portInUse()) {
    logger.error('Port 4848 ist noch belegt. Stoppe Zero-Cache vor `npm run zero:clean`.');
    return { cleaned: false, reason: 'port-in-use' };
  }

  for (const file of ZERO_REPLICA_FILES) {
    const replicaFile = path.resolve(projectRoot, file);
    await remove(replicaFile, { force: true });
  }
  logger.log('Lokale Zero-Replica entfernt. Postgres- und Anwendungsdaten wurden nicht verändert.');
  return { cleaned: true };
}

export async function runCleanZeroReplicaCli({ clean, processState }) {
  const result = await clean();
  if (!result.cleaned) processState.exitCode = 1;
  return result;
}

await runCliIfMain(
  import.meta.url,
  runCleanZeroReplicaCli.bind(null, { clean: cleanZeroReplica, processState: process })
);
