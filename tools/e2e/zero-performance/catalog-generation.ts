import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse } from '@babel/parser';
import { isQuery } from '@rocicorp/zero';
import { queries } from '../../../src/zero/queries';

// Used only to author the initial reviewed catalog, never by the gate.
export const FIXTURE_ID = '10000000-0000-4000-8000-000000000001';
export const OWNER_ID = '20000000-0000-4000-8000-000000000002';
export const OUTSIDER_ID = '30000000-0000-4000-8000-000000000003';
export const FIXTURE_NOW = 1_800_000_000_000;

export function discoverQueries(value: unknown = queries): Map<string, any> {
  const found = new Map<string, any>();
  function visit(tree: unknown) {
    if (!tree || typeof tree !== 'object') return;
    for (const [key, child] of Object.entries(tree)) {
      if (isQuery(child)) found.set(child.queryName, child);
      else if (key !== '~') visit(child);
    }
  }
  visit(value);
  return found;
}

function sample(schema: any, name = ''): unknown {
  if (!schema) return undefined;
  const def = schema._zod?.def ?? schema._def;
  if (!def) throw new Error(`Cannot sample validator for ${name}`);
  switch (def.type) {
    case 'default':
      return def.defaultValue;
    case 'optional':
      return undefined;
    case 'nullable':
      return null;
    case 'undefined':
      return undefined;
    case 'object':
      return Object.fromEntries(
        Object.entries(def.shape)
          .map(([k, s]) => [k, sample(s, k)])
          .filter(([, v]) => v !== undefined)
      );
    case 'array':
      return [sample(def.element, name.replace(/s$/, ''))];
    case 'enum':
      return Object.values(def.entries)[0];
    case 'literal':
      return def.values[0];
    case 'union':
      return sample(def.options[0], name);
    case 'boolean':
      return false;
    case 'number':
      return /now|date|time/i.test(name) ? FIXTURE_NOW : /limit/i.test(name) ? 20 : 0;
    case 'string': {
      if (/user|owner|recipient|sender|subscriber/i.test(name)) return OWNER_ID;
      if (/handle|query|search/i.test(name)) return 'benchmark';
      if (/endpoint/i.test(name)) return 'https://push.example.test/benchmark';
      if (/scope_type|entity_type|entityType|content_type|contentType/i.test(name)) return 'group';
      if (name === 'status') return 'pending';
      if (/visibility/i.test(name)) return 'public';
      return FIXTURE_ID;
    }
    case 'pipe':
      return sample(def.in, name);
    default:
      throw new Error(`Unsupported validator type ${def.type} for ${name}`);
  }
}

export async function generateCatalog() {
  const source = readFileSync(resolve('src/zero/queries.ts'), 'utf8');
  const ast = parse(source, { sourceType: 'module', plugins: ['typescript'] });
  const definitions = new Map<string, any>();
  for (const entry of ast.program.body) {
    if (entry.type !== 'ImportDeclaration' || !entry.source.value.startsWith('.')) continue;
    const mod = await import(pathToFileURL(resolve('src/zero', `${entry.source.value}.ts`)).href);
    for (const specifier of entry.specifiers) {
      if (specifier.type !== 'ImportSpecifier') continue;
      const imported =
        specifier.imported.type === 'Identifier'
          ? specifier.imported.name
          : specifier.imported.value;
      for (const [name, definition] of Object.entries(mod[imported] ?? {})) {
        definitions.set(`${specifier.local.name}.${name}`, definition);
      }
    }
  }
  const registryObject = ast.program.body.find(
    entry =>
      entry.type === 'ExportNamedDeclaration' && entry.declaration?.type === 'VariableDeclaration'
  ) as any;
  const tree = registryObject.declaration.declarations[0].init.arguments[0];
  const domains = new Map(tree.properties.map((p: any) => [p.key.name, p.value.name]));
  const cases: Record<string, unknown> = {};
  for (const [name, query] of discoverQueries()) {
    const [domain, leaf] = name.split('.');
    const definition = definitions.get(`${domains.get(domain)}.${leaf}`);
    if (!definition) throw new Error(`Missing definition for ${name}`);
    const args: any = sample(definition.validator);
    const ctx = { userID: OWNER_ID, email: 'owner@benchmark.local' };
    let built = query.fn({ args, ctx });
    if (built.ast.table === 'user' && args?.id) {
      args.id = OWNER_ID;
      built = query.fn({ args, ctx });
    }
    cases[name] = {
      revision: 1,
      reason: 'Initial minimal fixture; positive result and denied access are enforced at runtime.',
      args: args ?? null,
      noArgs: args === undefined,
      table: built.ast.table,
      anchor: built.ast.table === 'user' ? OWNER_ID : FIXTURE_ID,
    };
  }
  writeFileSync(
    resolve('tools/e2e/zero-performance/cases.ts'),
    "import type { QueryCaseCatalog } from './catalog';\n\nexport default " +
      JSON.stringify(cases, null, 2) +
      ' satisfies QueryCaseCatalog;\n'
  );
  console.info(`Authored ${Object.keys(cases).length} query cases. Review before committing.`);
}

if (process.argv.includes('--write-catalog')) await generateCatalog();
