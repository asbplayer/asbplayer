/* global module, require */
module.exports = {
    verbose: true,
    transform: {
        // isolatedModules: transpile-only, no per-file type-checking. ~5x faster startup/run.
        // Types are checked by the `typecheck` script (full package incl. test files);
        // client/extension tsc additionally cover the common/ source they import.
        '^.+\\.tsx?$': ['ts-jest', { isolatedModules: true }],
    },
    moduleNameMapper: {
        '^uuid$': require.resolve('uuid'),
    },
    testEnvironment: 'jsdom',
};
