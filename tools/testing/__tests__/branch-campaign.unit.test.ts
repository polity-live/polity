import { describe, expect, it } from 'vitest';

import { assignSharedFiles, fixedAgentForFile } from '../branch-campaign.mjs';

function debt(path: string, branches: number, lines = 0) {
  return {
    path,
    metrics: {
      branches: { total: branches, uncovered: branches },
      lines: { total: lines, uncovered: lines },
      statements: { total: 0, uncovered: 0 },
      functions: { total: 0, uncovered: 0 },
    },
  };
}

describe('branch campaign ownership', () => {
  it('uses deterministic LPT ownership for shared files', () => {
    const assignments = assignSharedFiles([
      debt('src/features/shared/ui/ui-platejs/a.tsx', 10),
      debt('src/features/shared/ui/ui-platejs/b.tsx', 7),
      debt('src/features/shared/ui/ui-platejs/c.tsx', 3),
      debt('src/features/shared/ui/navigation/branchless.tsx', 0, 4),
    ]);

    expect(assignments.get('src/features/shared/ui/ui-platejs/a.tsx')).toBe('A01');
    expect(assignments.get('src/features/shared/ui/ui-platejs/b.tsx')).toBe('A02');
    expect(assignments.get('src/features/shared/ui/ui-platejs/c.tsx')).toBe('A02');
    expect(assignments.get('src/features/shared/ui/navigation/branchless.tsx')).toBe('A01');
  });

  it('keeps domain ownership disjoint and has no default owner', () => {
    expect(fixedAgentForFile('src/features/editor/hooks/useEditor.ts')).toBe('A03');
    expect(fixedAgentForFile('src/features/editor/logic/entity-adapter.ts')).toBe('A04');
    expect(fixedAgentForFile('src/features/messages/ui/Message.tsx')).toBe('A05');
    expect(fixedAgentForFile('src/features/messages/hooks/useMessages.ts')).toBe('A06');
    expect(fixedAgentForFile('src/features/unknown/file.ts')).toBeUndefined();
  });
});
