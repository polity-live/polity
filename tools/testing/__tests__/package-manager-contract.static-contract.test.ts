import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '../../..');

function read(...segments: string[]) {
  return fs.readFileSync(path.join(root, ...segments), 'utf8');
}

function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(target);
    return /\.(?:json|md|mjs|sql|ts|tsx|ya?ml)$/u.test(entry.name) ? [target] : [];
  });
}

describe('package manager contract', () => {
  it('pins the supported runtimes and keeps pnpm as the only lockfile', () => {
    const manifest = JSON.parse(read('package.json'));
    const workspace = read('pnpm-workspace.yaml');

    expect(manifest.packageManager).toBe('pnpm@10.34.5');
    expect(manifest.engines).toEqual({ node: '24.18.0' });
    expect(manifest).not.toHaveProperty('allowScripts');
    expect(manifest).not.toHaveProperty('overrides');
    expect(fs.existsSync(path.join(root, 'package-lock.json'))).toBe(false);
    expect(fs.existsSync(path.join(root, 'pnpm-lock.yaml'))).toBe(true);
    expect(workspace).toContain("'@parcel/watcher': true");
    expect(workspace).toContain("'@rocicorp/zero-sqlite3': true");
    expect(workspace).toContain('esbuild: true');
    expect(workspace).toContain('protobufjs: true');
    expect(workspace).toContain('msw: false');
    expect(workspace).toContain('sharp: false');
    expect(workspace).toContain('nodeLinker: hoisted');
    expect(workspace).not.toContain('set this to true or false');
  });

  it('rejects executable npm and npx commands in operational repository files', () => {
    const files = [
      path.join(root, 'package.json'),
      path.join(root, 'Dockerfile.zero'),
      path.join(root, 'vercel.json'),
      path.join(root, '.husky', 'pre-commit'),
      path.join(root, 'playwright.config.ts'),
      path.join(root, 'README.md'),
      path.join(root, 'TESTING.md'),
      ...sourceFiles(path.join(root, '.github', 'workflows')),
      ...sourceFiles(path.join(root, 'tools')).filter(
        file => !file.includes(`${path.sep}__tests__${path.sep}`)
      ),
    ];
    const executableNpm = /(^|[^a-z])npm\s+(?:run|ci|install|audit|cache|--prefix)\b|\bnpx\s+/imu;
    const violations = files.flatMap(file => {
      const relative = path.relative(root, file);
      return read(relative)
        .split(/\r?\n/u)
        .flatMap((line, index) =>
          executableNpm.test(line) ? [`${relative}:${index + 1}: ${line.trim()}`] : []
        );
    });

    expect(violations).toEqual([]);
  });
});
