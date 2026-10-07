import type { CanvasSession } from '@/features/communication-studio/logic/governance';
import type { StudioAsset } from '@/features/communication-studio/hooks/useStudioDocument';

interface UserRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
}
interface RoleRow {
  id: string;
  name: string | null;
  group_id?: string | null;
  canvas_capabilities?: readonly { capability: string; allowed: boolean }[];
}
interface MembershipRow {
  user_id: string;
  user?: UserRow;
  membership_roles?: readonly {
    role?: RoleRow;
    studio_project_rights?: readonly { resource: string | null; action: string | null }[];
  }[];
}
export interface SessionProject {
  id: string;
  group_id: string | null;
  owner_id: string;
  owner?: UserRow;
  collaborators?: readonly { user_id: string; user?: UserRow }[];
  group?: {
    owner_id: string | null;
    owner?: UserRow;
    memberships?: readonly MembershipRow[];
    roles?: readonly RoleRow[];
  };
}
export function studioCapabilities(project: SessionProject, actor: string, phase: string) {
  const assigned =
    project.group?.memberships?.find(m => m.user_id === actor)?.membership_roles ?? [];
  const manager =
    project.owner_id === actor ||
    project.group?.owner_id === actor ||
    assigned.some(a =>
      a.studio_project_rights?.some(r => r.resource === 'projects' && r.action === 'manage')
    );
  const edit = project.group_id === null || manager;
  const allowed = (capability: string) =>
    !assigned.some(
      a =>
        a.role?.group_id === project.group_id &&
        a.role?.canvas_capabilities?.some(c => c.capability === capability && !c.allowed)
    );
  return {
    read: true,
    edit: edit && phase === 'edit',
    suggest: allowed('suggest'),
    comment: allowed('comment'),
    vote: allowed('vote'),
    manage: manager,
  };
}
export function procedureMembers(project: SessionProject): UserRow[] {
  const members = project.group
    ? [project.group.owner, ...(project.group.memberships ?? []).map(m => m.user)]
    : [project.owner, ...(project.collaborators ?? []).map(c => c.user)];
  return [
    ...new Map(members.filter((u): u is UserRow => Boolean(u)).map(u => [u.id, u])).values(),
  ].sort((a, b) => a.id.localeCompare(b.id));
}
export function procedureRoles(
  project: SessionProject,
  canManage: boolean
): CanvasSession['roles'] {
  return canManage
    ? (project.group?.roles ?? []).map(role => ({
        id: role.id,
        name: role.name,
        capabilities: Object.fromEntries(
          (role.canvas_capabilities ?? []).map(c => [c.capability, c.allowed])
        ),
      }))
    : [];
}
export function studioAssetUrls(
  assets: readonly { id: string; name: string; mime_type: string }[]
): StudioAsset[] {
  return assets.map(asset => ({
    id: asset.id,
    name: asset.name,
    mime: asset.mime_type,
    url: `/api/studio/media/${asset.id}`,
  }));
}
