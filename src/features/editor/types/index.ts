/**
 * Unified Editor Types
 *
 * Shared type definitions for the unified editor system.
 * Supports amendments, blogs, standalone documents, and group documents.
 */

// Import TDiscussion for internal use and re-export for external use
import type { TDiscussion as TDiscussionType } from '@/features/shared/ui/kit-platejs/discussion-kit';
import type { EditingMode, NonTerminalEditingMode } from '@/zero/amendments/editing-mode-policy';
import type { Value } from 'platejs';
export type { TDiscussion } from '@/features/shared/ui/kit-platejs/discussion-kit';

/**
 * The type of entity being edited
 */
export type EditorEntityType = 'amendment' | 'blog' | 'document' | 'groupDocument';

/**
 * Editor editing modes
 */
export type EditorMode = NonTerminalEditingMode;

/**
 * Capabilities available for an editor instance
 */
export interface EditorCapabilities {
  /** Whether version control is available */
  versioning: boolean;
  /** Whether real-time presence is shown */
  presence: boolean;
  /** Whether voting on suggestions is available */
  voting: boolean;
  /** Whether mode selection is available */
  modeSelection: boolean;
  /** Whether sharing is available */
  sharing: boolean;
  /** Whether collaborator invites are available */
  invites: boolean;
  /** Whether the content is publicly viewable */
  publicAccess: boolean;
}

/**
 * Default capabilities by entity type
 */
export const DEFAULT_CAPABILITIES: Record<EditorEntityType, EditorCapabilities> = {
  amendment: {
    versioning: true,
    presence: true,
    voting: true,
    modeSelection: true,
    sharing: true,
    invites: true,
    publicAccess: false,
  },
  blog: {
    versioning: true,
    presence: true,
    voting: false,
    modeSelection: true,
    sharing: true,
    invites: true,
    publicAccess: true,
  },
  document: {
    versioning: true,
    presence: true,
    voting: false,
    modeSelection: false,
    sharing: false,
    invites: true,
    publicAccess: false,
  },
  groupDocument: {
    versioning: false,
    presence: true,
    voting: false,
    modeSelection: false,
    sharing: false,
    invites: false,
    publicAccess: false,
  },
};

/**
 * User representation in the editor
 */
export interface EditorUser {
  id: string;
  name: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  avatarUrl?: string;
}

/**
 * Presence peer in a collaborative session
 */
export interface EditorPresencePeer {
  peerId: string;
  userId: string;
  name: string;
  avatar?: string;
  color: string;
}

/**
 * Vote on a suggestion
 */
export interface EditorVote {
  id: string;
  vote: 'accept' | 'reject' | 'abstain';
  voterId: string;
  voterName?: string;
}

/**
 * Discussion/suggestion in the editor
 * This extends the TDiscussion type from plate.js with additional fields
 */
export interface EditorDiscussion {
  id: string;
  crId?: string;
  userId: string;
  userName?: string;
  userAvatar?: string;
  description?: string;
  proposedChange?: string;
  justification?: string;
  createdAt: Date;
  status?: 'pending' | 'accepted' | 'rejected';
  votesFor?: number;
  votesAgainst?: number;
  votesAbstain?: number;
  votingDeadline?: number | null;
  closeTrigger?: string | null;
  eligibleVoterCount?: number;
  votedCollaboratorCount?: number;
  resolutionMethod?: string | null;
  visibilityScope?: string | null;
  resolvedInMode?: string | null;
  votingStatus?: string | null;
  confirmationStatus?: 'pending' | 'confirmed' | null;
  changeRequestStatus?: string | null;
  changeRequestEntityId?: string | null;
  votes?: EditorVote[];
  // Required TDiscussion fields
  comments: EditorComment[];
  isResolved: boolean;
  documentContent?: string;
  title?: string;
  displayCrId?: string;
  branchDisplayNumber?: number;
  branchScopedCrNumber?: number;
  branchSequenceNumber?: number | null;
}

/**
 * Comment in a discussion
 */
export interface EditorComment {
  id: string;
  contentRich: Value;
  createdAt: Date;
  isEdited?: boolean;
  userId: string;
}

/**
 * Document version — matches the Zero `document_version` table + `.related('author')`.
 */
export type { DocumentVersionRow as EditorVersion } from '@/zero/documents/queries';

/**
 * Version creation type
 */
export type VersionCreationType =
  | 'manual'
  | 'suggestion_added'
  | 'suggestion_accepted'
  | 'suggestion_declined';

/**
 * Normalized entity data for the editor
 */
export interface EditorEntity {
  id: string;
  title: string;
  content: Value;
  discussions: TDiscussionType[];
  editingMode: EditorMode;
  visibility: string;
  updatedAt: number;
  owner?: EditorUser;
  collaborators: EditorCollaborator[];
  extraUsers?: EditorUser[];
  canChangeMode?: boolean;
  canVoteOnChangeRequests?: boolean;
  canManageChangeRequestVotes?: boolean;
  /** Entity-specific metadata */
  metadata: EditorEntityMetadata;
}

