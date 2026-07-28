import { readFileSync, readdirSync } from 'node:fs';
import { basename, resolve } from 'node:path';

interface Assignment {
  source: string;
  behavior: string[];
  securityBehavior?: string[];
  operations?: string[];
}

interface CoverageMatrix {
  version: number;
  expectedInventory: Record<string, number>;
  expectedBehaviorAssertions: Record<string, number>;
  globalTests: {
    catalog: string;
    security: string;
  };
  assignments: Assignment[];
}

const workspace = resolve(import.meta.dirname, '../..');
const schemasDirectory = resolve(workspace, 'supabase/schemas');
const testsDirectory = resolve(workspace, 'supabase/tests');
const matrixPath = resolve(testsDirectory, 'database_coverage.json');
const matrix = JSON.parse(readFileSync(matrixPath, 'utf8')) as CoverageMatrix;
const scheduledJobsSource = resolve(schemasDirectory, '34_scheduled_jobs.sql');

function sqlWithoutComments(sql: string): string {
  return sql.replace(/--.*$/gm, '');
}

function countMatches(sql: string, expression: RegExp): number {
  return [...sql.matchAll(expression)].length;
}

function countCreateTableColumns(sql: string): number {
  const tableExpression =
    /\bCREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+(?:public\.)?(?:"[^"]+"|\w+)\s*\(/gi;
  let columns = 0;

  for (const table of sql.matchAll(tableExpression)) {
    let depth = 1;
    let segment = '';
    let quote: "'" | '"' | undefined;
    const openingParenthesis = (table.index ?? 0) + table[0].length;

    const finishSegment = (): void => {
      const definition = segment.trim();
      if (
        definition.length > 0 &&
        !/^(?:CONSTRAINT|PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|CHECK|EXCLUDE|LIKE)\b/i.test(definition)
      ) {
        columns += 1;
      }
      segment = '';
    };

    for (let index = openingParenthesis; index < sql.length; index += 1) {
      const character = sql[index];
      const next = sql[index + 1];

      if (quote !== undefined) {
        segment += character;
        if (character === quote) {
          if (next === quote) {
            segment += next;
            index += 1;
          } else {
            quote = undefined;
          }
        }
        continue;
      }
      if (character === "'" || character === '"') {
        quote = character;
        segment += character;
      } else if (character === '(') {
        depth += 1;
        segment += character;
      } else if (character === ')') {
        depth -= 1;
        if (depth === 0) {
          finishSegment();
          break;
        }
        segment += character;
      } else if (character === ',' && depth === 1) {
        finishSegment();
      } else {
        segment += character;
      }
    }
  }

  return columns;
}

const schemaFiles = readdirSync(schemasDirectory)
  .filter(file => file.endsWith('.sql'))
  .sort();
const assignments = new Map(matrix.assignments.map(assignment => [assignment.source, assignment]));
const errors: string[] = [];

if (assignments.size !== matrix.assignments.length) {
  errors.push('Coverage matrix contains duplicate schema assignments');
}

const cronTest = readFileSync(resolve(testsDirectory, 'cron_jobs.sql'), 'utf8');
const embeddedScheduledJobs = cronTest.match(
  /\$scheduled_jobs\$\r?\n([\s\S]*?)\r?\n\$scheduled_jobs\$/
)?.[1];
const normalizeSql = (sql: string) => sql.replace(/\r\n/g, '\n').trimEnd();
if (
  embeddedScheduledJobs === undefined ||
  normalizeSql(embeddedScheduledJobs) !== normalizeSql(readFileSync(scheduledJobsSource, 'utf8'))
) {
  errors.push('Embedded cron test DDL differs from schemas/34_scheduled_jobs.sql');
}

for (const file of schemaFiles) {
  if (!assignments.has(file)) errors.push(`No coverage assignment for schema ${file}`);
}
for (const source of assignments.keys()) {
  if (!schemaFiles.includes(source))
    errors.push(`Stale coverage assignment for missing schema ${source}`);
}

