import path from 'node:path';

function quoteFiles(files) {
  return files.map(file => JSON.stringify(file)).join(' ');
}

export default {
  '*.{js,jsx,ts,tsx}': files => {
    const commands = [];
    const lintableFiles = files.filter(file => path.basename(file) !== 'custom-sw.js');

    if (files.length > 0) {
      commands.push(`prettier --write ${quoteFiles(files)}`);
    }

    if (lintableFiles.length > 0) {
      commands.push(`eslint --fix ${quoteFiles(lintableFiles)}`);
    }

    return commands;
  },
  '*.{json,css,md,html}': files => `prettier --write ${quoteFiles(files)}`,
};