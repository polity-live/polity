import { z } from 'zod';
import { createStudioProjectSchema, exportStudioSchema } from './schema';
import { studioChangeSchema } from '@/features/communication-studio/logic/operations';
import { canvasPhaseSchema } from '@/features/communication-studio/logic/governance';

const uuid = z.string().uuid();
const project = { projectId: uuid };
const operation = { operationId: uuid };
const workspace = { ...project, ...operation, generation: uuid, workspaceId: uuid };
const revision = z.number().int().nonnegative();
const text = z.string().trim().min(1).max(200);
const changes = z.array(studioChangeSchema).max(20000);
const canvasBase = { ...project, ...operation, generation: uuid, revision: revision.optional() };
export const canvasCommandSchema = z.discriminatedUnion('action', [
  z.object({ ...canvasBase, action: z.literal('phase'), revision, phase: canvasPhaseSchema }),
  z.object({
    ...canvasBase,
    action: z.literal('createDraft'),
    revision,
    title: text,
    reason: z.string().max(10000).optional(),
  }),
  z.object({
    ...workspace,
    action: z.literal('resolveDraft'),
    revision,
    title: text,
    reason: z.string().max(10000).optional(),
  }),
  z.object({ ...workspace, action: z.literal('saveDraft'), revision, changes }),
  z.object({ ...workspace, action: z.literal('share'), revision, userIds: z.array(uuid).max(200) }),
  z.object({
    ...workspace,
    action: z.literal('submit'),
    revision,
    title: text.optional(),
    reason: z.string().max(10000).optional(),
  }),
  z.object({ ...workspace, action: z.literal('withdraw') }),
  z.object({
    ...workspace,
    action: z.literal('startVote'),
    minutes: z.number().int().min(1).max(43200).default(5),
  }),
  z.object({
    ...workspace,
    action: z.literal('vote'),
    choice: z.enum(['accept', 'reject', 'abstain']),
  }),
  z.object({ ...workspace, action: z.literal('finalize') }),
  z.object({ ...workspace, action: z.literal('reapply') }),
  z.object({ ...workspace, action: z.literal('acceptPrivate'), revision }),
  z.object({ ...workspace, action: z.literal('rejectPrivate'), revision }),
  z.object({ ...canvasBase, action: z.literal('adopt'), revision, groupId: uuid }),
  z.object({
    ...canvasBase,
    action: z.literal('comment'),
    workspaceId: uuid.optional(),
    body: z.string().trim().min(1).max(10000),
    elementId: z.string().max(200).nullable().optional(),
  }),
  z.object({
    ...canvasBase,
    action: z.literal('editComment'),
    workspaceId: uuid.optional(),
    commentId: uuid,
    body: z.string().trim().min(1).max(10000),
  }),
  z.object({
    ...canvasBase,
    action: z.literal('resolveComment'),
    workspaceId: uuid.optional(),
    commentId: uuid,
  }),
  z.object({ ...canvasBase, action: z.literal('restore'), revision, historyId: uuid }),
  z.object({
    ...canvasBase,
    action: z.literal('saveLibrary'),
    title: text,
    library: z.array(z.json()).max(1000),
  }),
  z.object({
    ...canvasBase,
    action: z.literal('setCapability'),
    roleId: uuid,
    capability: z.enum(['suggest', 'comment', 'vote']),
    allowed: z.boolean(),
  }),
]);
export const studioCommandSchemas = {
  create: createStudioProjectSchema.extend({ ...operation, id: uuid }),
  duplicate: z.object({
    ...operation,
    id: uuid,
    destinationId: uuid,
    groupId: uuid.nullable().default(null),
    visibility: z.enum(['public', 'authenticated', 'private']).default('private'),
  }),
  setVisibility: z.object({
    ...operation,
    id: uuid,
    visibility: z.enum(['public', 'authenticated', 'private']),
  }),
  setTemplate: z.object({ ...operation, id: uuid, value: z.boolean() }),
  delete: z.object({ ...operation, id: uuid }),
  inviteCollaborators: z.object({
    ...operation,
    ...project,
    userIds: z.array(uuid).min(1).max(20),
  }),
  respondInvitation: z.object({ ...operation, invitationId: uuid, accept: z.boolean() }),
  removeCollaborator: z.object({ ...operation, ...project, userId: uuid }),
  beginUpload: z.object({
    ...operation,
    ...project,
    id: uuid,
    workspaceId: uuid.optional(),
    name: text,
    mime: z.enum(['image/png', 'image/jpeg', 'image/webp', 'video/mp4']),
    size: z
      .number()
      .int()
      .min(1)
      .max(100 * 1024 * 1024),
  }),
  finishUpload: z.object({ ...operation, id: uuid }),
  cancelUpload: z.object({ ...operation, id: uuid }),
  requestExport: exportStudioSchema.extend({ ...operation, id: uuid }),
  cancelExport: z.object({ ...operation, id: uuid }),
  createElementSet: z.object({
    ...operation,
    ...project,
    groupId: uuid.nullable().default(null),
    selectedIds: z.array(uuid).min(1).max(5000),
    name: z.string().trim().min(1).max(120).optional(),
  }),
  instantiateElementSet: z.object({
    ...operation,
    ...project,
    setId: uuid,
    workspaceId: uuid.optional(),
  }),
  renameElementSet: z.object({
    ...operation,
    setId: uuid,
    name: z.string().trim().min(1).max(120),
  }),
  archiveElementSet: z.object({ ...operation, setId: uuid }),
  publishElementSet: z.object({ ...operation, ...project, instanceId: uuid }),
  synchronizeElements: z.object({ ...operation, ...project }),
  claimEditorActions: z.object({ ...operation, ...project, clientId: uuid }),
  completeEditorAction: z.object({
    ...operation,
    ...project,
    id: uuid,
    clientId: uuid,
    result: z.object({
      status: z.enum(['completed', 'failed']),
      error: z.string().max(1000).optional(),
      revision: revision.optional(),
      projectId: uuid.optional(),
    }),
  }),
};
export type StudioCommand = keyof typeof studioCommandSchemas;
export type StudioCommandInput<K extends StudioCommand> = z.input<(typeof studioCommandSchemas)[K]>;
export type CanvasCommandInput = z.input<typeof canvasCommandSchema>;
