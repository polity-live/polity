import fs from 'node:fs';
import path from 'node:path';

import { parse } from '@babel/parser';
import { describe, expect, it } from 'vitest';

const sourceModules = import.meta.glob('/src/**/*.{ts,tsx}');

function isPublicModuleSurface(source: string, file: string) {
  const ast = parse(source, {
    sourceType: 'module',
    plugins: ['typescript', ...(file.endsWith('.tsx') ? (['jsx'] as const) : []), 'decorators'],
  });

  return (
    ast.program.body.length > 0 &&
    ast.program.body.every(node => {
      if (node.type === 'ImportDeclaration' || node.type === 'ExportAllDeclaration') return true;
      if (node.type !== 'ExportNamedDeclaration') return false;
      return node.declaration === null && (node.source !== null || node.specifiers.length > 0);
    })
  );
}

function collectPublicModuleSurfaces(directory: string, files: string[] = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') continue;
      collectPublicModuleSurfaces(absolute, files);
      continue;
    }
    if (!/\.(?:ts|tsx)$/.test(entry.name) || /\.(?:spec|test)\.[^.]+$/.test(entry.name)) continue;
    const source = fs.readFileSync(absolute, 'utf8');
    if (isPublicModuleSurface(source, entry.name)) {
      files.push(path.relative(process.cwd(), absolute).replaceAll('\\', '/'));
    }
  }
  return files;
}

describe('public module surfaces', () => {
  it('loads every re-export-only production module through the application module graph', async () => {
    const surfaces = collectPublicModuleSurfaces(path.resolve(process.cwd(), 'src'));

    expect(surfaces.length).toBeGreaterThan(100);
    for (const file of surfaces) {
      const importer = sourceModules[`/${file}`];
      expect(importer, `${file} is missing from the Vite module graph`).toBeTypeOf('function');
      await expect(importer(), `${file} failed to load`).resolves.toBeTypeOf('object');
    }
  }, 120_000);
});
