import { beforeEach, expect, it, vi } from 'vitest';
const canonical = vi.hoisted(() => vi.fn());
const upload = vi.hoisted(() => vi.fn());
vi.mock('@/server/ai-tools', () => ({ resolveAiAttachmentForUser: canonical }));
vi.mock('../upload-attachments', () => ({ resolveOwnedUploadAttachment: upload }));
vi.mock('@/server/ai-db', () => ({
  enrichAiAttachmentsForPrompt: async (attachments: unknown[]) => attachments,
}));
import { sharedAttachments, sharedUserContent } from '../attachments';
import type { ZeroTransaction } from '@/server/zero-mutate';

beforeEach(() => {
  canonical.mockReset();
  upload.mockReset();
});

it('shares only authorized server sources and discards supplied prompt/card content', async () => {
  canonical.mockResolvedValueOnce({
    entityType: 'event',
    entityId: 'event-1',
    title: 'Server title',
    prompt_context: 'Server content',
    href: '/event/event-1',
  });
  canonical.mockRejectedValueOnce(new Error('Access denied'));
  const tx = {
    run: vi.fn().mockResolvedValue({ group_id: 'group-1' }),
  } as unknown as ZeroTransaction;
  const result = await sharedAttachments(tx, 'actor', { kind: 'studio', projectId: 'project-1' }, [
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

it('shares uploads only through canonical owner-checked storage metadata', async () => {
  upload.mockResolvedValueOnce({
    entityType: 'document',
    entityId: 'editor-uploads/1-report.txt',
    title: 'report.txt',
    prompt_context: 'Server file content',
  });
  const result = await sharedAttachments(
    {} as ZeroTransaction,
    'actor',
    { kind: 'studio', projectId: 'project-1' },
    [
      {
        entityType: 'document',
        entityId: 'editor-uploads/1-report.txt',
        title: 'FORGED',
        prompt_context: 'PRIVATE',
        card_data_json: '{"fileUrl":"https://attacker.invalid"}',
      },
    ]
  );

  expect(upload).toHaveBeenCalledWith('actor', 'editor-uploads/1-report.txt');
  expect(canonical).not.toHaveBeenCalled();
  expect(result.attachments).toEqual([
    expect.objectContaining({ title: 'report.txt', prompt_context: 'Server file content' }),
  ]);
  expect(JSON.stringify(result)).not.toContain('FORGED');
  expect(JSON.stringify(result)).not.toContain('attacker.invalid');
});
