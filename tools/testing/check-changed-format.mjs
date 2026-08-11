import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { classifyRepositoryFile } from './coverage-scope.mjs';

const supportedExtension = /\.(?:js|jsx|ts|tsx|json|css|scss|md)$/i;

function git(args) {
  return execFileSync(
    'git',
    ['-c', 'core.autocrlf=false', '-c', 'diff.renameLimit=9999', ...args],
    {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }
  );
}

function lines(value) {
  return value
    .split(/\r?\n/u)
    .map(item => item.trim())
    .filter(Boolean);
}

export function changedPathsFromNameStatus(value) {
  const files = [];
  for (const line of value.split(/\r?\n/u).filter(Boolean)) {
    const [status, firstPath, secondPath] = line.split('\t');
    if (/^R100$/u.test(status)) continue;
    if (/^[RC]\d+$/u.test(status)) files.push(secondPath);
    else files.push(firstPath);
  }
  return files.filter(Boolean);
}

export function filterFormattableFiles(files, root = process.cwd()) {
  return [...new Set(files)]
    .filter(file => supportedExtension.test(file))
    .filter(file => classifyRepositoryFile(file).verification !== 'regenerate')
    .filter(file => fs.existsSync(path.resolve(root, file)))
    .sort();
}

export function collectChangedFiles(env = process.env) {
  const files = new Set([
    ...changedPathsFromNameStatus(git(['diff', '--name-status', '--diff-filter=ACMR', '-M'])),
    ...changedPathsFromNameStatus(
      git(['diff', '--cached', '--name-status', '--diff-filter=ACMR', '-M', 'HEAD'])
    ),
    ...lines(git(['ls-files', '--others', '--exclude-standard'])),
  ]);

  const explicitBase = env.FORMAT_BASE_REF;
  const githubBase = env.GITHUB_BASE_REF ? `origin/${env.GITHUB_BASE_REF}` : undefined;
  const base = explicitBase ?? githubBase;

  if (base) {
    try {
      const mergeBase = git(['merge-base', base, 'HEAD']).trim();
      for (const file of changedPathsFromNameStatus(
        git(['diff', '--name-status', '--diff-filter=ACMR', '-M', `${mergeBase}...HEAD`])
      )) {
        files.add(file);
      }
    } catch {
      console.info(`Changed-format ratchet could not resolve ${base}; checking the checkout only.`);
    }
  } else {
    try {
      for (const file of changedPathsFromNameStatus(
        git(['diff', '--name-status', '--diff-filter=ACMR', '-M', 'HEAD^', 'HEAD'])
      )) {
        files.add(file);
      }
    } catch {
      // Initial repositories have no parent commit. Working-tree files above are still checked.
    }
  }

  return filterFormattableFiles(files);
}

export async function checkChangedFormat(files = collectChangedFiles()) {
  const prettierCli = path.resolve(
    import.meta.dirname,
    '../../node_modules/prettier/bin/prettier.cjs'
  );
  if (!fs.existsSync(prettierCli)) throw new Error(`Missing local Prettier CLI: ${prettierCli}`);

  const diagnostics = [];
  for (let index = 0; index < files.length; index += 50) {
    try {
      execFileSync(process.execPath, [prettierCli, '--check', ...files.slice(index, index + 50)], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      diagnostics.push(
        [error.stdout?.trim(), error.stderr?.trim()].filter(Boolean).join('\n') || error.message
      );
    }
  }

  if (diagnostics.length) {
    console.error(`Changed files are not formatted (${files.length} checked):`);
    for (const diagnostic of diagnostics) console.error(diagnostic);
    return false;
  }

  console.info(`Changed-format ratchet valid: ${files.length} files.`);
  return true;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain && !(await checkChangedFormat())) process.exitCode = 1;
