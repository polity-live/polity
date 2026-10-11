import { expect, it } from 'vitest';
import {
  studioCapabilities,
  procedureMembers,
  procedureRoles,
  studioAssetUrls,
  type SessionProject,
} from '../projections';
const user = { id: 'owner', first_name: 'Ada', last_name: null };
it.each([
  ['event-creator', 'edit', true],
  ['event-creator', 'view', false],
  ['event-manager', 'edit', true],
  ['event-manager', 'view', false],
] as const)(
  'projects filtered event-manager access for %s in the %s phase',
  (actor, phase, canEdit) => {
    const project: SessionProject = {
      id: 'event-project',
      owner_id: 'project-owner',
      group_id: 'group',
      event_id: 'event',
      // sessionProject filters this relation through event Studio manager access.
      event: { id: 'event' },
      group: {
        owner_id: 'group-owner',
        memberships: [
          {
            user_id: actor,
            membership_roles: [
              {
                role: {
                  id: 'group-role',
                  name: null,
                  group_id: 'group',
                  canvas_capabilities: [
                    { capability: 'comment', allowed: false },
                    { capability: 'suggest', allowed: true },
                    { capability: 'vote', allowed: true },
                  ],
                },
              },
            ],
          },
        ],
      },
    };
    expect(studioCapabilities(project, actor, phase)).toEqual({
      read: true,
      edit: canEdit,
      suggest: false,
      comment: true,
      vote: false,
      manage: true,
    });
  }
);

it.each(['project-owner', 'group-owner', 'group-manager', 'public-reader', 'outsider'])(
  'keeps a readable event project read-only without the event-manager relation for %s',
  actor => {
    const project: SessionProject = {
      id: 'public-event-project',
      owner_id: 'project-owner',
      group_id: 'group',
      event_id: 'public-event',
      group: {
        owner_id: 'group-owner',
        memberships: [
          {
            user_id: 'group-manager',
            membership_roles: [
              { studio_project_rights: [{ resource: 'projects', action: 'manage' }] },
            ],
          },
        ],
      },
    };
    // Read access has already admitted the project; an absent manager relation
    // must not fall back to personal or group project management rights.
    for (const phase of ['edit', 'view']) {
      expect(studioCapabilities(project, actor, phase)).toEqual({
        read: true,
        edit: false,
        suggest: false,
        comment: false,
        vote: false,
        manage: false,
      });
    }
  }
);

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
