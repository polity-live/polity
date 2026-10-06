import { beforeEach, expect, it, vi } from 'vitest';
const audience = vi.hoisted(() => vi.fn());
vi.mock('@/server/studio/ai-sources', () => ({ resolveProjectSources: audience }));
import { sharedAttachments, sharedUserContent } from '../attachments';

beforeEach(() => {
  audience.mockReset();
});

it('shares only authorized server sources and discards supplied prompt/card content', async () => {
  audience.mockResolvedValueOnce([
    {
      entityType: 'event',
      entityId: 'event-1',
      title: 'Server title',
      prompt_context: 'Server content',
      href: '/event/event-1',
    },
  ]);
  audience.mockRejectedValueOnce(new Error('Access denied'));
  const result = await sharedAttachments('actor', { kind: 'studio', projectId: 'project-1' }, [
    {
      entityType: 'event',
      entityId: 'event-1',
      title: 'CLIENT TITLE',
      prompt_context: 'PRIVATE SENTINEL',
    },
    { entityType: 'amendment', entityId: 'private-1', title: 'PRIVATE TITLE' },
  ]);
  expect(result.omittedCount).toBe(1);
  expect(result.attachments).toEqual([
    {
      entityType: 'event',
      entityId: 'event-1',
      title: 'Server title',
      prompt_context: 'Server content',
      href: '/event/event-1',
    },
  ]);
  const prompt = sharedUserContent('Current instruction', JSON.stringify(result));
  expect(prompt).toContain('untrusted data');
  expect(prompt).toContain('Server content');
  expect(prompt).not.toContain('PRIVATE');
  expect(prompt).not.toContain('CLIENT');
});

it('keeps plain messages readable when their optional context is invalid', () => {
  expect(sharedUserContent('Instruction', 'invalid json')).toBe('Instruction');
});

it('does not copy private chat uploads into a shared project message', async () => {
  const result = await sharedAttachments('actor', { kind: 'studio', projectId: 'project-1' }, [
    {
      entityType: 'document',
      entityId: 'editor-uploads/1-report.txt',
      title: 'FORGED',
      prompt_context: 'PRIVATE',
      card_data_json: '{"fileUrl":"https://attacker.invalid"}',
    },
  ]);

  expect(audience).not.toHaveBeenCalled();
  expect(result.attachments).toEqual([]);
  expect(result.omittedCount).toBe(1);
  expect(JSON.stringify(result)).not.toContain('FORGED');
  expect(JSON.stringify(result)).not.toContain('attacker.invalid');
});