/**
 * Collaborator in the editor
 */
export interface EditorCollaborator {
  id: string;
  user: EditorUser;
  role?: string;
  roleActionRights?: {
    id: string;
    resource: string;
    action: string;
    amendmentId?: string | null;
  }[];
  canEdit: boolean;
  status?: 'owner' | 'admin' | 'collaborator' | 'member' | 'viewer';
}

/**
 * Entity-specific metadata
 */
export interface EditorEntityMetadata {
  entityType: EditorEntityType;
  /** Amendment-specific */
  amendmentId?: string;
  amendmentCode?: string;
  amendmentEditingMode?: EditingMode | null;
  amendmentStatus?: string;
  processBranchId?: string;
  processBranchStatus?: string;
  processBranchResolution?: string;
  /** Blog-specific */
  blogId?: string;
  blogDate?: string;
  blogUpvotes?: number;
  /** Group-specific */
  groupId?: string;
  groupName?: string;
  canViewDatasets?: boolean;
  canManageDatasets?: boolean;
}

/**
 * Editor context for hooks
 */
export interface EditorContext {
  entityType: EditorEntityType;
  entityId: string;
  userId?: string;
  capabilities: EditorCapabilities;
}

/**
 * Editor state returned by useEditor hook
 */
export interface EditorState {
  // Entity data
  entity: EditorEntity | null;
  isLoading: boolean;
  error: Error | null;

  // Editor state
  title: string;
  content: Value;
  discussions: TDiscussionType[];
  mode: EditorMode;
  modeDisabledReasons: Partial<Record<EditorMode, string>>;
  selectedCrIds: Set<string> | null;

  // Save status
  saveStatus: 'saved' | 'saving' | 'error';
  hasUnsavedChanges: boolean;
  isSavingTitle: boolean;

  // Access
  hasAccess: boolean;
  isOwnerOrCollaborator: boolean;
  canVoteOnChangeRequests: boolean;
  canManageChangeRequestVotes: boolean;

  // Capabilities
  capabilities: EditorCapabilities;
}

/**
 * Editor actions returned by useEditor hook
 */
export interface EditorActions {
  setTitle: (title: string) => void;
  setContent: (content: Value) => void;
  setDiscussions: (discussions: TDiscussionType[]) => void;
  setMode: (mode: EditorMode) => Promise<void>;
  setSelectedCrIds: (crIds: Set<string> | null) => void;
  restoreVersion: (content: Value) => Promise<void>;
}

/**
 * Props for the unified EditorView component
 */
export interface EditorViewProps {
  entityType: EditorEntityType;
  entityId: string;
  userId?: string;
  readOnly?: boolean;
  userRecord?: {
    id: string;
    name?: string;
    email?: string | null;
    avatar?: string;
  };
  /** Override default capabilities */
  capabilities?: Partial<EditorCapabilities>;
  /** Back navigation URL */
  backUrl?: string;
  /** Back navigation label */
  backLabel?: string;
  /** Use tighter spacing above the editor action toolbar */
  compactToolbarSpacing?: boolean;
  /** Render the complete editor action toolbar. */
  showTopToolbar?: boolean;
  /** Agenda item ID for amendment CR voting initialization */
  agendaItemId?: string;
  /** Process branch ID for branch-specific amendment text variants */
  processBranchId?: string | null;
}

/**
 * Props for VersionControl component
 */
export interface VersionControlProps {
  entityType: EditorEntityType;
  entityId: string;
  /** Document ID for amendments/documents, blog ID for blogs */
  versionEntityId: string;
  currentContent: Value;
  currentUserId: string;
  onRestoreVersion: (content: Value) => void;
  onVersionCreated?: (details: {
    changeSummary: string;
    versionId: string;
    versionNumber: number;
  }) => void | Promise<void>;
  /** Amendment-specific props */
  amendmentId?: string;
  amendmentTitle?: string;
}

/**
 * Props for ModeSelector component
 */
export interface ModeSelectorProps {
  entityType: EditorEntityType;
  entityId: string;
  currentMode: EditorMode;
  isOwnerOrCollaborator: boolean;
  onModeChange?: (mode: EditorMode) => void | Promise<void>;
}

/**
 * Props for InviteCollaboratorDialog component
 */
export interface InviteCollaboratorDialogProps {
  entityType: EditorEntityType;
  entityId: string;
  currentUserId: string;
  entityTitle?: string;
  existingCollaboratorIds?: string[];
}

/**
 * Default content for new documents
 */
export const DEFAULT_EDITOR_CONTENT = [
  {
    type: 'p',
    children: [{ text: '' }],
  },
];

/**
 * Default content messages by entity type
 */
export const DEFAULT_CONTENT_MESSAGES: Record<EditorEntityType, string> = {
  amendment: 'Start typing the amendment text...',
  blog: 'Start writing your blog post...',
  document: 'Start typing...',
  groupDocument: 'Start typing...',
};
