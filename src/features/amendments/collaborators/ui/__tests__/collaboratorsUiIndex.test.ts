import { describe, expect, it } from 'vitest';

import * as collaboratorsUi from '../index';
import { CollaboratorsView } from '../CollaboratorsView';
import { InviteDialog } from '../InviteDialog';
import { RolesManagementCard } from '../RolesManagementCard';

describe('collaborators UI public surface', () => {
  it('exports every supported collaborator component from the domain entry point', () => {
    expect(collaboratorsUi.CollaboratorsView).toBe(CollaboratorsView);
    expect(collaboratorsUi.InviteDialog).toBe(InviteDialog);
    expect(collaboratorsUi.RolesManagementCard).toBe(RolesManagementCard);
  });
});
