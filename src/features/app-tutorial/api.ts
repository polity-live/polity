import { createClient } from '@/lib/supabase/client';
import type {
  PublicAppTutorialRun,
  TutorialAdvanceEvidence,
  TutorialAdvanceResult,
} from '@/server/app-tutorial/service';
import type { AppTutorialCheckpointId } from './catalog';
import { activateAppTutorialSession, deactivateAppTutorialSession } from './events';
import { throwAppError, toAppError } from '@/features/shared/errors/app-error';

async function tutorialRequest<T>(init?: RequestInit): Promise<T> {
  const {
    data: { session },
  } = await createClient().auth.getSession();
  if (!session?.access_token) {
    deactivateAppTutorialSession();
    throwAppError('permission_denied');
  }
  const response = await fetch('/api/tutorial', {
    ...init,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${session.access_token}`,
      ...init?.headers,
    },
  });
  const result = (await response.json()) as T & { error?: unknown };
  if (!response.ok) {
    if (response.status === 401) {
      deactivateAppTutorialSession();
    }
    throw toAppError(result, 'tutorial_operation_failed');
  }
  return result;
}

export async function loadTutorialRun() {
  const result = await tutorialRequest<{ run: PublicAppTutorialRun | null }>();
  if (result.run) {
    activateAppTutorialSession();
  } else {
    deactivateAppTutorialSession();
  }
  return result;
}

export async function startTutorial(restart = false) {
  const result = await tutorialRequest<{ run: PublicAppTutorialRun }>({
    method: 'POST',
    body: JSON.stringify({ action: restart ? 'restart' : 'start' }),
  });
  activateAppTutorialSession();
  return result;
}

export async function pauseTutorial(expectedRevision: number) {
  const result = await tutorialRequest<{ run: PublicAppTutorialRun }>({
    method: 'POST',
    body: JSON.stringify({ action: 'pause', expectedRevision }),
  });
  deactivateAppTutorialSession();
  return result;
}

export async function cleanupTutorial(expectedRevision?: number) {
  await tutorialRequest<{ ok: true }>({
    method: 'POST',
    body: JSON.stringify({ action: 'cleanup', expectedRevision }),
  });
  deactivateAppTutorialSession();
}

export async function restartTutorial() {
  return startTutorial(true);
}

export async function advanceTutorial(
  expectedRevision: number,
  checkpointId: AppTutorialCheckpointId,
  evidence: TutorialAdvanceEvidence
) {
  const result = await tutorialRequest<TutorialAdvanceResult>({
    method: 'POST',
    body: JSON.stringify({
      action: 'advance',
      expectedRevision,
      checkpointId,
      evidence,
    }),
  });
  if (result.completed) {
    deactivateAppTutorialSession();
  }
  return result;
}
