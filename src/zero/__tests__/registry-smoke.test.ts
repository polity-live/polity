import { describe, expect, it } from 'vitest';

import { mutators } from '../mutators';
import { queries } from '../queries';
import { schema } from '../schema';
import { serverMutators } from '../server-mutators';

describe('Zero registry smoke tests', () => {
  it('loads the composed schema, query registry, and mutator registries without a database', () => {
    expect(schema.tables.user).toBeDefined();
    expect(schema.tables.group).toBeDefined();
    expect(schema.tables.event).toBeDefined();
    expect(schema.tables.amendment).toBeDefined();

    expect(queries.users.current).toBeDefined();
    expect(queries.groups.byId).toBeDefined();
    expect(queries.events.byIdFull).toBeDefined();
    expect(queries.amendments.byIdFull).toBeDefined();
    expect(queries.network.allGroupConnections).toBeDefined();

    expect(mutators.users.updateProfile).toBeDefined();
    expect(mutators.groups.create).toBeDefined();
    expect(mutators.events.create).toBeDefined();
    expect(mutators.amendments.create).toBeDefined();
    expect(mutators.network.createGroupConnection).toBeDefined();

    expect(serverMutators.groups.create).toBeDefined();
    expect(serverMutators.events.create).toBeDefined();
    expect(serverMutators.amendments.initializeProcessPath).toBeDefined();
    expect(serverMutators.votes.castIndicativeVote).toBeDefined();
    expect(serverMutators.network.createGroupConnection).toBeDefined();
  });
});
