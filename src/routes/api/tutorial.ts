import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

import { getSession } from '@/lib/supabase/server';
import { AppTutorialDatabaseUnavailableError } from '@/server/app-tutorial/db';
import {
  AppTutorialEffectPendingError,
  advanceAppTutorial,
  cleanupAppTutorial,
  getAppTutorialRun,
  isAppTutorialCheckpointId,
  pauseAppTutorial,
  startOrResumeAppTutorial,
} from '@/server/app-tutorial/service';
import { appErrorHttpBody, appErrorHttpBodyFrom } from '@/features/shared/errors/app-error';

const evidenceSchema = z.object({
  type: z
    .enum([
      'acknowledge',
      'action',
      'click',
      'drop',
      'entity-selection',
      'input',
      'mutation',
      'view',
      'scroll',
    ])
    .optional(),
  anchor: z.string().optional(),
  entityId: z.string().optional(),
  value: z.string().optional(),
  event: z.string().optional(),
  scrollPixels: z.number().nonnegative().optional(),
  scrollRangePixels: z.number().nonnegative().optional(),
  desktopAcknowledged: z.boolean().optional(),
});

const requestSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('start') }),
  z.object({ action: z.literal('restart') }),
  z.object({ action: z.literal('pause'), expectedRevision: z.number().int().nonnegative() }),
  z.object({
    action: z.literal('advance'),
    expectedRevision: z.number().int().nonnegative(),
    checkpointId: z.string(),
    evidence: evidenceSchema,
  }),
  z.object({
    action: z.literal('cleanup'),
    expectedRevision: z.number().int().nonnegative().optional(),
  }),
]);

function errorStatus(error: unknown) {
  if (error instanceof z.ZodError) return 400;
  if (error instanceof AppTutorialDatabaseUnavailableError) return 503;
  const message = error instanceof Error ? error.message : '';
  if (message.includes('conflict') || message.includes('paused')) return 409;
  if (
    message.includes('required') ||
    message.includes('Expected') ||
    message.includes('not found')
  ) {
    return 422;
  }
  return 500;
}

function tutorialErrorResponse(error: unknown) {
  if (!(error instanceof AppTutorialDatabaseUnavailableError)) {
    console.error('[app-tutorial]', error);
  }
  return Response.json(
    error instanceof z.ZodError
      ? appErrorHttpBody('validation_failed')
      : appErrorHttpBodyFrom(error, 'tutorial_operation_failed'),
    { status: errorStatus(error) }
  );
}

export const Route = createFileRoute('/api/tutorial')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const session = await getSession(request);
          if (!session?.user) {
            return Response.json(appErrorHttpBody('permission_denied'), { status: 401 });
          }
          return Response.json({ run: await getAppTutorialRun(session.user.id) });
        } catch (error) {
          return tutorialErrorResponse(error);
        }
      },
      POST: async ({ request }) => {
        let userId: string | null = null;

        try {
          const session = await getSession(request);
          if (!session?.user) {
            return Response.json(appErrorHttpBody('permission_denied'), { status: 401 });
          }
          userId = session.user.id;
          const body = requestSchema.parse(await request.json());
          if (body.action === 'start' || body.action === 'restart') {
            return Response.json({
              run: await startOrResumeAppTutorial(userId, body.action === 'restart'),
            });
          }
          if (body.action === 'pause') {
            return Response.json({
              run: await pauseAppTutorial(userId, body.expectedRevision),
            });
          }
          if (body.action === 'cleanup') {
            await cleanupAppTutorial(userId, body.expectedRevision);
            return Response.json({ ok: true });
          }
          if (!isAppTutorialCheckpointId(body.checkpointId)) {
            return Response.json(appErrorHttpBody('validation_failed'), { status: 400 });
          }
          return Response.json(
            await advanceAppTutorial(
              userId,
              body.expectedRevision,
              body.checkpointId,
              body.evidence
            )
          );
        } catch (error) {
          if (error instanceof AppTutorialEffectPendingError && userId) {
            const run = await getAppTutorialRun(userId);
            return Response.json(
              {
                completed: false,
                pending: true,
                route: run?.route ?? '/onboarding',
                run: run ?? undefined,
              },
              { status: 202 }
            );
          }
          return tutorialErrorResponse(error);
        }
      },
    },
  },
});
