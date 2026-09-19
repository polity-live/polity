import { beforeEach, describe, expect, it, vi } from 'vitest';
const io = vi.hoisted(() => ({ create: vi.fn(), query: vi.fn() }));
vi.mock('../store', () => ({ createStored: io.create }));
import { initializeTransactionDocuments } from '../finalize';
beforeEach(() => {
  vi.clearAllMocks();
});
describe('Studio transaction initialization', () => {
  it('initializes only Studio projects without reading legacy editors', async () => {
    io.query
      .mockResolvedValueOnce([{ active: true, needed: true }])
      .mockResolvedValueOnce([{ project_id: 'studio', document: { title: 'Saved' } }]);
    await initializeTransactionDocuments({ query: io.query });
    expect(io.query).toHaveBeenCalledTimes(2);
    expect(io.create).toHaveBeenCalledExactlyOnceWith(
      expect.anything(),
      { kind: 'studio', entityId: 'studio', branchId: null, workspaceId: null },
      { title: 'Saved' },
      null
    );
  });
  it.each([undefined, { active: false, needed: true }, { active: true, needed: false }])(
    'does not initialize outside an active creation transaction',
    async control => {
      io.query.mockResolvedValueOnce(control ? [control] : []);
      await initializeTransactionDocuments({ query: io.query });
      expect(io.create).not.toHaveBeenCalled();
    }
  );
});
