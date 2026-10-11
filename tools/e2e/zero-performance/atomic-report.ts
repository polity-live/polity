import { randomUUID } from 'node:crypto';
import { open, rename, unlink } from 'node:fs/promises';

interface ReportWriteOperations {
  rename?: typeof rename;
  sleep?: (milliseconds: number) => Promise<void>;
}

/** Artifact I/O runs between measurements; a locked progress file must not lose query cases. */
export async function writeAtomicReport(
  target: string,
  contents: string,
  operations: ReportWriteOperations = {}
) {
  const temporary = `${target}.tmp-${randomUUID()}`;
  const handle = await open(temporary, 'wx');
  const replace = operations.rename ?? rename;
  const sleep =
    operations.sleep ??
    (milliseconds => new Promise<void>(resolve => setTimeout(resolve, milliseconds)));
  const delays = [25, 50, 100, 200];
  try {
    await handle.writeFile(contents);
    await handle.close();
    for (let attempt = 0; ; attempt++) {
      try {
        await replace(temporary, target);
        return;
      } catch (error) {
        const transient =
          error !== null &&
          typeof error === 'object' &&
          'code' in error &&
          ['EPERM', 'EACCES', 'EBUSY'].includes(String(error.code));
        if (!transient || attempt >= delays.length) throw error;
        await sleep(delays[attempt]);
      }
    }
  } catch (error) {
    await handle.close().catch(() => undefined);
    await unlink(temporary).catch(() => undefined);
    throw error;
  }
}
