import tseslint from '@typescript-eslint/eslint-plugin'
import tsparser from '@typescript-eslint/parser'
import prettier from 'eslint-config-prettier'

export default [
    // Base JavaScript rules
    //js.configs.recommended,

    // TypeScript configuration for source files (with project references)
    {
        files: [
            "packages/cloud-providers/*/src/**/*.ts",
            "packages/cloud-providers/*/src/**/*.tsx",
            "packages/*/src/**/*.ts",
            "packages/*/src/**/*.tsx",
        ],
        languageOptions: {
            parser: tsparser,
            parserOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module',
                project: true,
            },
        },
        plugins: {
            '@typescript-eslint': tseslint,
        },
        rules: {
            // TypeScript specific rules
            '@typescript-eslint/no-unused-vars': 'error',
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            '@typescript-eslint/no-non-null-assertion': 'off',
            '@typescript-eslint/prefer-optional-chain': 'error',

            // General rules
            'prefer-const': 'error',
            'no-var': 'error',
            'no-console': ['warn', { allow: ['error'] }],
            'no-debugger': 'error',
            'eqeqeq': 'error',
            'curly': 'error',
        },
    },

    // TypeScript configuration for config files (without project references)
    {
        files: [
            '**/*.config.ts',
            '**/*.config.mts',
            '**/tsconfig*.json',
            'eslint.config.js',
            'prettier.config.js',
        ],
        languageOptions: {
            parser: tsparser,
            parserOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module',
                // No project reference for config files
            },
        },
        plugins: {
            '@typescript-eslint': tseslint,
        },
        rules: {
            // Relaxed rules for config files
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-vars': 'warn',
            'no-console': 'off',
            'prefer-const': 'error',
            'no-var': 'error',
        },
    },


    // Prettier integration (turns off conflicting rules)
    prettier,

    // Global ignores
    {
        ignores: [
            'node_modules/**',
            'dist/**',
            'build/**',
            'coverage/**',
            '**/*.d.ts',
            '.turbo/**',
            '.changeset/**',
        ],
    },

    // Test files configuration
    {
        files: ['**/*.test.ts', '**/*.spec.ts', '**/test/**/*.ts'],
        rules: {
            // Relaxed rules for tests
            '@typescript-eslint/no-explicit-any': 'off',
            'no-console': 'off',
        },
    },

    {
        files: ["packages/cloud-providers/core/**/*.ts"],
        rules: {
            '@typescript-eslint/no-unused-vars': 'off',
        }
    },

    // allow console only in utils and cli and scripts
    {
        files: [
            'packages/cli/**/*.tsx',
            'packages/utils/**/*.ts',
            '**/scripts/**/*.ts'],
        rules: {
            // Allow console in CLI tools
            'no-console': 'off',
        },
    },
]