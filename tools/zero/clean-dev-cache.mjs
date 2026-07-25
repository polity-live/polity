import { rm } from 'node:fs/promises';
import { createConnection } from 'node:net';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const replicaFiles = ['zero.db', 'zero.db-wal', 'zero.db-wal2', 'zero.db-shm'].map(file =>
  path.resolve(projectRoot, file)
);

function isZeroCachePortInUse() {
  return new Promise(resolve => {
    const socket = createConnection({ host: '127.0.0.1', port: 4848 });
    socket.setTimeout(1_500);
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

if (await isZeroCachePortInUse()) {
  console.error('Port 4848 ist noch belegt. Stoppe Zero-Cache vor `npm run zero:clean`.');
  process.exitCode = 1;
} else {
  for (const replicaFile of replicaFiles) {
    if (path.dirname(replicaFile) !== projectRoot) {
      throw new Error(`Unsicheres Replica-Ziel verweigert: ${replicaFile}`);
    }
    await rm(replicaFile, { force: true });
  }

  console.log(
    'Lokale Zero-Replica entfernt. Postgres- und Anwendungsdaten wurden nicht verändert.'
  );
}
