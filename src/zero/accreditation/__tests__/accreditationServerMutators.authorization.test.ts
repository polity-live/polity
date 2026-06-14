import { describe, expect, it, vi } from 'vitest';

import { PermissionError } from '../../rbac/errors';
import { accreditationServerMutators } from '../server-mutators';

type AccreditationMutatorInput = Parameters<
  typeof accreditationServerMutators.confirmAccreditation.fn
>[0];
type AccreditationMutatorTx = AccreditationMutatorInput['tx'];
type AccreditationMutatorCtx = AccreditationMutatorInput['ctx'];

function createTx(location: AccreditationMutatorTx['location'] = 'server') {
  return {
    clientID: 'client-1',
    mutationID: 1,
    reason: 'test',
    location,
    run: vi.fn(),
    mutate: {
      accreditation: {
        insert: vi.fn(),
      },
    },
  };
}

function createCtx(userID = 'user-1'): AccreditationMutatorCtx {
  return {
    userID,
    email: `${userID}@example.com`,
  };
}

describe('accreditationServerMutators authorization', () => {
  it('rejects anonymous accreditation confirmation before checking the voting password', async () => {
    const tx = createTx('server');

    await expect(
      accreditationServerMutators.confirmAccreditation.fn({
        tx: tx as never,
        ctx: createCtx('anon'),
        args: {
          event_id: 'event-1',
          agenda_item_id: 'agenda-1',
          password: '1234',
        },
      })
    ).rejects.toThrow(PermissionError);

    expect(tx.run).not.toHaveBeenCalled();
    expect(tx.mutate.accreditation.insert).not.toHaveBeenCalled();
  });
});
