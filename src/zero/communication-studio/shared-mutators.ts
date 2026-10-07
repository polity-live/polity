import { studioCommandSchemas, canvasCommandSchema } from './commands';
import { encodeAppError } from '@/features/shared/errors/app-error';
import type { ReadonlyJSONValue } from '@rocicorp/zero';
import type { z } from 'zod';
import { defineMutator } from '@rocicorp/zero';
import { studioOperationSchema } from '@/features/communication-studio/logic/operations';
function clientCommand<I extends ReadonlyJSONValue, O extends ReadonlyJSONValue>(
  schema: z.ZodType<O, I>
) {
  return defineMutator(schema, async ({ ctx }) => {
    if (!ctx.userID || ctx.userID === 'anon') throw new Error(encodeAppError('permission_denied'));
  });
}
// The editor owns its recoverable optimistic draft. Only a server-confirmed
// operation becomes canonical; conflicts are returned as durable receipts.
export const studioSharedMutators = {
  create: clientCommand(studioCommandSchemas.create),
  duplicate: clientCommand(studioCommandSchemas.duplicate),
  setVisibility: clientCommand(studioCommandSchemas.setVisibility),
  setTemplate: clientCommand(studioCommandSchemas.setTemplate),
  delete: clientCommand(studioCommandSchemas.delete),
  inviteCollaborators: clientCommand(studioCommandSchemas.inviteCollaborators),
  respondInvitation: clientCommand(studioCommandSchemas.respondInvitation),
  removeCollaborator: clientCommand(studioCommandSchemas.removeCollaborator),
  beginUpload: clientCommand(studioCommandSchemas.beginUpload),
  finishUpload: clientCommand(studioCommandSchemas.finishUpload),
  cancelUpload: clientCommand(studioCommandSchemas.cancelUpload),
  requestExport: clientCommand(studioCommandSchemas.requestExport),
  cancelExport: clientCommand(studioCommandSchemas.cancelExport),
  createElementSet: clientCommand(studioCommandSchemas.createElementSet),
  instantiateElementSet: clientCommand(studioCommandSchemas.instantiateElementSet),
  renameElementSet: clientCommand(studioCommandSchemas.renameElementSet),
  archiveElementSet: clientCommand(studioCommandSchemas.archiveElementSet),
  publishElementSet: clientCommand(studioCommandSchemas.publishElementSet),
  synchronizeElements: clientCommand(studioCommandSchemas.synchronizeElements),
  claimEditorActions: clientCommand(studioCommandSchemas.claimEditorActions),
  completeEditorAction: clientCommand(studioCommandSchemas.completeEditorAction),
  canvas: { command: clientCommand(canvasCommandSchema) },
  apply: defineMutator(studioOperationSchema, async ({ ctx }) => {
    if (!ctx.userID || ctx.userID === 'anon') throw new Error('Authentication required');
  }),
};
