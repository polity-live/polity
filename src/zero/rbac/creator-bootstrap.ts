import { DEFAULT_ASSEMBLY_EVENT_GUEST_ROLE, DEFAULT_EVENT_ROLES } from './constants';

export type CreatorRbacScope = 'group' | 'event' | 'amendment' | 'blog';

const CREATOR_RBAC_ID_PREFIX = 'https://polity.live/zero/creator-rbac/v1';

export function creatorEventRoleTemplates(eventType: string | null | undefined) {
  const isAssembly = eventType === 'general_assembly' || eventType === 'delegate_assembly';
  return isAssembly
    ? [
        ...DEFAULT_EVENT_ROLES.map(role => ({
          ...role,
          default_request_role: false,
          default_invite_role: false,
        })),
        DEFAULT_ASSEMBLY_EVENT_GUEST_ROLE,
      ]
    : DEFAULT_EVENT_ROLES;
}

/**
 * Stable IDs keep optimistic RBAC rows addressable by mutations queued directly
 * after create. The server derives the same IDs from its trusted context.
 */
export async function creatorRbacId(
  scope: CreatorRbacScope,
  entityId: string,
  kind: string,
  ...parts: readonly (string | number)[]
) {
  const name = [CREATOR_RBAC_ID_PREFIX, scope, entityId, kind, ...parts]
    .map(part => encodeURIComponent(String(part)))
    .join('/');

  const digest = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(name))
  );
  const bytes = digest.slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function creatorRoleId(scope: CreatorRbacScope, entityId: string, roleName: string) {
  return creatorRbacId(scope, entityId, 'role', roleName);
}

export async function creatorActionRightId(
  scope: CreatorRbacScope,
  entityId: string,
  roleName: string,
  resource: string,
  action: string
) {
  return creatorRbacId(scope, entityId, 'action-right', roleName, resource, action);
}
