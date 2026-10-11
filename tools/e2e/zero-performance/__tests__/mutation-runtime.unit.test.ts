import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  access: vi.fn(async () => undefined),
  cases: [{ name: 'fixture.update', variant: 'authorized', actor: 'owner' }],
  validate: vi.fn(() => [] as string[]),
}));
vi.mock('node:fs/promises', () => ({ access: state.access }));
vi.mock('../mutation-catalog', () => ({
  loadMutationCases: () => state.cases,
  registeredMutationNames: () => ['fixture.update'],
  validateMutationCases: state.validate,
  mutationExpectation: (entry: unknown) => ({ entry }),
  mutationCaseManifest: () => [{ name: 'fixture.update' }],
}));
import { mutationInventory } from '../mutation-runtime';
beforeEach(() => {
  vi.clearAllMocks();
  state.access.mockResolvedValue(undefined);
  state.validate.mockReturnValue([]);
});
afterEach(() => vi.restoreAllMocks());
describe('revision mutation inventory boundary', () => {
  it('bootstraps only absent revision catalogs and propagates genuine filesystem failures', async () => {
    state.access.mockRejectedValueOnce(Object.assign(new Error('absent'), { code: 'ENOENT' }));
    expect(await mutationInventory()).toMatchObject({
      cases: [],
      expectations: [],
      bootstrap: expect.any(String),
    });
    state.access.mockRejectedValueOnce(Object.assign(new Error('denied'), { code: 'EACCES' }));
    await expect(mutationInventory()).rejects.toThrow('denied');
  });
  it('accepts only a registered filtered inventory with validated real cases', async () => {
    expect((await mutationInventory('fixture.update')).cases).toEqual(state.cases);
    await expect(mutationInventory('unknown.action')).rejects.toThrow(
      'no registered catalog cases'
    );
    state.validate.mockReturnValue(['missing oracle']);
    await expect(mutationInventory('fixture.update')).rejects.toThrow('missing oracle');
  });
});
