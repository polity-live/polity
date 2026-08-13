import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export const E2E_ACCEPTANCE_EVIDENCE_SCHEMA_VERSION = 1;

export const E2E_ACCEPTANCE_SUITES = Object.freeze({
  'critical-repeat': 20,
  'cold-stack': 30,
  'agent1-repeat': 10,
  'agent1-cold-stack': 3,
});

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function positiveInteger(value, field) {
  invariant(/^\d+$/u.test(String(value)), `${field} must be a positive integer`);
  const parsed = Number(value);
  invariant(Number.isSafeInteger(parsed) && parsed > 0, `${field} must be a positive integer`);
  return parsed;
}

function booleanValue(value, field) {
  invariant(value === 'true' || value === 'false', `${field} must be true or false`);
  return value === 'true';
}

function requiredText(value, field) {
  invariant(typeof value === 'string' && value.trim().length > 0, `${field} is required`);
  return value.trim();
}

function requireSuite(value) {
  const suite = requiredText(value, 'suite');
  invariant(Object.hasOwn(E2E_ACCEPTANCE_SUITES, suite), `unsupported acceptance suite: ${suite}`);
  return suite;
}

function requireCommitSha(value) {
  const commitSha = requiredText(value, 'commitSha');
  invariant(/^[0-9a-f]{40}$/iu.test(commitSha), 'commitSha must be a full 40-character SHA');
  return commitSha.toLowerCase();
}

export function createAcceptanceIteration(options) {
  const suite = requireSuite(options.suite);
  const expectedIterations = E2E_ACCEPTANCE_SUITES[suite];
  const iteration = positiveInteger(options.iteration, 'iteration');
  invariant(
    iteration <= expectedIterations,
    `iteration ${iteration} exceeds ${suite} acceptance count ${expectedIterations}`
  );
  const startedAtMs = positiveInteger(options.startedAtMs, 'startedAtMs');
  const completedAtMs = positiveInteger(options.completedAtMs, 'completedAtMs');
  invariant(completedAtMs >= startedAtMs, 'completedAtMs must not precede startedAtMs');
  const status = requiredText(options.status, 'status');
  invariant(status === 'passed' || status === 'failed', 'status must be passed or failed');

  return {
    iteration,
    runId: requiredText(options.runId, 'runId'),
    stackRunId: requiredText(options.stackRunId, 'stackRunId'),
    commitSha: requireCommitSha(options.commitSha),
    status,
    startedAt: new Date(startedAtMs).toISOString(),
    completedAt: new Date(completedAtMs).toISOString(),
    durationMs: completedAtMs - startedAtMs,
    freshStack: booleanValue(String(options.freshStack), 'freshStack'),
    reuseExistingServer: false,
    retries: 0,
    workers: 1,
  };
}

function evidenceHeader(options) {
  const suite = requireSuite(options.suite);
  return {
    schemaVersion: E2E_ACCEPTANCE_EVIDENCE_SCHEMA_VERSION,
    suite,
    expectedIterations: E2E_ACCEPTANCE_SUITES[suite],
    workflow: {
      repository: requiredText(options.repository, 'repository'),
      runId: requiredText(options.workflowRunId, 'workflowRunId'),
      runAttempt: positiveInteger(options.workflowRunAttempt, 'workflowRunAttempt'),
      commitSha: requireCommitSha(options.commitSha),
    },
  };
}

