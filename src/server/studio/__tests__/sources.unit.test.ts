import { beforeEach, describe, expect, it, vi } from 'vitest';
const io = vi.hoisted(() => ({
  run: vi.fn(),
  event: vi.fn(),
  amendment: vi.fn(),
  statement: vi.fn(),
}));
vi.mock('@/server/zero-mutate', () => ({
  executeZeroRead: (body: (tx: unknown) => unknown) => body({ run: io.run }),
}));
vi.mock('@/zero/rbac/query-access', () => ({
  applyEventQueryAccess: io.event,
  applyAmendmentQueryAccess: io.amendment,
  applyStatementQueryAccess: io.statement,
}));
import { studioSource } from '../sources';
let query: {
  where: ReturnType<typeof vi.fn>;
  orderBy: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
};
beforeEach(() => {
  vi.clearAllMocks();
  query = {
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  };
  for (const method of [io.event, io.amendment, io.statement]) method.mockReturnValue(query);
});
describe('authorized Studio content sources', () => {
  it('uses visibility-scoped queries for every source type and keeps single-item filters within that scope', async () => {
    for (const [type, policy] of [
      ['event', io.event],
      ['amendment', io.amendment],
      ['statement', io.statement],
    ] as const) {
      io.run.mockResolvedValue([{ id: 'visible', title: 'Allowed', updated_at: 4 }]);
      await studioSource('actor', type, 'visible');
      expect(policy.mock.calls.at(-1)![1]).toBe('actor');
      expect(query.where).toHaveBeenLastCalledWith('id', 'visible');
      expect(query.limit).toHaveBeenLastCalledWith(1);
      expect(io.run).toHaveBeenLastCalledWith(query);
      await studioSource('actor', type);
      expect(query.limit).toHaveBeenLastCalledWith(30);
    }
  });
  it('converts rich event text, local time and an address into a readable caption without unrelated metadata', async () => {
    io.run.mockResolvedValue([
      {
        id: 'event',
        title: 'Versammlung',
        description: [
          { type: 'p', children: [{ text: 'Gemeinsam' }, { text: 'entscheiden' }, 123, null, {}] },
        ],
        start_date: Date.UTC(2026, 8, 18, 10),
        timezone: 'Europe/Berlin',
        location_name: 'Rathaus',
        street: 'Platz',
        house_number: '1',
        post_code: '12345',
        city: 'Stadt',
        location_url: 'https://example.org/ort',
        updated_at: 2,
      },
    ]);
    const [source] = await studioSource('actor', 'event', 'event');
    expect(source.text).toContain('Gemeinsam entscheiden');
    expect(source.text).toContain('12:00');
    expect(source.text).toContain('Rathaus Platz 1 12345 Stadt');
    expect(source.text).toContain('https://example.org/ort');
    expect(source).not.toHaveProperty('description');
    io.run.mockResolvedValue([{ id: 'without-zone', start_date: Date.UTC(2026, 8, 18, 10) }]);
    expect((await studioSource('actor', 'event'))[0].text).toContain('12:00');
    io.run.mockResolvedValue([{ id: 'empty' }]);
    expect(await studioSource('actor', 'event')).toEqual([
      { id: 'empty', type: 'event', title: '', text: '', updatedAt: undefined },
    ]);
  });
  it('returns only approved descriptive amendment fields and never imports private discussions or vote metadata', async () => {
    io.run.mockResolvedValue([
      {
        id: 'a',
        title: 'Antrag',
        preamble: 'Präambel',
        reason: 'Begründung',
        discussions: 'Secret',
        votes: ['private'],
        updated_at: 5,
      },
      { id: 'b' },
    ]);
    expect(await studioSource('actor', 'amendment')).toEqual([
      { type: 'amendment', id: 'a', title: 'Antrag', text: 'Präambel\nBegründung', updatedAt: 5 },
      { type: 'amendment', id: 'b', title: '', text: '', updatedAt: undefined },
    ]);
  });
  it('rejects an inaccessible specific statement and supports an empty authorized list', async () => {
    io.run.mockResolvedValue([]);
    await expect(studioSource('actor', 'statement', 'hidden')).rejects.toMatchObject({
      status: 404,
    });
    expect(await studioSource('actor', 'statement')).toEqual([]);
    io.run.mockResolvedValue([
      { id: 'a', title: 'Öffentlich', text: 'Aussage', updated_at: 3 },
      { id: 'b' },
    ]);
    expect(await studioSource('actor', 'statement')).toEqual([
      { type: 'statement', id: 'a', title: 'Öffentlich', text: 'Aussage', updatedAt: 3 },
      { type: 'statement', id: 'b', title: '', text: '', updatedAt: undefined },
    ]);
  });
});
