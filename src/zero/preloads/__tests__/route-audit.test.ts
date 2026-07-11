import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('app route preload audit', () => {
  it('keeps every generated page route available to the generic route matcher', () => {
    const generated = readFileSync(new URL('../../../routeTree.gen.ts', import.meta.url), 'utf8');
    const fullPathSection = generated.match(
      /export interface FileRoutesByFullPath \{([\s\S]*?)\n\}/
    )?.[1];
    const paths = [...(fullPathSection?.matchAll(/^\s+'([^']+)':/gm) ?? [])].map(match => match[1]);
    const pagePaths = paths.filter(path => !path.startsWith('/api/') && path !== '/$');

    expect(pagePaths.length).toBeGreaterThan(50);
    expect(pagePaths).toEqual(
      expect.arrayContaining([
        '/home',
        '/search',
        '/todos/$id',
        '/statement/$id',
        '/group/$id',
        '/event/$id',
        '/amendment/$id',
        '/user/$id',
        '/blog/$id',
        '/group/$id/blog/$entryId',
        '/user/$id/blog/$entryId',
      ])
    );
    expect(pagePaths.some(path => path.startsWith('/_authed'))).toBe(false);
  });
});
