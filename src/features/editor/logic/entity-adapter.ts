/**
 * Entity Adapter Utilities
 *
 * Adapts different entity structures (amendments, blogs, documents)
 * to a common EditorEntity shape for the unified editor.
 */

import type {
  EditorEntity,
  EditorEntityType,
  EditorEntityMetadata,
  EditorCollaborator,
  EditorUser,
  TDiscussion,
  EditorMode,
} from '../types';
import { DEFAULT_EDITOR_CONTENT } from '../types';
import {
  getAmendmentPermissionFlags,
  getAmendmentRoleCollaborators,
  isActiveAmendmentCollaborator,
  mapRoleActionRights,
} from '@/features/amendments/logic/amendmentPermissions';
import { decorateBranchScopedChangeRequests } from '@/features/change-requests/logic/branchScopedDisplay';
import { applyResolvedSuggestionsToContent } from '@/features/change-requests/logic/applySuggestionToContent';
import { isTerminalEditingMode, normalizeEditingMode } from '@/zero/amendments/editing-mode-policy';

// Raw entity type for adapter function parameters.
// These receive untyped data from various Zero query shapes.
// Using `any` here at the system boundary is intentional to avoid
// duplicating Zero's complex inferred return types.

type RawEntity = Record<string, any>;

function mapEditorCollaboratorStatus(
  status: string | null | undefined
): EditorCollaborator['status'] {
  if (status === 'admin' || status === 'member' || status === 'collaborator') return status;
  if (status === 'owner' || status === 'viewer') return status;
  return 'collaborator';
}

function hasAmendmentVoteRight(collaborator: RawEntity, amendmentId: string): boolean {
  return mapRoleActionRights(collaborator.role?.action_rights).some(
    right =>
      right.resource === 'amendments' &&
      right.action === 'vote' &&
      (!right.amendment?.id || right.amendment.id === amendmentId)
  );
}

/**
 * Ensures every element node in a Plate/Slate tree has a valid `children` array.
 * Prevents `Array.from(undefined)` crashes in Slate's rendering pipeline.
 */

function sanitizeContent(nodes: any[]): any[] {
  return nodes.map(node => {
    if (node == null || typeof node !== 'object') return node;
    // Text leaf — must have `text` property, no children
    if ('text' in node) return node;
    // Element node — must have children array
    const children =
      Array.isArray(node.children) && node.children.length > 0
        ? sanitizeContent(node.children)
        : [{ text: '' }];
    return { ...node, children };
  });
}

/**
 * Builds a display name from first_name / last_name / email fields.
 */
function buildUserName(user: RawEntity, fallback = 'Unknown'): string {
  const first = user.first_name?.trim() ?? '';
  const last = user.last_name?.trim() ?? '';
  const full = `${first} ${last}`.trim();
  return full || user.email || fallback;
}

function buildEditorUser(user: RawEntity, fallback = 'Unknown'): EditorUser {
  const firstName = user.first_name?.trim() || null;
  const lastName = user.last_name?.trim() || null;

  return {
    id: user.id,
    name: buildUserName(user, fallback),
    firstName,
    lastName,
    email: user.email,
    avatarUrl: user.avatar ?? undefined,
  };
}

/**
 * Maps an amendment's editing_mode value to an EditorMode.
 * Terminal states (passed/rejected) are shown as 'view' in the editor.
 */
function mapEditorMode(mode: string | null | undefined): EditorMode {
  const normalizedMode = normalizeEditingMode(mode);
  return isTerminalEditingMode(normalizedMode) ? 'view' : normalizedMode;
}

