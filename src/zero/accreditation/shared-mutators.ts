import { defineMutator } from '@rocicorp/zero';
import { requireAuthenticated } from '../rbac/authorize';
import {
  decideAccreditationSchema,
  deleteAccreditationSchema,
  requestAccreditationSchema,
} from './schema';

const serverOnlyRequest = defineMutator(requestAccreditationSchema, async ({ tx, ctx }) => {
  requireAuthenticated(tx, ctx, { action: 'create', resource: 'accreditations' });
  // The server verifies the PIN, participant relation and current state.
});

const serverOnlyDecision = defineMutator(decideAccreditationSchema, async () => {
  // Accreditation decisions are intentionally not optimistic.
});

export const accreditationSharedMutators = {
  requestAccreditation: serverOnlyRequest,
  // Backwards-compatible name for existing clients during rollout.
  confirmAccreditation: serverOnlyRequest,
  approveAccreditation: serverOnlyDecision,
  rejectAccreditation: serverOnlyDecision,
  revokeAccreditation: serverOnlyDecision,

  deleteAccreditation: defineMutator(deleteAccreditationSchema, async ({ tx }) => {
    if (tx.location !== 'client') {
      throw new Error('Accreditations are retained for their append-only audit history.');
    }
  }),
};
