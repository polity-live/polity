import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  buildTestCaseIndex,
  loadAccountabilityManifest,
  validateTestReference,
} from './accountability-scope.mjs';
import { listRepositoryFiles } from './coverage-scope.mjs';

const defaultRoot = path.resolve(import.meta.dirname, '../..');
const REQUIRED_PR_TAGS = ['@critical', '@pr'];

export const SCANNER_ONLY_ROUTE_TESTS = new Set([
  'src/routes/__tests__/routeCatalog.contract.test.ts',
  'src/zero/preloads/__tests__/route-audit.test.ts',
]);

function addFailure(failures, condition, message) {
  if (!condition) failures.push(message);
}

function sortedUnique(values) {
  return [...new Set(values)].sort();
}

function sameValues(left, right) {
  return JSON.stringify(sortedUnique(left)) === JSON.stringify(sortedUnique(right));
}

function compareGapBaseline(actual, baseline, label, failures) {
  const actualSet = new Set(actual);
  const baselineSet = new Set(baseline);
  addFailure(
    failures,
    baselineSet.size === baseline.length,
    `${label}: accountability baseline contains duplicate keys`
  );
  for (const gap of actualSet) {
    addFailure(failures, baselineSet.has(gap), `${label}: unaccounted gap ${gap}`);
  }
  for (const gap of baselineSet) {
    addFailure(failures, actualSet.has(gap), `${label}: stale resolved gap ${gap}`);
  }
}

export function tagsInTestTitle(caseId) {
  return caseId.match(/@[a-z][a-z0-9-]*/giu) ?? [];
}

export function validateCriticalProcessE2E(catalog, testIndex) {
  const failures = [];
  const gaps = [];
  const claimedReferences = new Map();

  for (const processEntry of catalog.processes ?? []) {
    if (!processEntry.critical) continue;
    const references = processEntry.prE2E ?? [];
    if (references.length === 0) gaps.push(processEntry.id);
    const processActions = new Set((processEntry.actions ?? []).map(action => action.id));
    const coveredActions = new Set();

    for (const reference of references) {
      const context = `${processEntry.id}/prE2E`;
      for (const failure of validateTestReference(reference, testIndex)) {
        failures.push(`${context}: ${failure}`);
      }
      addFailure(
        failures,
        reference?.project === 'playwright',
        `${context}: project must be playwright`
      );
      addFailure(
        failures,
        typeof reference?.file === 'string' && reference.file.startsWith('e2e/'),
        `${context}: test file must be inside e2e/`
      );

      const declaredTags = Array.isArray(reference?.tags) ? reference.tags : [];
      const titleTags =
        typeof reference?.caseId === 'string' ? tagsInTestTitle(reference.caseId) : [];
      addFailure(
        failures,
        declaredTags.length === new Set(declaredTags).size && sameValues(declaredTags, titleTags),
        `${context}: declared tags must exactly match the tags in the test title`
      );
      for (const tag of REQUIRED_PR_TAGS) {
        addFailure(failures, declaredTags.includes(tag), `${context}: missing required tag ${tag}`);
      }

      const referenceKey = `${reference?.file ?? 'unknown'}#${reference?.caseId ?? 'unknown'}`;
      const priorProcess = claimedReferences.get(referenceKey);
      addFailure(
        failures,
        priorProcess === undefined || priorProcess === processEntry.id,
        `${context}: E2E case is already claimed by ${priorProcess}`
      );
      claimedReferences.set(referenceKey, processEntry.id);

      const claims = Array.isArray(reference?.coversActions) ? reference.coversActions : [];
      addFailure(failures, claims.length > 0, `${context}: missing coversActions`);
      for (const actionId of claims) {
        addFailure(
          failures,
          processActions.has(actionId),
          `${context}: unknown covered action ${actionId}`
        );
        coveredActions.add(actionId);
      }
    }

    if (references.length > 0) {
      for (const actionId of processActions) {
        addFailure(
          failures,
          coveredActions.has(actionId),
          `${processEntry.id}: PR E2E does not cover action ${actionId}`
        );
      }
    }
  }

  return { failures, gaps: gaps.sort() };
}

