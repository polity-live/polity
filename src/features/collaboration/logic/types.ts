import { z } from 'zod';

export const documentKindSchema = z.enum(['document', 'blog', 'city', 'studio']);
export const documentReferenceSchema = z.object({
  kind: documentKindSchema,
  entityId: z.string().uuid(),
  branchId: z.string().uuid().nullable().default(null),
  workspaceId: z.string().uuid().nullable().default(null),
});
export type CollaborationReference = z.infer<typeof documentReferenceSchema>;
export type DocumentKind = CollaborationReference['kind'];
export interface CollaborationCapabilities {
  read: boolean;
  edit: boolean;
  suggest: boolean;
  comment: boolean;
  vote: boolean;
  manage: boolean;
}
export interface CollaborationSession {
  id: string;
  reference: CollaborationReference;
  generation: string;
  revision: number;
  checksum: string;
  state: string;
  capabilities: CollaborationCapabilities;
  websocket: string;
  room: string;
  transport?: 'websocket' | 'http';
  draftAction?: 'proposal' | 'publish';
  integrityError?: string;
  readableRevision?: number;
}
export class CollaborationError extends Error {
  constructor(
    public code: string,
    public status = 409
  ) {
    super(code);
    this.name = 'CollaborationError';
  }
}
export function roomName(id: string, generation: string) {
  return `${id}:${generation}`;
}
export function parseRoom(name: string) {
  const [id, generation, extra] = name.split(':');
  if (
    extra !== undefined ||
    !z.string().uuid().safeParse(id).success ||
    !z.string().uuid().safeParse(generation).success
  ) {
    throw new CollaborationError('invalid_room', 400);
  }
  return { id, generation };
}
