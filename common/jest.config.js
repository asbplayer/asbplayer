/* global module, require */
module.exports = {
    verbose: true,
    transform: {
        '^.+\\.ts?$': 'ts-jest',
    },
    moduleNameMapper: {
        '^uuid$': require.resolve('uuid'),
    },
    testEnvironment: 'jsdom',
};
