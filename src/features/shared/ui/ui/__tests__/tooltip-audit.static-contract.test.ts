import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('tooltip implementation audit', () => {
  it('keeps Radix Tooltip imports inside the shared primitive', () => {
    const toolbarSource = readFileSync(
      resolve(process.cwd(), 'src/features/shared/ui/layout/Toolbar.tsx'),
      'utf8'
    );

    expect(toolbarSource).not.toContain('@radix-ui/react-tooltip');
    expect(toolbarSource).toContain('@/features/shared/ui/ui/tooltip');
  });

  it('keeps native title attributes off shared buttons', () => {
    const buttonSource = readFileSync(
      resolve(process.cwd(), 'src/features/shared/ui/ui/button.tsx'),
      'utf8'
    );

    expect(buttonSource).not.toMatch(/<Comp[\s\S]*?\btitle=/);
    expect(buttonSource).toContain('tooltipContent = tooltip ?? title');
  });
});
