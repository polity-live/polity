import { z } from 'zod';
import { repairDocument } from './repair';
import { getSession } from '@/lib/supabase/server';
import { CollaborationError, documentReferenceSchema } from '@/features/collaboration/logic/types';
import {
  acceptUpdate,
  createWorkspace,
  openSession,
  readSession,
  listWorkspaces,
  shareWorkspace,
} from './service';
import { submitWorkspace } from './proposals';
import { restoreVersion } from './commands';
import { changeComment, commentOperationSchema, listComments } from './comments';
import { rebaseDraft, resumeDraft, revisions } from './recovery';

const uuid = z.string().uuid();
const requestSchema = z.discriminatedUnion('operation', [
  z.object({
    operation: z.literal('repair'),
    id: uuid,
    generation: uuid,
    expectedRevision: z.number().int().positive(),
    operationId: uuid,
  }),
  z.object({ operation: z.literal('revisions'), id: uuid, generation: uuid }),
  z.object({
    operation: z.literal('resume'),
    id: uuid,
    generation: uuid,
    expectedRevision: z.number().int().positive(),
    operationId: uuid,
    value: z.unknown(),
  }),
  z.object({
    operation: z.literal('rebase'),
    id: uuid,
    generation: uuid,
    expectedRevision: z.number().int().positive(),
    operationId: uuid,
  }),
  z.object({ operation: z.literal('proposals'), id: uuid, generation: uuid }),
  z.object({ operation: z.literal('comments'), id: uuid, generation: uuid }),
  z.object({
    operation: z.literal('comment'),
    id: uuid,
    generation: uuid,
    operationId: uuid,
    change: commentOperationSchema,
  }),
  z.object({
    operation: z.literal('retryDecision'),
    id: uuid,
    generation: uuid,
    expectedRevision: z.number().int().positive(),
    changeRequestId: uuid,
    operationId: uuid,
  }),
  z.object({ operation: z.literal('session'), reference: documentReferenceSchema }),
  z.object({ operation: z.literal('workspaces'), reference: documentReferenceSchema }),
  z.object({ operation: z.literal('share'), id: uuid, generation: uuid, shared: z.boolean() }),
  z.object({ operation: z.literal('read'), id: uuid, generation: uuid }),
  z.object({
    operation: z.literal('restore'),
    id: uuid,
    generation: uuid,
    expectedRevision: z.number().int().positive(),
    operationId: uuid,
    value: z.unknown(),
  }),
  z.object({
    operation: z.literal('flush'),
    id: uuid,
    generation: uuid,
    state: z.string().max(16_000_000),
  }),
  z.object({
    operation: z.literal('submit'),
    id: uuid,
    generation: uuid,
    expectedRevision: z.number().int().positive(),
    operationId: uuid,
  }),
  z.object({
    operation: z.literal('registerSuggestion'),
    id: uuid,
    generation: uuid,
    expectedRevision: z.number().int().positive(),
    changeRequestId: uuid,
    suggestionId: z.string().min(1).max(200),
  }),
  z.object({
    operation: z.literal('resolve'),
    id: uuid,
    generation: uuid,
    expectedRevision: z.number().int().positive(),
    changeRequestId: uuid,
    result: z.enum(['accepted', 'rejected']),
    operationId: uuid,
  }),
  z.object({
    operation: z.literal('workspace'),
    id: uuid,
    generation: uuid,
    expectedRevision: z.number().int().positive(),
    operationId: uuid,
    type: z.enum(['proposal', 'followup']),
  }),
]);
export async function handleCollaboration(request: Request) {
  try {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin)
      throw new CollaborationError('invalid_origin', 403);
    const auth = await getSession(request);
    if (!auth) throw new CollaborationError('authentication_required', 401);
    const data = await request.json().catch(() => {
      throw new CollaborationError('invalid_request', 400);
    });
    const body = requestSchema.parse(data);
    let result: unknown;
    if (body.operation === 'repair')
      result = await repairDocument(
        auth.user.id,
        body.id,
        body.generation,
        body.expectedRevision,
        body.operationId
      );
    else if (body.operation === 'revisions')
      result = await revisions(auth.user.id, body.id, body.generation);
    else if (body.operation === 'resume')
      result = await resumeDraft(
        auth.user.id,
        body.id,
        body.generation,
        body.expectedRevision,
        body.operationId,
        body.value
      );
    else if (body.operation === 'rebase')
      result = await rebaseDraft(
        auth.user.id,
        body.id,
        body.generation,
        body.expectedRevision,
        body.operationId
      );
    else if (body.operation === 'proposals')
      throw new CollaborationError('legacy_editor_required', 410);
    else if (body.operation === 'comments')
      result = await listComments(auth.user.id, body.id, body.generation);
    else if (body.operation === 'comment')
      result = await changeComment(
        auth.user.id,
        body.id,
        body.generation,
        body.operationId,
        body.change
      );
    else if (body.operation === 'retryDecision')
      throw new CollaborationError('legacy_editor_required', 410);
    else if (body.operation === 'session') result = await openSession(auth.user.id, body.reference);
    else if (body.operation === 'workspaces')
      result = await listWorkspaces(auth.user.id, body.reference);
    else if (body.operation === 'share')
      result = await shareWorkspace(auth.user.id, body.id, body.generation, body.shared);
    else if (body.operation === 'read')
      result = await readSession(auth.user.id, body.id, body.generation);
    else if (body.operation === 'restore')
      result = await restoreVersion(
        auth.user.id,
        body.id,
        body.generation,
        body.expectedRevision,
        body.operationId,
        body.value
      );
    else if (body.operation === 'registerSuggestion' || body.operation === 'resolve')
      throw new CollaborationError('legacy_editor_required', 410);
    else if (body.operation === 'submit')
      result = await submitWorkspace(
        auth.user.id,
        body.id,
        body.generation,
        body.expectedRevision,
        body.operationId
      );
    else if (body.operation === 'flush') {
      await acceptUpdate(auth.user.id, body.id, body.generation, Buffer.from(body.state, 'base64'));
      result = await readSession(auth.user.id, body.id, body.generation);
    } else
      result = await createWorkspace(
        auth.user.id,
        body.id,
        body.generation,
        body.expectedRevision,
        body.operationId,
        body.type
      );
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const status =
      error instanceof CollaborationError ? error.status : error instanceof z.ZodError ? 400 : 500;
    if (status === 500) console.error('Collaboration request failed', error);
    return Response.json(
      {
        error:
          error instanceof CollaborationError
            ? error.code
            : status === 400
              ? 'invalid_request'
              : 'collaboration_failed',
      },
      { status, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