function getGroupDatasetRights(group: RawEntity | null | undefined, userId?: string) {
  if (!group || !userId) return { canViewDatasets: false, canManageDatasets: false };
  if (group.owner_id === userId) return { canViewDatasets: true, canManageDatasets: true };

  const activeMembershipStatuses = new Set(['active', 'member', 'admin']);
  const memberships = Array.isArray(group.memberships)
    ? group.memberships.filter(
        (membership: RawEntity) =>
          (membership.user_id === userId || membership.user?.id === userId) &&
          activeMembershipStatuses.has(membership.status)
      )
    : [];
  const guestAccesses = Array.isArray(group.guest_accesses)
    ? group.guest_accesses.filter(
        (access: RawEntity) =>
          (access.user_id === userId || access.user?.id === userId) && access.status === 'active'
      )
    : [];
  const roleLinks = [
    ...memberships.flatMap((membership: RawEntity) => membership.membership_roles ?? []),
    ...guestAccesses.flatMap((access: RawEntity) => access.guest_roles ?? []),
  ];
  const rights = roleLinks.flatMap((link: RawEntity) => link.role?.action_rights ?? []);
  const canManageDatasets = rights.some(
    (right: RawEntity) => right.resource === 'groupDatasets' && right.action === 'manage'
  );
  const canViewDatasets =
    memberships.length > 0 ||
    canManageDatasets ||
    rights.some(
      (right: RawEntity) => right.resource === 'groupDatasets' && right.action === 'view'
    );
  return { canViewDatasets, canManageDatasets };
}

function mapChangeRequestStatusToDiscussionStatus(status: string | null | undefined) {
  if (status === 'accepted' || status === 'approved') return 'accepted';
  if (status === 'rejected' || status === 'declined') return 'rejected';
  return undefined;
}

function normalizeInternalCRVotingCloseTrigger(value: string | null | undefined) {
  return value === 'after_minutes' ? 'after_minutes' : 'all_collaborators_voted';
}

function enrichAmendmentDiscussionsWithChangeRequests(
  amendment: RawEntity,
  processBranches: readonly RawEntity[] = []
): TDiscussion[] {
  // The private caller normalizes both collections in withBranchChangeRequestContext.
  const discussions = amendment.discussions as TDiscussion[];
  const changeRequests = amendment.change_requests as RawEntity[];
  const activeCollaborators = getAmendmentRoleCollaborators(amendment).filter(
    isActiveAmendmentCollaborator
  );
  const activeVotingCollaborators = activeCollaborators.filter(collaborator =>
    hasAmendmentVoteRight(collaborator, amendment.id)
  );
  const changeRequestById = new Map<string, RawEntity>();
  const changeRequestByTitle = new Map<string, RawEntity>();
  const displayChangeRequests = decorateBranchScopedChangeRequests(
    processBranches as { id: string; created_at?: number | string | null }[],
    changeRequests.map((changeRequest: RawEntity) => ({
      id: changeRequest.id,
      process_branch_id: changeRequest.process_branch_id ?? null,
      cr_id: changeRequest.title ?? null,
      title: changeRequest.title ?? null,
      branch_sequence_number: changeRequest.branch_sequence_number ?? null,
      created_at: changeRequest.created_at ?? null,
    }))
  );
  const displayChangeRequestById = new Map(displayChangeRequests.map(row => [row.id, row]));

  for (const changeRequest of changeRequests) {
    if (changeRequest.id) changeRequestById.set(changeRequest.id, changeRequest);
    if (changeRequest.title) changeRequestByTitle.set(changeRequest.title, changeRequest);
  }

  return discussions.map(discussion => {
    const changeRequest =
      (discussion.changeRequestEntityId
        ? changeRequestById.get(discussion.changeRequestEntityId)
        : undefined) ?? (discussion.crId ? changeRequestByTitle.get(discussion.crId) : undefined);

    if (!changeRequest) {
      return discussion;
    }

    const discussionStatus = mapChangeRequestStatusToDiscussionStatus(changeRequest.status);
    const displayChangeRequest = changeRequest.id
      ? displayChangeRequestById.get(changeRequest.id)
      : undefined;

    return {
      ...discussion,
      changeRequestEntityId: changeRequest.id ?? discussion.changeRequestEntityId,
      changeRequestStatus: changeRequest.status ?? null,
      displayCrId: displayChangeRequest?.displayCrId ?? discussion.displayCrId ?? discussion.crId,
      branchDisplayNumber: displayChangeRequest?.branchDisplayNumber,
      branchScopedCrNumber: displayChangeRequest?.branchScopedCrNumber,
      branchSequenceNumber: changeRequest.branch_sequence_number ?? null,
      confirmationStatus:
        changeRequest.status === 'pending_submission'
          ? (discussion.confirmationStatus ?? 'pending')
          : 'confirmed',
      confirmedAt: discussion.confirmedAt,
      status: discussionStatus ?? discussion.status,
      votesFor: changeRequest.votes_for ?? 0,
      votesAgainst: changeRequest.votes_against ?? 0,
      votesAbstain: changeRequest.votes_abstain ?? 0,
      votingDeadline: changeRequest.voting_deadline ?? null,
      closeTrigger: normalizeInternalCRVotingCloseTrigger(
        amendment.internal_cr_voting_close_trigger
      ),
      eligibleVoterCount: activeVotingCollaborators.length,
      votedCollaboratorCount:
        (changeRequest.votes_for ?? 0) +
        (changeRequest.votes_against ?? 0) +
        (changeRequest.votes_abstain ?? 0),
      resolutionMethod: changeRequest.resolution_method ?? null,
      visibilityScope: changeRequest.visibility_scope ?? null,
      resolvedInMode: changeRequest.resolved_in_mode ?? null,
      votingStatus: changeRequest.voting_status ?? null,
      votes: (changeRequest.votes ?? []).map((vote: RawEntity) => ({
        id: vote.id,
        vote: vote.vote ?? '',
        voterId: vote.user_id,
      })),
    };
  });
}

