import { defineMutator } from '@rocicorp/zero';
import { studioOperationSchema } from '@/features/communication-studio/logic/operations';
import { applyStudioOperation } from '@/server/studio/operations';
import { studioCommandSchemas, canvasCommandSchema } from './commands';
import type { ReadonlyJSONValue } from '@rocicorp/zero';
import type { z } from 'zod';
import { studioCommandResult } from '@/server/studio/command-receipts';
import {
  createProjectFromSelection,
  duplicateProject,
  beginUpload,
  finishUpload,
} from '@/server/studio/service';
import {
  inviteStudioCollaborators,
  respondStudioInvitation,
  removeStudioCollaborator,
} from '@/server/studio/collaborators';
import {
  createElementSet,
  instantiateElementSetForProject,
  renameElementSet,
  archiveElementSet,
  publishElementSetRevision,
  synchronizeProjectElementInstances,
} from '@/server/studio/elements';
import {
  setProjectVisibility,
  setProjectTemplate,
  deleteStudioProject,
  cancelStudioExport,
  claimEditorActions,
  completeEditorAction,
} from '@/server/studio/project-commands';
import { queueCommittedExport } from '@/server/studio/export';
import { canvasCommand } from '@/server/studio/governance';
function command<
  I extends ReadonlyJSONValue,
  O extends ReadonlyJSONValue & { operationId: string },
>(name: string, schema: z.ZodType<O, I>, body: (actor: string, input: O) => Promise<unknown>) {
  return defineMutator(schema, async ({ tx, ctx, args }) => {
    await studioCommandResult(tx, ctx.userID, name, args, () => body(ctx.userID, args));
  });
}
export const studioServerMutators = {
  create: command('create', studioCommandSchemas.create, (actor, args) =>
    createProjectFromSelection(actor, args, args.id)
  ),
  duplicate: command('duplicate', studioCommandSchemas.duplicate, (actor, args) =>
    duplicateProject(actor, args.id, args.groupId, args.visibility, args.destinationId)
  ),
  setVisibility: command('setVisibility', studioCommandSchemas.setVisibility, (actor, args) =>
    setProjectVisibility(actor, args.id, args.visibility)
  ),
  setTemplate: command('setTemplate', studioCommandSchemas.setTemplate, (actor, args) =>
    setProjectTemplate(actor, args.id, args.value)
  ),
  delete: command('delete', studioCommandSchemas.delete, (actor, args) =>
    deleteStudioProject(actor, args.id)
  ),
  inviteCollaborators: command(
    'inviteCollaborators',
    studioCommandSchemas.inviteCollaborators,
    (actor, args) => inviteStudioCollaborators(actor, args.projectId, args.userIds)
  ),
  respondInvitation: command(
    'respondInvitation',
    studioCommandSchemas.respondInvitation,
    (actor, args) => respondStudioInvitation(actor, args.invitationId, args.accept)
  ),
  removeCollaborator: command(
    'removeCollaborator',
    studioCommandSchemas.removeCollaborator,
    (actor, args) => removeStudioCollaborator(actor, args.projectId, args.userId)
  ),
  beginUpload: command('beginUpload', studioCommandSchemas.beginUpload, (actor, args) =>
    beginUpload(actor, args.projectId, args.name, args.mime, args.size, args.workspaceId, args.id)
  ),
  finishUpload: command('finishUpload', studioCommandSchemas.finishUpload, (actor, args) =>
    finishUpload(actor, args.id)
  ),
  cancelUpload: command('cancelUpload', studioCommandSchemas.cancelUpload, (actor, args) =>
    finishUpload(actor, args.id, true)
  ),
  requestExport: command('requestExport', studioCommandSchemas.requestExport, (actor, args) =>
    queueCommittedExport(actor, args.projectId, args.format, args.pageIds, args.revision, args.id)
  ),
  cancelExport: command('cancelExport', studioCommandSchemas.cancelExport, (actor, args) =>
    cancelStudioExport(actor, args.id)
  ),
  createElementSet: command(
    'createElementSet',
    studioCommandSchemas.createElementSet,
    (actor, args) => createElementSet(actor, args)
  ),
  instantiateElementSet: command(
    'instantiateElementSet',
    studioCommandSchemas.instantiateElementSet,
    (actor, args) => instantiateElementSetForProject(actor, args)
  ),
  renameElementSet: command(
    'renameElementSet',
    studioCommandSchemas.renameElementSet,
    (actor, args) => renameElementSet(actor, args.setId, args.name)
  ),
  archiveElementSet: command(
    'archiveElementSet',
    studioCommandSchemas.archiveElementSet,
    (actor, args) => archiveElementSet(actor, args.setId)
  ),
  publishElementSet: command(
    'publishElementSet',
    studioCommandSchemas.publishElementSet,
    (actor, args) => publishElementSetRevision(actor, args)
  ),
  synchronizeElements: command(
    'synchronizeElements',
    studioCommandSchemas.synchronizeElements,
    (actor, args) => synchronizeProjectElementInstances(actor, args.projectId)
  ),
  claimEditorActions: command(
    'claimEditorActions',
    studioCommandSchemas.claimEditorActions,
    (actor, args) => claimEditorActions(actor, args.projectId, args.clientId)
  ),
  completeEditorAction: command(
    'completeEditorAction',
    studioCommandSchemas.completeEditorAction,
    (actor, args) => completeEditorAction(actor, args)
  ),
  canvas: {
    command: defineMutator(canvasCommandSchema, async ({ tx, ctx, args }) => {
      await studioCommandResult(tx, ctx.userID, 'canvas', args, () =>
        canvasCommand(ctx.userID, args)
      );
    }),
  },
  apply: defineMutator(studioOperationSchema, async ({ tx, ctx, args }) => {
    if (!ctx.userID || ctx.userID === 'anon') throw new Error('Authentication required');
    await applyStudioOperation(tx, ctx.userID, args);
  }),
};
