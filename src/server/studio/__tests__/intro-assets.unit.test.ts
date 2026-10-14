import { expect, it, vi } from 'vitest';
import { createEventTemplate } from '@/features/communication-studio/logic/event-templates';
const mock = vi.hoisted(() => ({ assets: [] as any[], rows: vi.fn() }));
vi.mock('@/server/transaction', () => ({
  rows: (...args: any[]) => {
    mock.rows(...args);
    return mock.assets;
  },
}));
import { validateStudioAssetsInTransaction } from '../assets';
it('protects intro video references with the existing project and workspace asset boundary', async () => {
  const project = crypto.randomUUID(),
    video = crypto.randomUUID();
  const doc = createEventTemplate('cover', project);
  const frame = doc.nodes[0];
  if (frame.type !== 'frame') throw new Error('frame');
  frame.intro = { mode: 'video', assetId: video, intensity: 0.45 };
  mock.assets = [];
  await expect(validateStudioAssetsInTransaction({} as never, project, doc)).rejects.toThrow(
    'invalid_asset'
  );
  mock.assets = [{ id: video, mime_type: 'audio/mpeg' }];
  await expect(validateStudioAssetsInTransaction({} as never, project, doc)).rejects.toThrow(
    'invalid_asset'
  );
  mock.assets = [{ id: video, mime_type: 'video/mp4' }];
  await validateStudioAssetsInTransaction({} as never, project, doc);
  expect(mock.rows).toHaveBeenLastCalledWith(
    expect.anything(),
    expect.stringContaining('workspace_id is null or workspace_id=$3'),
    [project, [video], null]
  );
});

it('accepts integrated cues without asset queries while retaining upload asset protection', async () => {
  mock.rows.mockClear();
  const project = crypto.randomUUID();
  const doc = createEventTemplate('cover', project);
  doc.show!.cues = [
    {
      id: crypto.randomUUID(),
      frameId: doc.nodes[0].id,
      builtin: 'cinematic-hope',
      trigger: 'enter',
      action: 'play',
      loop: true,
      volume: 0.65,
      fadeSeconds: 1,
    },
  ];
  await validateStudioAssetsInTransaction({} as never, project, doc);
  expect(mock.rows).not.toHaveBeenCalled();
  delete doc.show!.cues[0].builtin;
  doc.show!.cues[0].assetId = crypto.randomUUID();
  mock.assets = [];
  await expect(validateStudioAssetsInTransaction({} as never, project, doc)).rejects.toThrow(
    'invalid_asset'
  );
});