export function validateRouteBehaviorAccountability(routeCatalog, accountability, testIndex) {
  const failures = [];
  const gaps = [];
  let coveredActions = 0;

  for (const route of routeCatalog.routes ?? []) {
    const references = accountability.sourceReferences?.[route.file] ?? [];
    const behaviorReferences = references.filter(
      reference =>
        reference?.evidence?.relation === 'direct' && !SCANNER_ONLY_ROUTE_TESTS.has(reference.file)
    );
    for (const reference of behaviorReferences) {
      for (const failure of validateTestReference(reference, testIndex)) {
        failures.push(`${route.file}/behavior: ${failure}`);
      }
    }

    for (const action of route.actions ?? []) {
      const actionKey = `${route.file}#${action.id}`;
      addFailure(
        failures,
        !('coverage' in action),
        `${actionKey}: legacy coverage field is forbidden`
      );
      addFailure(
        failures,
        action.contractCoverage?.length > 0,
        `${actionKey}: missing structural contract coverage`
      );
      for (const reference of action.contractCoverage ?? []) {
        for (const failure of validateTestReference(reference, testIndex)) {
          failures.push(`${actionKey}/contract: ${failure}`);
        }
        addFailure(
          failures,
          SCANNER_ONLY_ROUTE_TESTS.has(reference.file),
          `${actionKey}: contract coverage must use an approved scanner contract`
        );
      }

      if (behaviorReferences.length === 0) gaps.push(actionKey);
      else coveredActions += 1;
    }
  }

  return { failures, gaps: gaps.sort(), coveredActions };
}

