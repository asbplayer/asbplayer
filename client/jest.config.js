export default {
    verbose: true,
    transform: {
        '^.+\\.ts?$': 'ts-jest',
    },
    testEnvironment: 'jsdom',
    setupFiles: ['<rootDir>/../ffmpeg/jest.setup.cjs'],
};