const READONLY_PROCESS_BRANCH_STATUSES = new Set(['rejected', 'withdrawn', 'completed']);
const READONLY_PROCESS_BRANCH_RESOLUTIONS = new Set(['merge_loser', 'rejected', 'withdrawn']);

function isReadonlyProcessBranch(branch?: RawEntity | null) {
  if (!branch) return false;
  return (
    READONLY_PROCESS_BRANCH_STATUSES.has(branch.status ?? '') ||
    READONLY_PROCESS_BRANCH_RESOLUTIONS.has(branch.resolution ?? '')
  );
}

function getProcessBranchCreatedAt(branch: RawEntity) {
  const createdAt = branch.created_at;
  if (typeof createdAt === 'number') return createdAt;
  if (typeof createdAt === 'string') {
    const parsed = Date.parse(createdAt);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function withBranchChangeRequestContext(
  amendment: RawEntity,
  processBranch?: RawEntity | null,
  processBranches: readonly RawEntity[] = []
) {
  const branchId = processBranch?.id ?? null;
  const firstBranch = [...processBranches].sort((left, right) => {
    const byCreatedAt = getProcessBranchCreatedAt(left) - getProcessBranchCreatedAt(right);
    return byCreatedAt !== 0 ? byCreatedAt : String(left.id).localeCompare(String(right.id));
  })[0];
  const isFirstBranch = Boolean(branchId && firstBranch?.id === branchId);
  const branchDiscussions = Array.isArray(processBranch?.discussions)
    ? processBranch.discussions
    : [];
  const amendmentDiscussions = Array.isArray(amendment.discussions) ? amendment.discussions : [];
  const sourceDiscussions = branchId
    ? isFirstBranch
      ? [
          ...new Map(
            [...amendmentDiscussions, ...branchDiscussions].map(discussion => [
              discussion.id,
              discussion,
            ])
          ).values(),
        ]
      : branchDiscussions
    : amendmentDiscussions;
  const changeRequests = Array.isArray(amendment.change_requests) ? amendment.change_requests : [];
  const scopedChangeRequests = changeRequests
    .filter((changeRequest: RawEntity) =>
      branchId
        ? changeRequest.process_branch_id === branchId ||
          (isFirstBranch && !changeRequest.process_branch_id)
        : !changeRequest.process_branch_id
    )
    .map((changeRequest: RawEntity) =>
      branchId && isFirstBranch && !changeRequest.process_branch_id
        ? { ...changeRequest, process_branch_id: branchId }
        : changeRequest
    );

  return {
    ...amendment,
    discussions: sourceDiscussions,
    change_requests: scopedChangeRequests,
  };
}

interface AdaptAmendmentOptions {
  processBranch?: RawEntity | null;
  processBranches?: readonly RawEntity[];
}

/**
 * Adapts an amendment with its document to EditorEntity
 */
export function adaptAmendmentToEntity(
  amendment: RawEntity | undefined | null,
  document: RawEntity | undefined | null,
  userId?: string,
  options: AdaptAmendmentOptions = {}
): EditorEntity | null {
  if (!amendment || !document) return null;
  const processBranch = options.processBranch ?? null;
  const processBranches =
    options.processBranches ??
    (Array.isArray(amendment.current_process_run?.branches)
      ? amendment.current_process_run.branches
      : []);
  const amendmentContext = withBranchChangeRequestContext(
    amendment,
    processBranch,
    processBranches
  );

  const owner: EditorUser | undefined = document.owner
    ? buildEditorUser(document.owner, 'Owner')
    : undefined;

  const collaborators: EditorCollaborator[] = [];
  const extraUsers: EditorUser[] = [];

  // Add document collaborators
  if (document.collaborators) {
    document.collaborators.forEach((collab: RawEntity) => {
      if (collab.user?.id) {
        collaborators.push({
          id: collab.id,
          user: buildEditorUser(collab.user, 'Collaborator'),
          canEdit: collab.canEdit ?? true,
          status: 'collaborator',
        });
      }
    });
  }

  // Add amendment role collaborators
  const amendmentRoleCollaborators = getAmendmentRoleCollaborators(amendmentContext);
  if (amendmentRoleCollaborators.length) {
    amendmentRoleCollaborators.forEach((collab: RawEntity) => {
      if (!collab.user?.id) return;

      const roleActionRights = mapRoleActionRights(collab.role?.action_rights).map(right => ({
        id: right.id,
        resource: right.resource,
        action: right.action,
        amendmentId: right.amendment?.id,
      }));
      const status = mapEditorCollaboratorStatus(collab.status);
      const existingCollaborator = collaborators.find(c => c.user.id === collab.user.id);

      if (existingCollaborator) {
        existingCollaborator.role = collab.role?.name ?? existingCollaborator.role;
        existingCollaborator.roleActionRights = roleActionRights;
        existingCollaborator.status = status;
        existingCollaborator.canEdit = true;
      } else {
        collaborators.push({
          id: collab.id,
          user: buildEditorUser(collab.user, 'Collaborator'),
          role: collab.role?.name,
          roleActionRights,
          canEdit: true,
          status,
        });
      }
    });
  }

  const knownUserIds = new Set<string>([
    ...(owner?.id ? [owner.id] : []),
    ...collaborators.map(collaborator => collaborator.user.id),
  ]);

  amendmentContext.change_requests.forEach((changeRequest: RawEntity) => {
    if (!changeRequest.user?.id || knownUserIds.has(changeRequest.user.id)) return;
    knownUserIds.add(changeRequest.user.id);
    extraUsers.push(buildEditorUser(changeRequest.user, 'Participant'));
  });

  const datasetRights = getGroupDatasetRights(amendment.group, userId);
  const metadata: EditorEntityMetadata = {
    entityType: 'amendment',
    amendmentId: amendment.id,
    amendmentCode: amendment.code,
    amendmentEditingMode: normalizeEditingMode(
      processBranch?.editing_mode ?? document.editing_mode
    ),
    groupId: amendment.group_id ?? undefined,
    groupName: amendment.group?.name ?? undefined,
    ...datasetRights,
    processBranchId: processBranch?.id,
    processBranchStatus: processBranch?.status,
    processBranchResolution: processBranch?.resolution,
  };

  const storedContent =
    Array.isArray(document.content) && document.content.length > 0
      ? sanitizeContent(document.content)
      : DEFAULT_EDITOR_CONTENT;
  const content = applyResolvedSuggestionsToContent(
    storedContent,
    amendmentContext.change_requests
  );
  const permissionFlags = getAmendmentPermissionFlags(amendmentContext, userId);
  const isBranchReadonly = isReadonlyProcessBranch(processBranch);

  return {
    id: document.id,
    title: document.title || amendment.title || '',
    content,
    discussions: enrichAmendmentDiscussionsWithChangeRequests(amendmentContext, processBranches),
    editingMode: isBranchReadonly
      ? 'view'
      : mapEditorMode(processBranch?.editing_mode ?? document.editing_mode),
    visibility: document.visibility ?? 'public',
    updatedAt: document.updated_at || Date.now(),
    owner,
    collaborators,
    extraUsers,
    ...permissionFlags,
    canChangeMode: permissionFlags.canChangeMode && !isBranchReadonly,
    metadata,
  };
}

/**
 * Adapts a blog to EditorEntity
 */
export function adaptBlogToEntity(blog: RawEntity | undefined | null): EditorEntity | null {
  if (!blog) return null;

  const collaborators: EditorCollaborator[] = [];

  // Add bloggers as collaborators (Zero relation name is 'bloggers')
  if (blog.bloggers) {
    blog.bloggers.forEach((blogger: RawEntity) => {
      if (blogger.user?.id) {
        collaborators.push({
          id: blogger.id,
          user: buildEditorUser(blogger.user, 'Blogger'),
          role: blogger.role?.name,
          canEdit: true,
          status:
            blogger.status === 'owner'
              ? 'owner'
              : blogger.status === 'admin'
                ? 'admin'
                : 'collaborator',
        });
      }
    });
  }

  // Find owner from bloggers
  const ownerBlogger = blog.bloggers?.find((b: RawEntity) => b.status === 'owner');
  const owner: EditorUser | undefined = ownerBlogger?.user
    ? buildEditorUser(ownerBlogger.user, 'Owner')
    : undefined;

  const metadata: EditorEntityMetadata = {
    entityType: 'blog',
    blogId: blog.id,
    blogDate: blog.date,
    blogUpvotes: blog.upvotes,
    groupId: blog.group_id,
  };

  return {
    id: blog.id,
    title: blog.title || '',
    content:
      Array.isArray(blog.content) && blog.content.length > 0
        ? sanitizeContent(blog.content)
        : DEFAULT_EDITOR_CONTENT,
    discussions: (blog.discussions || []) as TDiscussion[],
    editingMode: mapEditorMode(blog.editing_mode),
    visibility: blog.visibility ?? 'public',
    updatedAt: blog.updated_at || Date.now(),
    owner,
    collaborators,
    metadata,
  };
}

/**
 * Adapts a standalone document to EditorEntity
 */
export function adaptDocumentToEntity(document: RawEntity | undefined | null): EditorEntity | null {
  if (!document) return null;

  const owner: EditorUser | undefined = document.owner
    ? buildEditorUser(document.owner, 'Owner')
    : undefined;

  const collaborators: EditorCollaborator[] = [];

  if (document.collaborators) {
    document.collaborators.forEach((collab: RawEntity) => {
      if (collab.user?.id) {
        collaborators.push({
          id: collab.id,
          user: buildEditorUser(collab.user, 'Collaborator'),
          canEdit: collab.canEdit ?? true,
          status: 'collaborator',
        });
      }
    });
  }

  const metadata: EditorEntityMetadata = {
    entityType: 'document',
  };

  const content =
    Array.isArray(document.content) && document.content.length > 0
      ? sanitizeContent(document.content)
      : DEFAULT_EDITOR_CONTENT;

  return {
    id: document.id,
    title: document.title || document.amendment?.title || '',
    content,
    discussions: (document.discussions || []) as TDiscussion[],
    editingMode: mapEditorMode(document.editing_mode),
    visibility: document.visibility ?? 'public',
    updatedAt: document.updated_at || Date.now(),
    owner,
    collaborators,
    metadata,
  };
}

/**
 * Adapts a group document to EditorEntity
 */
export function adaptGroupDocumentToEntity(
  document: RawEntity | undefined | null,
  groupId: string,
  groupName?: string
): EditorEntity | null {
  if (!document) return null;

  const owner: EditorUser | undefined = document.owner
    ? buildEditorUser(document.owner, 'Owner')
    : undefined;

  const collaborators: EditorCollaborator[] = [];

  if (document.collaborators) {
    document.collaborators.forEach((collab: RawEntity) => {
      if (collab.user?.id) {
        collaborators.push({
          id: collab.id,
          user: buildEditorUser(collab.user, 'Collaborator'),
          canEdit: collab.canEdit ?? true,
          status: 'collaborator',
        });
      }
    });
  }

  const metadata: EditorEntityMetadata = {
    entityType: 'groupDocument',
    groupId: groupId || document.amendment?.group_id || '',
    groupName,
  };

  const content =
    Array.isArray(document.content) && document.content.length > 0
      ? sanitizeContent(document.content)
      : DEFAULT_EDITOR_CONTENT;

  return {
    id: document.id,
    title: document.title || document.amendment?.title || '',
    content,
    discussions: (document.discussions || []) as TDiscussion[],
    editingMode: mapEditorMode(document.editing_mode),
    visibility: document.visibility ?? 'public',
    updatedAt: document.updated_at || Date.now(),
    owner,
    collaborators,
    metadata,
  };
}

/**
 * Adapts entities to EditorEntity based on type
 */
export function adaptToEditorEntity(
  entityType: EditorEntityType,
  data: RawEntity,
  options?: { groupId?: string; groupName?: string }
): EditorEntity | null {
  switch (entityType) {
    case 'amendment':
      return adaptAmendmentToEntity(data.amendment, data.document);
    case 'blog':
      return adaptBlogToEntity(data);
    case 'document':
      return adaptDocumentToEntity(data);
    case 'groupDocument':
      return adaptGroupDocumentToEntity(data, options?.groupId || '', options?.groupName);
    default:
      return null;
  }
}

/**
 * Builds a users map for the PlateEditor from an EditorEntity
 */
export function buildEditorUsersMap(
  entity: EditorEntity | null,
  currentUser?: EditorUser
): Record<string, { id: string; name: string; avatarUrl: string }> {
  const users: Record<string, { id: string; name: string; avatarUrl: string }> = {};

  // Add current user
  if (currentUser) {
    users[currentUser.id] = {
      id: currentUser.id,
      name: currentUser.name || 'Anonymous',
      avatarUrl:
        currentUser.avatarUrl || `https://api.dicebear.com/9.x/glass/svg?seed=${currentUser.id}`,
    };
  }

  if (!entity) return users;

  // Add owner
  if (entity.owner) {
    users[entity.owner.id] = {
      id: entity.owner.id,
      name: entity.owner.name || 'Owner',
      avatarUrl:
        entity.owner.avatarUrl || `https://api.dicebear.com/9.x/glass/svg?seed=${entity.owner.id}`,
    };
  }

  // Add collaborators
  entity.collaborators.forEach(collab => {
    if (collab.user?.id && !users[collab.user.id]) {
      users[collab.user.id] = {
        id: collab.user.id,
        name: collab.user.name || 'Collaborator',
        avatarUrl:
          collab.user.avatarUrl || `https://api.dicebear.com/9.x/glass/svg?seed=${collab.user.id}`,
      };
    }
  });

  return users;
}

/**
 * Checks if a user has access to an entity
 */
export function checkEntityAccess(entity: EditorEntity | null, userId?: string): boolean {
  if (!entity) return false;
  if (entity.visibility === 'public') return true;
  if (entity.visibility === 'authenticated' && !!userId) return true;
  if (!userId) return false;
  if (entity.owner?.id === userId) return true;
  return entity.collaborators.some(c => c.user.id === userId);
}

/**
 * Checks if a user is an owner or collaborator with edit rights
 */
export function checkIsOwnerOrCollaborator(entity: EditorEntity | null, userId?: string): boolean {
  if (!entity || !userId) return false;
  if (entity.owner?.id === userId) return true;
  return entity.collaborators.some(
    c => c.user.id === userId && (c.status === 'owner' || c.status === 'admin' || c.canEdit)
  );
}
