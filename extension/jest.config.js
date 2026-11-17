export default {
    verbose: true,
    transform: {
        '^.+\\.tsx?$': 'ts-jest',
    },
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@qgustavor/srt-parser$': '<rootDir>/../common/node_modules/@qgustavor/srt-parser',
    },
    testEnvironment: 'jsdom',
};
