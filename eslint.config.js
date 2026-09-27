import js from '@eslint/js'
import perfectionist from 'eslint-plugin-perfectionist'
import prettier from 'eslint-plugin-prettier/recommended'
import svelte from 'eslint-plugin-svelte'
import { defineConfig, includeIgnoreFile } from 'eslint/config'
import globals from 'globals'
import path from 'node:path'
import ts from 'typescript-eslint'

import svelteConfig from './svelte.config.js'

const gitignorePath = path.resolve(import.meta.dirname, '.gitignore')

export default defineConfig(
  includeIgnoreFile(gitignorePath),
  { ignores: ['drizzle/'] },
  js.configs.recommended,
  // Type-aware TypeScript rules
  ts.configs.recommendedTypeChecked,
  ts.configs.stylisticTypeChecked,
  svelte.configs.recommended,
  perfectionist.configs['recommended-natural'],
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        // vite.config.ts and drizzle.config.ts are in the TS project via
        // .svelte-kit/tsconfig.json (see kit.typescript.config in svelte.config.js).
        // Only the root JS config files need allowDefaultProject.
        projectService: {
          allowDefaultProject: ['*.config.js']
        }
      }
    },
    rules: {
      // Strong type-safety rules
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],

      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      // typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
      // see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
      'no-undef': 'off'
    }
  },
  {
    // JS config files at the root (svelte.config.js, eslint.config.js) use a synthetic
    // TS project via allowDefaultProject. Disable strict type-aware rules that don't
    // add value for untyped JS config files.
    files: ['*.js'],
    ...ts.configs.disableTypeChecked,
    rules: {
      ...ts.configs.disableTypeChecked.rules,
      '@typescript-eslint/explicit-module-boundary-types': 'off'
    }
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
    languageOptions: {
      parserOptions: {
        extraFileExtensions: ['.svelte'],
        parser: ts.parser,
        projectService: {
          allowDefaultProject: ['*.config.js']
        },
        svelteConfig
      }
    },
    rules: {
      // Props are typed via $props(), not explicit module boundary types
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      // Snippet calls ({@render children()}) can't always be resolved by the type checker
      '@typescript-eslint/no-unsafe-call': 'off',
      // Svelte 5 runes only — forbid legacy Svelte 4 idioms
      'svelte/no-ignored-unsubscribe': 'error',
      'svelte/no-immutable-reactive-statements': 'error',
      'svelte/no-reactive-functions': 'error',
      'svelte/no-reactive-literals': 'error',
      'svelte/no-reactive-reassign': 'error',
      // Prefer runes-based reactivity over legacy store access patterns
      'svelte/prefer-svelte-reactivity': 'error'
    }
  },
  prettier,
  svelte.configs.prettier
)
