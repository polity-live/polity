import { rename } from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';

const transientCodes = new Set(['EPERM', 'EACCES', 'EBUSY']);
const retryDelays = [25, 50, 100, 200, 400, 400, 400];

/** Keep the previous complete report visible while a temporary file is replaced. */
export async function replaceReportFile(temporary: string, target: string) {
  for (let attempt = 0; ; attempt++) {
    try {
      await rename(temporary, target);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException | null)?.code;
      if (!code || !transientCodes.has(code) || attempt >= retryDelays.length) throw error;
      // Windows readers can briefly prevent replacement. Retry outside measured
      // query work; a persistent failure must still abort this worker.
      await setTimeout(retryDelays[attempt]);
    }
  }
}