export async function recordAcceptanceIteration(file, options) {
  const resolvedFile = path.resolve(file);
  const header = evidenceHeader(options);
  let evidence = { ...header, iterations: [] };

  try {
    evidence = JSON.parse(await fs.readFile(resolvedFile, 'utf8'));
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }

  invariant(
    evidence.schemaVersion === header.schemaVersion &&
      evidence.suite === header.suite &&
      evidence.expectedIterations === header.expectedIterations &&
      evidence.workflow?.repository === header.workflow.repository &&
      String(evidence.workflow?.runId) === header.workflow.runId &&
      Number(evidence.workflow?.runAttempt) === header.workflow.runAttempt &&
      evidence.workflow?.commitSha === header.workflow.commitSha,
    `evidence header mismatch in ${resolvedFile}`
  );
  invariant(Array.isArray(evidence.iterations), `iterations must be an array in ${resolvedFile}`);

  const iteration = createAcceptanceIteration(options);
  invariant(
    !evidence.iterations.some(existing => existing.iteration === iteration.iteration),
    `duplicate iteration ${iteration.iteration} in ${resolvedFile}`
  );
  invariant(
    !evidence.iterations.some(existing => existing.runId === iteration.runId),
    `duplicate runId ${iteration.runId} in ${resolvedFile}`
  );
  evidence.iterations.push(iteration);
  evidence.iterations.sort((left, right) => left.iteration - right.iteration);

  await fs.mkdir(path.dirname(resolvedFile), { recursive: true });
  await fs.writeFile(resolvedFile, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  return evidence;
}

function validTimestamp(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

export function validateAcceptanceEvidence(documents, options) {
  const suite = requireSuite(options.suite);
  const expectedIterations = E2E_ACCEPTANCE_SUITES[suite];
  const commitSha = requireCommitSha(options.commitSha);
  const failures = [];
  const iterations = [];
  let workflowRunId;
  let workflowRunAttempt;
  let repository;

  if (!Array.isArray(documents) || documents.length === 0) {
    throw new Error(`no ${suite} evidence documents found`);
  }

  for (const [documentIndex, document] of documents.entries()) {
    const label = `document ${documentIndex + 1}`;
    if (document?.schemaVersion !== E2E_ACCEPTANCE_EVIDENCE_SCHEMA_VERSION) {
      failures.push(`${label}: unsupported schemaVersion`);
    }
    if (document?.suite !== suite) failures.push(`${label}: suite must be ${suite}`);
    if (document?.expectedIterations !== expectedIterations) {
      failures.push(`${label}: expectedIterations must be exactly ${expectedIterations}`);
    }
    if (document?.workflow?.commitSha !== commitSha) {
      failures.push(`${label}: workflow commit SHA differs from ${commitSha}`);
    }
    if (!document?.workflow?.repository) failures.push(`${label}: repository is missing`);
    if (!document?.workflow?.runId) failures.push(`${label}: workflow runId is missing`);
    if (!Number.isInteger(document?.workflow?.runAttempt) || document.workflow.runAttempt < 1) {
      failures.push(`${label}: workflow runAttempt is invalid`);
    }

    workflowRunId ??= String(document?.workflow?.runId ?? '');
    workflowRunAttempt ??= document?.workflow?.runAttempt;
    repository ??= document?.workflow?.repository;
    if (String(document?.workflow?.runId ?? '') !== workflowRunId) {
      failures.push(`${label}: mixed workflow run IDs`);
    }
    if (document?.workflow?.runAttempt !== workflowRunAttempt) {
      failures.push(`${label}: mixed workflow run attempts`);
    }
    if (document?.workflow?.repository !== repository) {
      failures.push(`${label}: mixed repositories`);
    }
    if (!Array.isArray(document?.iterations)) {
      failures.push(`${label}: iterations must be an array`);
    } else {
      iterations.push(...document.iterations);
    }
  }

  const iterationNumbers = new Set();
  const runIds = new Set();
  const stackRunIds = new Set();
  for (const [index, iteration] of iterations.entries()) {
    const label = `iteration record ${index + 1}`;
    if (!Number.isInteger(iteration?.iteration)) failures.push(`${label}: iteration is invalid`);
    else if (iterationNumbers.has(iteration.iteration)) {
      failures.push(`${label}: duplicate iteration ${iteration.iteration}`);
    } else {
      iterationNumbers.add(iteration.iteration);
    }

    if (!iteration?.runId) failures.push(`${label}: runId is missing`);
    else if (runIds.has(iteration.runId))
      failures.push(`${label}: duplicate runId ${iteration.runId}`);
    else runIds.add(iteration.runId);

    if (!iteration?.stackRunId) failures.push(`${label}: stackRunId is missing`);
    else {
      if (
        (suite === 'cold-stack' || suite === 'agent1-cold-stack') &&
        stackRunIds.has(iteration.stackRunId)
      ) {
        failures.push(`${label}: duplicate cold stackRunId ${iteration.stackRunId}`);
      }
      stackRunIds.add(iteration.stackRunId);
    }

    if (iteration?.commitSha !== commitSha) failures.push(`${label}: mixed commit SHA`);
    if (iteration?.status !== 'passed') failures.push(`${label}: status must be passed`);
    if (iteration?.retries !== 0) failures.push(`${label}: retries must be 0`);
    if (iteration?.workers !== 1) failures.push(`${label}: workers must be 1`);
    if (iteration?.reuseExistingServer !== false) {
      failures.push(`${label}: reuseExistingServer must be false`);
    }
    if (
      (suite === 'cold-stack' || suite === 'agent1-cold-stack') &&
      iteration?.freshStack !== true
    ) {
      failures.push(`${label}: cold-stack evidence requires a fresh stack`);
    }
    if (!validTimestamp(iteration?.startedAt) || !validTimestamp(iteration?.completedAt)) {
      failures.push(`${label}: timestamps are invalid`);
    } else {
      const measuredDuration = Date.parse(iteration.completedAt) - Date.parse(iteration.startedAt);
      if (iteration?.durationMs !== measuredDuration || measuredDuration < 0) {
        failures.push(`${label}: duration does not match timestamps`);
      }
    }
  }

  if (iterations.length !== expectedIterations) {
    failures.push(`found ${iterations.length}/${expectedIterations} iteration records`);
  }
  for (let iteration = 1; iteration <= expectedIterations; iteration += 1) {
    if (!iterationNumbers.has(iteration)) failures.push(`missing iteration ${iteration}`);
  }

  if (failures.length > 0) {
    throw new Error(`invalid ${suite} acceptance evidence:\n- ${failures.join('\n- ')}`);
  }

  return {
    schemaVersion: E2E_ACCEPTANCE_EVIDENCE_SCHEMA_VERSION,
    suite,
    expectedIterations,
    status: 'passed',
    workflow: {
      repository,
      runId: workflowRunId,
      runAttempt: workflowRunAttempt,
      commitSha,
    },
    verifiedAt: new Date().toISOString(),
    totalDurationMs: iterations.reduce((sum, iteration) => sum + iteration.durationMs, 0),
    iterations: [...iterations].sort((left, right) => left.iteration - right.iteration),
  };
}

async function collectJsonFiles(input) {
  const resolved = path.resolve(input);
  const stat = await fs.stat(resolved);
  if (stat.isFile()) return resolved.endsWith('.json') ? [resolved] : [];
  if (!stat.isDirectory()) return [];

  const files = [];
  for (const entry of await fs.readdir(resolved, { withFileTypes: true })) {
    files.push(...(await collectJsonFiles(path.join(resolved, entry.name))));
  }
  return files;
}

export async function verifyAcceptanceEvidence(input, output, options) {
  const files = await collectJsonFiles(input);
  invariant(files.length > 0, `no JSON evidence files found under ${path.resolve(input)}`);
  const documents = await Promise.all(
    files.sort().map(async file => JSON.parse(await fs.readFile(file, 'utf8')))
  );
  const proof = validateAcceptanceEvidence(documents, options);
  const resolvedOutput = path.resolve(output);
  await fs.mkdir(path.dirname(resolvedOutput), { recursive: true });
  await fs.writeFile(resolvedOutput, `${JSON.stringify(proof, null, 2)}\n`, 'utf8');
  return proof;
}

function parseCliOptions(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    invariant(argument.startsWith('--'), `unexpected argument: ${argument}`);
    const key = argument.slice(2);
    invariant(key && !Object.hasOwn(options, key), `duplicate option --${key}`);
    const value = argv[index + 1];
    invariant(value !== undefined && !value.startsWith('--'), `missing value for --${key}`);
    options[key] = value;
    index += 1;
  }
  return options;
}

async function main(argv) {
  const [command, ...rawOptions] = argv;
  const options = parseCliOptions(rawOptions);

  if (command === 'record') {
    const evidence = await recordAcceptanceIteration(requiredText(options.file, 'file'), {
      suite: options.suite,
      iteration: options.iteration,
      runId: options['run-id'],
      stackRunId: options['stack-run-id'],
      commitSha: options['commit-sha'],
      status: options.status,
      startedAtMs: options['started-at-ms'],
      completedAtMs: options['completed-at-ms'],
      freshStack: options['fresh-stack'],
      repository: options.repository,
      workflowRunId: options['workflow-run-id'],
      workflowRunAttempt: options['workflow-run-attempt'],
    });
    console.log(
      `Recorded ${evidence.suite} iteration ${options.iteration}/${evidence.expectedIterations}`
    );
    return;
  }

  if (command === 'verify') {
    const proof = await verifyAcceptanceEvidence(
      requiredText(options.input, 'input'),
      requiredText(options.output, 'output'),
      { suite: options.suite, commitSha: options['commit-sha'] }
    );
    console.log(
      `Verified ${proof.suite}: ${proof.iterations.length}/${proof.expectedIterations} passed on ${proof.workflow.commitSha}`
    );
    return;
  }

  throw new Error('usage: e2e-acceptance-evidence.mjs <record|verify> [options]');
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  main(process.argv.slice(2)).catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
