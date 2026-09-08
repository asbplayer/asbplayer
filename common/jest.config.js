/* global module, require */
module.exports = {
    verbose: true,
    transform: {
        '^.+\\.tsx?$': 'ts-jest',
    },
    moduleNameMapper: {
        '^uuid$': require.resolve('uuid'),
    },
    testEnvironment: 'jsdom',
};
