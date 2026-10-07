import { expect, it } from 'vitest';
import {
  studioCapabilities,
  procedureMembers,
  procedureRoles,
  studioAssetUrls,
  type SessionProject,
} from '../projections';
const user = { id: 'owner', first_name: 'Ada', last_name: null };
it('derives capabilities from personal collaboration and assigned group roles without granting readers management', () => {
  const project: SessionProject = { id: 'p', owner_id: 'owner', group_id: null };
  expect(studioCapabilities(project, 'owner', 'edit')).toEqual({
    read: true,
    edit: true,
    manage: true,
    suggest: true,
    comment: true,
    vote: true,
  });
  expect(studioCapabilities(project, 'collaborator', 'view')).toMatchObject({
    edit: false,
    manage: false,
  });
  const role = {
    id: 'r',
    name: 'Manager',
    group_id: 'g',
    group_action_rights: [{ resource: 'projects', action: 'manage' }],
    canvas_capabilities: [{ capability: 'vote', allowed: false }],
  };
  project.group_id = 'g';
  project.group = {
    owner_id: 'group-owner',
    memberships: [
      { user_id: 'reader', membership_roles: [] },
      {
        user_id: 'manager',
        membership_roles: [
          { role, studio_project_rights: role.group_action_rights },
          {},
          { role: { id: 'other', name: null, group_id: 'g' } },
        ],
      },
    ],
    roles: [role, { id: 'bare', name: null }],
  };
  expect(studioCapabilities(project, 'reader', 'edit')).toMatchObject({
    edit: false,
    manage: false,
    vote: true,
  });
  expect(studioCapabilities(project, 'manager', 'edit')).toMatchObject({
    edit: true,
    manage: true,
    vote: false,
  });
  expect(studioCapabilities(project, 'group-owner', 'edit').manage).toBe(true);
  role.group_action_rights = [
    { resource: 'other', action: 'manage' },
    { resource: 'projects', action: 'view' },
  ];
  project.group.memberships![1].membership_roles![0].studio_project_rights =
    role.group_action_rights;
  expect(studioCapabilities(project, 'manager', 'edit').manage).toBe(false);
  expect(procedureRoles(project, true)).toEqual([
    { id: 'r', name: 'Manager', capabilities: { vote: false } },
    { id: 'bare', name: null, capabilities: {} },
  ]);
  expect(procedureRoles(project, false)).toEqual([]);
  expect(procedureRoles({ ...project, group: undefined }, true)).toEqual([]);
});
it('deduplicates authorized members and derives only the existing protected media URLs', () => {
  const project: SessionProject = { id: 'p', owner_id: 'owner', group_id: null };
  expect(procedureMembers(project)).toEqual([]);
  project.owner = user;
  project.collaborators = [
    { user_id: 'owner', user },
    { user_id: 'z', user: { ...user, id: 'z' } },
    { user_id: 'missing' },
  ];
  expect(procedureMembers(project).map(u => u.id)).toEqual(['owner', 'z']);
  project.group = { owner_id: 'owner', owner: user };
  expect(procedureMembers(project)).toEqual([user]);
  project.group.memberships = [
    { user_id: 'owner', user },
    { user_id: 'a', user: { ...user, id: 'a' } },
  ];
  expect(procedureMembers(project).map(u => u.id)).toEqual(['a', 'owner']);
  expect(studioAssetUrls([{ id: 'asset', name: 'Media', mime_type: 'image/png' }])).toEqual([
    { id: 'asset', name: 'Media', mime: 'image/png', url: '/api/studio/media/asset' },
  ]);
});
