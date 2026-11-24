import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseLocalesArg } from './docs-i18n-files.ts';

test('defaults to every configured locale when the flag is absent', () => {
    assert.deepEqual(parseLocalesArg([], ['de', 'ja']), ['de', 'ja']);
    assert.deepEqual(parseLocalesArg(['--print-locales'], ['de', 'ja']), ['de', 'ja']);
});

test('parses a comma-separated subset, trimming whitespace', () => {
    assert.deepEqual(parseLocalesArg(['--locales= de ,ja '], ['de', 'ja', 'fr']), ['de', 'ja']);
});

test('exits when a requested locale is not configured', () => {
    const exit = process.exit;
    const error = console.error;
    const errors: string[] = [];
    const codes: number[] = [];
    console.error = (message: string) => errors.push(message);
    process.exit = ((code?: number) => {
        codes.push(code ?? 0);
        throw new Error('exit called');
    }) as typeof process.exit;
    try {
        assert.throws(() => parseLocalesArg(['--locales=de,en'], ['de', 'ja']));
    } finally {
        process.exit = exit;
        console.error = error;
    }
    assert.deepEqual(codes, [1]);
    assert.match(errors[0] ?? '', /"en" is not configured/);
});
