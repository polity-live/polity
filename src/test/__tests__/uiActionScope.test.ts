import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { buildUiActionCatalog } from '../../../tools/testing/ui-action-scope.mjs';

let temporaryDirectory: string | undefined;
afterEach(() => {
  if (temporaryDirectory) fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  temporaryDirectory = undefined;
});

describe('UI action scope', () => {
  it('discovers native, component and onClick interaction surfaces', () => {
    temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'polity-ui-actions-'));
    const file = 'src/features/example/Example.tsx';
    fs.mkdirSync(path.join(temporaryDirectory, path.dirname(file)), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(temporaryDirectory, file),
      `export const Example = () => <><button data-action-id="save">Save</button><MenuItem aria-label="Delete" /><div onClick={() => undefined} /></>`
    );

    const catalog = buildUiActionCatalog(temporaryDirectory, [file]);

    expect(catalog.entries.map(entry => entry.actionId)).toEqual([
      undefined,
      'example.example.delete',
      'example.example.save',
    ]);
    expect(catalog.entries.map(entry => entry.identifierSource)).toEqual([
      'unidentified',
      'accessible-prop',
      'data-action-id',
    ]);
    expect(catalog.entries.map(entry => entry.accountabilityStatus)).toEqual([
      'new-gap',
      'new-gap',
      'new-gap',
    ]);
  });

  it('keeps semantic action identifiers stable across formatting-only changes', () => {
    temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'polity-ui-action-stability-'));
    const file = 'src/features/example/Example.tsx';
    const target = path.join(temporaryDirectory, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });

    fs.writeFileSync(target, 'export const Example=()=> <div onClick={()=>undefined}>Run</div>;');
    const compact = buildUiActionCatalog(temporaryDirectory, [file]);

    fs.writeFileSync(
      target,
      `export const Example = () => (\n  <div onClick={() => undefined}>Run</div>\n);\n`
    );
    const formatted = buildUiActionCatalog(temporaryDirectory, [file]);

    expect(formatted.entries[0].actionId).toBe(compact.entries[0].actionId);
  });

  it('merges a transparent wrapper into its accounted canonical action', () => {
    temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'polity-ui-action-alias-'));
    const file = 'src/features/example/Example.tsx';
    fs.mkdirSync(path.join(temporaryDirectory, path.dirname(file)), { recursive: true });
    fs.writeFileSync(
      path.join(temporaryDirectory, file),
      `export const Example = () => (
        <Button asChild data-action-id="example.surface.open.default">
          <a href="/example" data-action-id="example.surface.open.default">Open</a>
        </Button>
      );`
    );
    const actionKey = `${file}#example.surface.open.default`;
    const reference = {
      file: 'src/features/example/Example.test.tsx',
      project: 'component',
      caseId: 'opens the example',
      scenarios: ['authorized', 'redirect', 'deep-link', 'loading', 'error'],
    };

    const catalog = buildUiActionCatalog(temporaryDirectory, [file], {
      accountability: { actionReferences: { [actionKey]: [reference] } },
    });

    expect(catalog.entries.map(entry => entry.accountabilityStatus)).toEqual([
      'merged-alias',
      'accounted',
    ]);
    expect(catalog.entries.every(entry => entry.key === actionKey)).toBe(true);
  });

  it('uses an explicit manifest declaration for a statically opaque component action', () => {
    temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'polity-ui-action-declared-'));
    const file = 'src/features/example/Example.tsx';
    fs.mkdirSync(path.join(temporaryDirectory, path.dirname(file)), { recursive: true });
    fs.writeFileSync(path.join(temporaryDirectory, file), '<ToolbarButton />');
    const initial = buildUiActionCatalog(temporaryDirectory, [file]);
    const debtKey = initial.entries[0].debtKey;
    const actionId = 'example.toolbar.activate.default';
    const key = `${file}#${actionId}`;

    const catalog = buildUiActionCatalog(temporaryDirectory, [file], {
      accountability: {
        actionDeclarations: { [debtKey]: { actionId } },
        actionReferences: {
          [key]: [
            {
              file: 'src/features/example/Example.test.tsx',
              project: 'component',
              caseId: 'activates the toolbar action',
              scenarios: ['idle', 'success', 'keyboard', 'focus'],
            },
          ],
        },
      },
    });

    expect(catalog.entries[0]).toMatchObject({
      actionId,
      identifierSource: 'manifest-declaration',
      accountabilityStatus: 'accounted',
    });
  });
});
