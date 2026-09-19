import { it, expect } from 'vitest';
it('rejects the retired standalone Studio server before starting a second persistence channel', async () => {
  await expect(import('../collaboration-server')).rejects.toThrow(
    'Standalone Studio collaboration is retired'
  );
});
