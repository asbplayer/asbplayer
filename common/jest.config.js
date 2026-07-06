/* global module */
module.exports = {
    verbose: true,
    transform: {
        '^.+\\.ts?$': 'ts-jest',
    },
    testEnvironment: 'jsdom',
};
