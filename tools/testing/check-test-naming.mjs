import { execFileSync } from 'node:child_process';

const canonical =
  /\.(?:unit|component|component-flow|browser-component|service-integration|database-integration|static-contract)\.test\.tsx?$|\.e2e\.spec\.ts$/;
const legacy = /(?:^|\.)test\.tsx?$|(?:^|\.)spec\.ts$/;

const files = [
  ...new Set(
    execFileSync(
      'git',
      [
        'ls-files',
        '--cached',
        '--others',
        '--exclude-standard',
        '-z',
        '--',
        '*.test.ts',
        '*.test.tsx',
        '*.spec.ts',
      ],
      { encoding: 'utf8' }
    )
      .split('\0')
      .filter(Boolean)
  ),
];

const invalid = files.filter(file => legacy.test(file) && !canonical.test(file));
if (invalid.length > 0) {
  console.error('Test files without a canonical style suffix:');
  for (const file of invalid) console.error(`- ${file}`);
  process.exit(1);
}

const obsoleteQualifier = files.filter(file =>
  /\.(?:branch|lsf|accountability|mutation)\.[A-Z]\d{2}\./.test(file)
);
if (obsoleteQualifier.length > 0) {
  console.error('Test files with obsolete dotted campaign qualifiers:');
  for (const file of obsoleteQualifier) console.error(`- ${file}`);
  process.exit(1);
}

console.log(`Test naming audit passed for ${files.length} tracked test files.`);
