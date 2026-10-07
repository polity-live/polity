import { z } from 'zod';
export const canvasPhaseSchema = z.enum(['edit', 'view', 'suggest_internal', 'vote_internal']);
export type CanvasPhase = z.infer<typeof canvasPhaseSchema>;
export interface CanvasCapabilities {
  read: boolean;
  edit: boolean;
  suggest: boolean;
  comment: boolean;
  vote: boolean;
  manage: boolean;
}
export interface CanvasProposal {
  id: string;
  origin?: 'human' | 'ai';
  ai_mode?: 'template' | 'free' | null;
  ai_status?: 'generating' | 'ready';
  ai_sources?: { type: string; id: string; fetchedAt: number }[];
  ai_warnings?: string[];
  title: string;
  reason: string;
  owner_id: string;
  shared_ids: string[];
  revision: number;
  base_revision: number;
  state: 'draft' | 'submitted' | 'voting' | 'closed' | 'withdrawn';
  decision: 'accepted' | 'rejected' | null;
  application: 'pending' | 'applied' | 'conflict' | 'not_applicable' | 'superseded';
  resolves_id: string | null;
  deadline: number | null;
  electorate: string[] | null;
  changes:
    | {
        path: string[];
        before: { exists?: boolean; value?: unknown };
        after: { exists?: boolean; value?: unknown };
      }[]
    | null;
  votes: { user_id: string; choice: string }[];
}
export interface CanvasSession {
  canEditProject: boolean;
  adoptionGroups: { id: string; name: string | null }[];
  groupId: string | null;
  phase: CanvasPhase;
  generation: string;
  capabilities: CanvasCapabilities;
  proposals: CanvasProposal[];
  comments: {
    id: string;
    proposal_id: string | null;
    author_id: string;
    element_id: string | null;
    body: string;
    resolved: boolean;
  }[];
  revisions: { id: string; revision: number; created_at: number }[];
  members: { id: string; first_name: string | null; last_name: string | null }[];
  roles: {
    id: string;
    name: string | null;
    capabilities: Partial<Record<'suggest' | 'comment' | 'vote', boolean>>;
  }[];
}
