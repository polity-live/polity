import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => {
  const matrix = {
    version: 1,
    expectedInventory: { tables: 999, unknownInventory: 1 },
    expectedBehaviorAssertions: { checkViolations: 999, unknownAssertion: 1 },
    globalTests: { catalog: 'catalog.sql', security: 'security.sql' },
    assignments: [
      { source: '01.sql', behavior: [] },
      {
        source: '01.sql',
        behavior: ['missing-test.sql'],
        securityBehavior: [],
        operations: [],
      },
      { source: 'missing.sql', behavior: ['orphan.sql'], securityBehavior: ['catalog.sql'] },
    ],
  };
  const schema = `
    CREATE TABLE public.example (
      id text PRIMARY KEY,
      label text DEFAULT 'a''b,c',
      "quoted" text DEFAULT "x""y",
      nested numeric DEFAULT fn(1, 2),
      CONSTRAINT positive CHECK (nested > 0),
      UNIQUE (label),
      FOREIGN KEY (label) REFERENCES public.other(id)
    );
    ALTER TABLE public.example ADD COLUMN extra text;
    CREATE UNIQUE INDEX example_unique ON public.example(label);
    CREATE INDEX example_index ON public.example(id);
    CREATE OR REPLACE FUNCTION public.example_fn() RETURNS trigger LANGUAGE sql AS 'select 1';
    CREATE TRIGGER example_trigger BEFORE INSERT ON public.example EXECUTE FUNCTION public.example_fn();
    CREATE POLICY "member_read" ON public.example FOR SELECT USING (true);
    CREATE POLICY member_write ON public.example WITH CHECK (true);
    CREATE POLICY service_role_all ON public.example USING (true);
    SELECT cron.schedule('example-job', '* * * * *', 'select 1');
  `;
  const files: Record<string, string> = {
    'database_coverage.json': JSON.stringify(matrix),
    '01.sql': schema,
    '02.sql': '-- intentionally unassigned',
    '34_scheduled_jobs.sql': 'SELECT cron.schedule(\'real-job\', \'* * * * *\', \'select 1\');',
    'cron_jobs.sql': '-- embedded DDL deliberately absent',
    'catalog.sql': '-- catalog marker deliberately absent',
    'security.sql': '-- security marker deliberately absent',
    'orphan.sql': '@covers schema missing.sql',
    'unlisted.sql': '@covers schema stale.sql\n@covers schema 01.sql',
  };
  return { files };
});

vi.mock('node:fs', () => ({
  readFileSync: vi.fn((file: string) => {
    const name = String(file).split(/[\\/]/).at(-1) ?? '';
    if (!(name in fixture.files)) throw new Error(`ENOENT ${name}`);
    return fixture.files[name];
  }),
  readdirSync: vi.fn((directory: string) =>
    String(directory).endsWith('schemas')
      ? ['01.sql', '02.sql']
      : ['cron_jobs.sql', 'catalog.sql', 'security.sql', 'orphan.sql', 'unlisted.sql']
  ),
}));

describe('pgTAP coverage checker diagnostics', () => {
  const originalExitCode = process.exitCode;
  const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

  beforeAll(async () => {
    await import('../check-pgtap-coverage');
  });

  afterAll(() => {
    process.exitCode = originalExitCode;
    stderr.mockRestore();
  });

  it('reports every malformed matrix, inventory, marker, and assignment class', () => {
    const output = stderr.mock.calls.flat().join('');
    expect(process.exitCode).toBe(1);
    expect(output).toContain('duplicate schema assignments');
    expect(output).toContain('Embedded cron test DDL differs');
    expect(output).toContain('No coverage assignment for schema 02.sql');
    expect(output).toContain('Stale coverage assignment for missing schema missing.sql');
    expect(output).toContain('Assigned test does not exist: missing-test.sql');
    expect(output).toContain('missing marker "@covers catalog all"');
    expect(output).toContain('missing marker "@covers security all"');
    expect(output).toContain('Orphan pgTAP test');
    expect(output).toContain('contains stale marker for stale.sql');
    expect(output).toContain('matrix does not assign that test');
    expect(output).toContain('has no behavior test');
    expect(output).toContain('has no security test');
    expect(output).toContain('has no operations test');
    expect(output).toContain('Unknown expected inventory kind');
    expect(output).toContain('Inventory mismatch for tables');
    expect(output).toContain('Unknown expected behavior assertion kind');
    expect(output).toContain('Behavior assertion mismatch for checkViolations');
  });
});
