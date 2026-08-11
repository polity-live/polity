import fs from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('GroupMembershipsContentView action wiring', () => {
  it('wires role configuration actions to tested dialogs with stable identities', () => {
    const source = fs.readFileSync(
      new URL('../GroupMembershipsContentView.tsx', import.meta.url),
      'utf8'
    );

    for (const actionId of [
      'groups.members.roles.select-definitions',
      'groups.members.roles.select-action-rights',
      'groups.members.roles.open-create-from-definitions',
      'groups.members.roles.open-create-from-rights',
      'groups.members.roles.create-submit',
      'groups.members.roles.edit-submit',
    ]) {
      expect(source).toContain(`data-action-id="${actionId}"`);
    }
    expect(source).toMatch(
      /data-action-id="groups\.members\.roles\.create-submit"[\s\S]*?onSubmit=\{handleAddRole\}/
    );
    expect(source).toMatch(
      /data-action-id="groups\.members\.roles\.edit-submit"[\s\S]*?onSubmit=\{handleSaveEditedRole\}/
    );
    expect(source.match(/onClick=\{\(\) => setAddRoleOpen\(true\)\}/g)).toHaveLength(2);
  });
});
