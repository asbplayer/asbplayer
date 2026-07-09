const js = require('@eslint/js');
const reactRecommended = require('eslint-plugin-react/configs/recommended');
const reactHooks = require('eslint-plugin-react-hooks');
const typescriptParser = require('@typescript-eslint/parser');
const tseslint = require('typescript-eslint');
const globals = require('globals');

const globalsBrowser = { ...globals.browser };

if (!('AudioWorkletGlobalScope' in globalsBrowser)) {
    // This particular key in the globals object has a trailing space, so for now we work around that problem here
    globalsBrowser['AudioWorkletGlobalScope'] = globalsBrowser['AudioWorkletGlobalScope '];
    delete globalsBrowser['AudioWorkletGlobalScope '];
}

module.exports = [
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ['**/*.{js,mjs,cjs,jsx,mjsx,ts,tsx,mtsx}'],
        ...reactRecommended,
        rules: {
            ...reactRecommended.rules,
            ...reactHooks.configs.recommended.rules,
            'react/jsx-uses-react': 'off',
            'react/react-in-jsx-scope': 'off',
            'react/prop-types': 'off',
        },
        plugins: {
            ...reactRecommended.plugins,
            'react-hooks': { rules: { ...reactHooks.rules } },
        },
        settings: {
            ...reactRecommended.settings,
            react: {
                version: 'detect',
            },
        },
        languageOptions: {
            ...reactRecommended.languageOptions,
            ecmaVersion: 'latest',
            sourceType: 'module',
            parser: typescriptParser,
            parserOptions: {
                ecmaFeatures: {
                    jsx: true,
                },
            },
            globals: {
                ...globals.serviceworker,
                ...globalsBrowser,
            },
        },
    },
    {
        files: ['**/*.{ts,tsx,mtsx}'],
        plugins: {
            '@typescript-eslint': tseslint.plugin,
        },
        rules: {
            '@typescript-eslint/no-unnecessary-type-assertion': 'error',
            '@typescript-eslint/return-await': 'error',
            '@typescript-eslint/await-thenable': 'error',
            '@typescript-eslint/no-floating-promises': 'error',
            '@typescript-eslint/no-misused-promises': [
                'error',
                {
                    checksVoidReturn: {
                        attributes: false,
                    },
                },
            ],
            '@typescript-eslint/no-explicit-any': 'off',
        },
        languageOptions: {
            parser: typescriptParser,
            parserOptions: {
                project: [
                    './common/tsconfig.eslint.json',
                    './client/tsconfig.eslint.json',
                    './extension/tsconfig.eslint.json',
                ],
                tsconfigRootDir: __dirname,
            },
        },
    },
];
