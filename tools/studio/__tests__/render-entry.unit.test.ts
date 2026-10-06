import { expect, it } from 'vitest';
import { renderFrame } from '../studio-v5-render-entry';
import { paintStudioDocumentFrame } from '../../../src/features/communication-studio/logic/paint-v5';
it('exports the canonical V5 frame renderer used by the editor and export bundle', () => {
  expect(renderFrame).toBe(paintStudioDocumentFrame);
});
