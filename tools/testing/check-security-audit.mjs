import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const severityRank = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 };

export function vulnerabilityMap(audit) {
  const vulnerabilities = new Map();
  const record = (name, severity) => {
    if (!name || !severity) return;
    const previous = vulnerabilities.get(name);
    if (!previous || severityRank[severity] > severityRank[previous]) {
      vulnerabilities.set(name, severity);
    }
  };

  for (const [name, finding] of Object.entries(audit.vulnerabilities ?? {})) {
    record(name, finding.severity);
  }
  for (const advisory of Object.values(audit.advisories ?? {})) {
    record(advisory.module_name, advisory.severity);
  }

  return Object.fromEntries(
    [...vulnerabilities].sort(([left], [right]) => left.localeCompare(right))
  );
}

export function auditRegressions(current, baseline) {
  const failures = [];
  for (const [name, severity] of Object.entries(current)) {
    const previousSeverity = baseline[name];
    if (severity === 'critical') failures.push(`${name}: critical vulnerability`);
    if (!previousSeverity) {
      failures.push(`${name}: new ${severity} vulnerability`);
      continue;
    }
    if ((severityRank[severity] ?? Number.POSITIVE_INFINITY) > severityRank[previousSeverity]) {
      failures.push(`${name}: severity increased from ${previousSeverity} to ${severity}`);
    }
  }
  return failures;
}

export function runAudit() {
  const isWindows = process.platform === 'win32';
  const command = isWindows ? (process.env.ComSpec ?? 'cmd.exe') : 'corepack';
  const args = isWindows
    ? ['/d', '/s', '/c', 'corepack pnpm audit --prod --json']
    : ['pnpm', 'audit', '--prod', '--json'];
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    shell: false,
  });
  if (result.error) throw result.error;
  try {
    return JSON.parse(result.stdout);
  } catch {
    const detail = result.stderr?.trim() || result.stdout?.trim() || 'no pnpm output';
    throw new Error(`pnpm audit did not return valid JSON: ${detail}`);
  }
}

export function checkSecurityAudit(audit = runAudit()) {
  const baselinePath = path.join(import.meta.dirname, 'security-audit-baseline.json');
  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8')).vulnerabilities;
  const current = vulnerabilityMap(audit);
  const failures = auditRegressions(current, baseline);

  if (failures.length) {
    console.error(`Runtime dependency security ratchet failed (${failures.length}):`);
    for (const failure of failures) console.error(`- ${failure}`);
    return false;
  }

  const resolved = Object.keys(baseline).filter(name => !(name in current)).length;
  console.info(
    `Runtime dependency security ratchet valid: ${Object.keys(current).length} known packages, ${resolved} resolved, 0 critical regressions.`
  );
  return true;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain && !checkSecurityAudit()) process.exitCode = 1;
