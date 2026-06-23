// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

export default tseslint.config(
  {
    // Define ignores for the flat config
    ignores: [
      'src/ui/kit-platejs/**/*',
      'src/ui/ui/**/*',
      'src/ui/ui-platejs/**/*',
      '.github/**/*',
      '.next/**/*',
      '.output/**/*',
      '.vinxi/**/*',
      '*.timestamp_*.js',
      'dist/**/*',
      '.tanstack/**/*',
      '.tmp/**/*',
      '.vercel/**/*',
      'playwright-report/**/*',
      'test-results/**/*',
    ],
  },
  eslint.configs.recommended,
  tseslint.configs.strict,
  tseslint.configs.stylistic,
  {
    plugins: {
      'react-hooks': reactHooksPlugin,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    // Allow CommonJS in config files
    files: [
      '*.config.js',
      '*.config.mjs',
      'app.config.timestamp_*.js',
      'postcss.config.js',
      'tailwind.config.js',
    ],
    languageOptions: {
      globals: {
        module: 'readonly',
        require: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  }
);