export function validateActionCatalogRepository(root = defaultRoot) {
  const read = relative => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
  const catalog = read('tools/testing/action-catalog.json');
  const routeCatalog = read('tools/testing/route-action-catalog.json');
  const locatorBaseline = read('tools/testing/positional-locator-baseline.json');
  const accountability = loadAccountabilityManifest(root);
  const testCases = buildTestCaseIndex(root, listRepositoryFiles(root));
  const failures = [...testCases.failures];
  const processIds = new Set();
  const actionIds = new Set();

  const assertFile = (file, context) => {
    const absolute = path.join(root, file);
    addFailure(failures, fs.existsSync(absolute), `${context}: missing ${file}`);
    return absolute;
  };

  addFailure(failures, catalog.version === 2, 'action catalog must use version 2');
  addFailure(failures, routeCatalog.version === 2, 'route action catalog must use version 2');

  for (const entry of catalog.processes ?? []) {
    addFailure(failures, !processIds.has(entry.id), `duplicate process id: ${entry.id}`);
    processIds.add(entry.id);
    addFailure(failures, entry.actions?.length > 0, `${entry.id}: no cataloged user actions`);

    for (const action of entry.actions ?? []) {
      const qualifiedId = `${entry.id}/${action.id}`;
      addFailure(failures, !actionIds.has(qualifiedId), `duplicate action id: ${qualifiedId}`);
      actionIds.add(qualifiedId);
      addFailure(failures, action.coverage?.length > 0, `${qualifiedId}: no automated coverage`);
      for (const file of action.coverage ?? []) assertFile(file, qualifiedId);
    }
  }

  const critical = validateCriticalProcessE2E(catalog, testCases.index);
  failures.push(...critical.failures);
  compareGapBaseline(
    critical.gaps,
    catalog.accountability?.criticalProcessE2EGaps ?? [],
    'critical process E2E',
    failures
  );

  const routeFiles = fs
    .readdirSync(path.join(root, 'src/routes'), { recursive: true, withFileTypes: true })
    .filter(
      entry =>
        entry.isFile() &&
        /\.[cm]?[jt]sx?$/.test(entry.name) &&
        !entry.parentPath.includes('__tests__') &&
        !/\.(?:spec|test)\.[cm]?[jt]sx?$/.test(entry.name)
    )
    .map(entry =>
      path.relative(root, path.join(entry.parentPath, entry.name)).replaceAll('\\', '/')
    )
    .sort();
  const catalogedRoutes = new Set();
  for (const route of routeCatalog.routes ?? []) {
    addFailure(
      failures,
      !catalogedRoutes.has(route.file),
      `duplicate route catalog entry: ${route.file}`
    );
    catalogedRoutes.add(route.file);
    assertFile(route.file, 'route catalog');
    addFailure(failures, route.routePath, `${route.file}: missing routePath`);
    addFailure(failures, route.actions?.length > 0, `${route.file}: no route actions`);
    for (const action of route.actions ?? []) {
      addFailure(failures, action.roles?.length > 0, `${route.file}/${action.id}: no roles`);
      addFailure(failures, action.states?.length > 0, `${route.file}/${action.id}: no states`);
    }
  }
  for (const routeFile of routeFiles) {
    addFailure(failures, catalogedRoutes.has(routeFile), `uncataloged route: ${routeFile}`);
  }
  for (const routeFile of catalogedRoutes) {
    addFailure(failures, routeFiles.includes(routeFile), `stale route catalog entry: ${routeFile}`);
  }

  const routeBehavior = validateRouteBehaviorAccountability(
    routeCatalog,
    accountability,
    testCases.index
  );
  failures.push(...routeBehavior.failures);
  compareGapBaseline(
    routeBehavior.gaps,
    catalog.accountability?.routeBehaviorGaps ?? [],
    'route behavior',
    failures
  );

  const e2eFiles = fs
    .readdirSync(path.join(root, 'e2e'), { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.ts'))
    .map(entry => path.join(entry.parentPath, entry.name));

  let positionalLocatorOccurrences = 0;
  for (const absolute of e2eFiles) {
    const source = fs.readFileSync(absolute, 'utf8');
    const relative = path.relative(root, absolute).replaceAll('\\', '/');
    addFailure(
      failures,
      !source.includes('waitForTimeout('),
      `${relative}: E2E uses waitForTimeout`
    );
    addFailure(
      failures,
      !source.includes("waitForLoadState('networkidle')"),
      `${relative}: E2E uses networkidle`
    );
    addFailure(
      failures,
      !/like\s+'e2e%'/i.test(source),
      `${relative}: E2E uses broad global cleanup`
    );
    positionalLocatorOccurrences += source.match(/\.(?:first|last|nth)\(/g)?.length ?? 0;
  }
  addFailure(
    failures,
    positionalLocatorOccurrences <= locatorBaseline.maximumOccurrences,
    `E2E positional locators increased: ${positionalLocatorOccurrences} > ${locatorBaseline.maximumOccurrences}`
  );

  const playwrightConfig = fs.readFileSync(path.join(root, 'playwright.config.ts'), 'utf8');
  addFailure(
    failures,
    playwrightConfig.includes('fullyParallel: false'),
    'playwright.config.ts must keep fullyParallel disabled'
  );
  addFailure(
    failures,
    playwrightConfig.includes('retries: 0'),
    'playwright.config.ts must not hide PR flakes with retries'
  );
  addFailure(
    failures,
    playwrightConfig.includes("process.env.E2E_REUSE_SERVER === '1'"),
    'playwright.config.ts must make server reuse explicit'
  );
  addFailure(
    failures,
    processIds.size === 9,
    `expected 9 critical processes, found ${processIds.size}`
  );

  return {
    failures,
    processCount: processIds.size,
    actionCount: actionIds.size,
    routeCount: catalogedRoutes.size,
    criticalProcessE2EGaps: critical.gaps,
    routeBehaviorGaps: routeBehavior.gaps,
    routeBehaviorCoveredActions: routeBehavior.coveredActions,
    positionalLocatorOccurrences,
  };
}

export function runActionCatalogCheck(root = defaultRoot) {
  const result = validateActionCatalogRepository(root);
  if (result.failures.length) {
    console.error(`Action catalog validation failed (${result.failures.length}):`);
    for (const failure of result.failures) console.error(`- ${failure}`);
    return 1;
  }

  console.info(
    `Action catalog valid: ${result.processCount} critical processes, ${result.actionCount} critical actions, ` +
      `${result.routeCount} routes, ${result.criticalProcessE2EGaps.length} baselined critical E2E gaps, ` +
      `${result.routeBehaviorGaps.length} baselined route behavior gaps, ` +
      `${result.positionalLocatorOccurrences} positional locator occurrences.`
  );
  return 0;
}

const invokedAsScript =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedAsScript) process.exit(runActionCatalogCheck());