const testNames = new Set<string>([
  matrix.globalTests.catalog,
  matrix.globalTests.security,
  ...matrix.assignments.flatMap(assignment => [
    ...assignment.behavior,
    ...(assignment.securityBehavior ?? []),
    ...(assignment.operations ?? []),
  ]),
]);

for (const testName of testNames) {
  const testPath = resolve(testsDirectory, testName);
  let contents: string;
  try {
    contents = readFileSync(testPath, 'utf8');
  } catch {
    errors.push(`Assigned test does not exist: ${testName}`);
    continue;
  }

  if (testName === matrix.globalTests.catalog && !contents.includes('@covers catalog all')) {
    errors.push(`${testName} is missing marker "@covers catalog all"`);
  }
  if (testName === matrix.globalTests.security && !contents.includes('@covers security all')) {
    errors.push(`${testName} is missing marker "@covers security all"`);
  }
}

for (const assignment of matrix.assignments) {
  for (const testName of [
    ...assignment.behavior,
    ...(assignment.securityBehavior ?? []),
    ...(assignment.operations ?? []),
  ]) {
    const testPath = resolve(testsDirectory, testName);
    try {
      const contents = readFileSync(testPath, 'utf8');
      const marker = `@covers schema ${assignment.source}`;
      if (!contents.includes(marker)) {
        errors.push(`${testName} is missing marker "${marker}"`);
      }
    } catch {
      // Missing files are reported above.
    }
  }
}

const discoveredTests = readdirSync(testsDirectory)
  .filter(file => file.endsWith('.sql') || file.endsWith('.pg'))
  .map(file => basename(file))
  .sort();
for (const testName of discoveredTests) {
  if (!testNames.has(testName))
    errors.push(`Orphan pgTAP test is not in coverage matrix: ${testName}`);

  const contents = readFileSync(resolve(testsDirectory, testName), 'utf8');
  for (const marker of contents.matchAll(/@covers schema ([^\s]+)/g)) {
    const source = marker[1];
    const assignment = assignments.get(source);
    if (assignment === undefined) {
      errors.push(`${testName} contains stale marker for ${source}`);
      continue;
    }
    const assignedTests = [
      ...assignment.behavior,
      ...(assignment.securityBehavior ?? []),
      ...(assignment.operations ?? []),
    ];
    if (!assignedTests.includes(testName)) {
      errors.push(`${testName} marks ${source}, but the matrix does not assign that test`);
    }
  }
}

