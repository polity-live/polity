import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const directory = resolve(process.cwd(), 'supabase');
const migrations = readdirSync(resolve(directory, 'migrations'))
  .filter(file => file.endsWith('.sql'))
  .sort();

describe('initial database baseline', () => {
  it('applies generated DDL before its explicit manual supplements', () => {
    expect(migrations).toHaveLength(2);
    expect(migrations[0]).toMatch(/_initial\.sql$/);
    expect(migrations[1]).toMatch(/_initial_manual\.sql$/);
  });

  it('keeps every manual operational contract identical to its schema source', () => {
    const manual = readFileSync(resolve(directory, 'migrations', migrations[1]), 'utf8');
    for (const file of [
      '31_service_role_grants.sql',
      '35_security.sql',
      '34_scheduled_jobs.sql',
      '98_publications.sql',
      '99_event_templates.sql',
    ]) {
      const source = readFileSync(resolve(directory, 'schemas', file), 'utf8');
      expect(manual.replace(/\r\n/g, '\n'), file).toContain(source.replace(/\r\n/g, '\n').trim());
    }
  });

  it('marks every generator correction and loads all canonical schema files once', () => {
    const generated = readFileSync(resolve(directory, 'migrations', migrations[0]), 'utf8');
    expect(generated.match(/MANUAL_EDIT_BEGIN/g)?.length ?? 0).toBe(
      generated.match(/MANUAL_EDIT_END/g)?.length ?? 0
    );
    const config = readFileSync(resolve(directory, 'config.toml'), 'utf8');
    const configured = [...config.matchAll(/"\.\/schemas\/([^"\n]+)"/g)].map(match => match[1]);
    const files = readdirSync(resolve(directory, 'schemas')).filter(file => file.endsWith('.sql'));
    expect(configured.toSorted()).toEqual(files.toSorted());
    expect(configured.indexOf('35_security.sql')).toBeGreaterThan(
      configured.indexOf('91_triggers.sql')
    );
  });
});