const schemaSql = new Map(
  schemaFiles.map(file => [file, readFileSync(resolve(schemasDirectory, file), 'utf8')])
);
const combinedSql = [...schemaSql.values()].join('\n');
const uncommentedSql = sqlWithoutComments(combinedSql);
const checkTokens = [...uncommentedSql.matchAll(/\b(WITH\s+)?CHECK\s*\(/gi)].filter(
  match => !match[1]
).length;
const uniqueDeclarations = countMatches(
  uncommentedSql,
  /\bUNIQUE(?:\s+NULLS\s+NOT\s+DISTINCT)?\s*(?:\(|,|\n)/gi
);
const uniqueIndexes = countMatches(uncommentedSql, /\bCREATE\s+UNIQUE\s+INDEX\b/gi);

const inventory: Record<string, number> = {
  tables: countMatches(
    uncommentedSql,
    /\bCREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+(?:public\.)?/gi
  ),
  columns:
    countCreateTableColumns(uncommentedSql) + countMatches(uncommentedSql, /\bADD\s+COLUMN\b/gi),
  primaryKeys: countMatches(uncommentedSql, /\bPRIMARY\s+KEY\b/gi),
  checks: checkTokens,
  foreignKeys: countMatches(uncommentedSql, /\bREFERENCES\s+/gi),
  uniqueConstraints: uniqueDeclarations,
  uniqueIndexes,
  uniqueRules: uniqueDeclarations + uniqueIndexes,
  indexes:
    countMatches(uncommentedSql, /\bCREATE\s+(?:UNIQUE\s+)?INDEX\b/gi) +
    countMatches(uncommentedSql, /\bPRIMARY\s+KEY\b/gi) +
    uniqueDeclarations,
  functions: countMatches(uncommentedSql, /\bCREATE(?:\s+OR\s+REPLACE)?\s+FUNCTION\s+/gi),
  triggers: countMatches(uncommentedSql, /\bCREATE\s+TRIGGER\s+/gi),
  policies: countMatches(uncommentedSql, /\bCREATE\s+POLICY\s+/gi),
  cronBranches: new Set(
    [...uncommentedSql.matchAll(/\bcron\.schedule\s*\(\s*'([^']+)'/gi)].map(match => match[1])
  ).size,
};

for (const assignment of matrix.assignments) {
  const sql = sqlWithoutComments(schemaSql.get(assignment.source) ?? '');
  const hasBusinessCheck = [...sql.matchAll(/\b(WITH\s+)?CHECK\s*\(/gi)].some(match => !match[1]);
  const hasBehavioralObjects =
    hasBusinessCheck ||
    /\bCREATE\s+TABLE\b|\bUNIQUE\b|\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\b|\bCREATE\s+TRIGGER\b/i.test(
      sql
    );
  if (hasBehavioralObjects && assignment.behavior.length === 0) {
    errors.push(`${assignment.source} declares behavioral objects but has no behavior test`);
  }

  const nonGenericPolicies = [...sql.matchAll(/\bCREATE\s+POLICY\s+(?:"([^"]+)"|(\w+))/gi)]
    .map(match => match[1] ?? match[2])
    .filter(policy => policy !== 'service_role_all' && !policy.endsWith('service_role_all'));
  if (nonGenericPolicies.length > 0 && (assignment.securityBehavior?.length ?? 0) === 0) {
    errors.push(`${assignment.source} declares non-generic policies but has no security test`);
  }

  if (/\bcron\.schedule\s*\(/i.test(sql) && (assignment.operations?.length ?? 0) === 0) {
    errors.push(`${assignment.source} declares cron branches but has no operations test`);
  }
}

for (const [kind, expected] of Object.entries(matrix.expectedInventory)) {
  const actual = inventory[kind];
  if (actual === undefined) {
    errors.push(`Unknown expected inventory kind: ${kind}`);
  } else if (actual !== expected) {
    errors.push(`Inventory mismatch for ${kind}: expected ${expected}, found ${actual}`);
  }
}

const allTestSql = discoveredTests
  .map(testName => readFileSync(resolve(testsDirectory, testName), 'utf8'))
  .join('\n');
const behaviorAssertions: Record<string, number> = {
  checkViolations: countMatches(allTestSql, /'23514'/g),
  uniqueViolations: countMatches(allTestSql, /'23505'/g),
};
for (const [kind, expected] of Object.entries(matrix.expectedBehaviorAssertions)) {
  const actual = behaviorAssertions[kind];
  if (actual === undefined) {
    errors.push(`Unknown expected behavior assertion kind: ${kind}`);
  } else if (actual !== expected) {
    errors.push(`Behavior assertion mismatch for ${kind}: expected ${expected}, found ${actual}`);
  }
}

if (errors.length > 0) {
  for (const error of errors) process.stderr.write(`database coverage: ${error}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(
    `Database coverage complete: ${schemaFiles.length} schema files, ` +
      Object.entries(inventory)
        .map(([kind, count]) => `${count} ${kind}`)
        .join(', ') +
      `, ${discoveredTests.length} pgTAP suites, ` +
      `${behaviorAssertions.checkViolations} CHECK violation assertions, ` +
      `${behaviorAssertions.uniqueViolations} uniqueness violation assertions.\n`
  );
}
