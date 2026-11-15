import { z } from 'zod';
import { PlayMode } from '@project/common';
import type { AsbplayerSettings, TextSubtitleSettings } from '@project/common/settings/settings';
import type { IgnorePathSegment } from '@project/common/settings/import-export';
import { defaultSettings } from '@project/common/settings/settings-provider';
import { deprecatedPaths, settingsSchema, validateSettings } from '@project/common/settings/import-export';
import { expect, it } from '@jest/globals';

type Failure = string;

// Every array and record is populated so the conformance walk can descend
// into their item schemas. `defaultSettings` is compiler-checked against
// `AsbplayerSettings`, so the fixture only fills in the collections the
// defaults leave empty.
const populatedSettings: AsbplayerSettings = {
    ...defaultSettings,
    subtitleCustomStyles: [{ key: 'transform', value: 'scale(1)' }],
    subtitleTracksV2: [trackSettings()],
    recipes: [{ name: 'Test recipe', playbackModes: [PlayMode.normal], settings: {} }],
    lastPlaybackPositions: [{ fileName: 'example.mp4', position: 1200 }],
    customAnkiFields: { myCustomField: 'MyCustomField' },
    customAnkiFieldSettings: { MyCustomField: { order: 99, display: true } },
    tags: ['mining'],
    streamingLastLanguagesSynced: { 'www.example.com': ['ja'] },
    dictionaryTracks: defaultSettings.dictionaryTracks.map((track) => ({
        ...track,
        dictionaryAnkiDecks: ['Default'],
        dictionaryAnkiWordFields: ['Word'],
        dictionaryAnkiSentenceFields: ['Sentence'],
    })),
};

// Written out in full so the compiler enforces the track element's shape
// against `TextSubtitleSettings` (the schema must enumerate these keys too).
function trackSettings(): TextSubtitleSettings {
    return {
        subtitleColor: defaultSettings.subtitleColor,
        subtitleSize: defaultSettings.subtitleSize,
        subtitleThickness: defaultSettings.subtitleThickness,
        subtitleOutlineThickness: defaultSettings.subtitleOutlineThickness,
        subtitleOutlineColor: defaultSettings.subtitleOutlineColor,
        subtitleShadowThickness: defaultSettings.subtitleShadowThickness,
        subtitleShadowColor: defaultSettings.subtitleShadowColor,
        subtitleBackgroundOpacity: defaultSettings.subtitleBackgroundOpacity,
        subtitleBackgroundColor: defaultSettings.subtitleBackgroundColor,
        subtitleFontFamily: defaultSettings.subtitleFontFamily,
        subtitleCustomStyles: [{ key: 'transform', value: 'scale(1)' }],
        subtitleBlur: true,
        subtitleAlignment: 'bottom',
    };
}

const describePath = (path: string) => path || 'settings root';

// The walkers take zod's core schema type: v4's classic wrappers expose
// `shape`, `element`, and `valueType` as core `$ZodType`, not classic
// `ZodType`. Empty arrays and records would hide their item schemas from the
// walk, so the fixture must populate every collection.
const assertCollectionsPopulated = (schema: z.core.$ZodType, value: unknown, path: string, failures: Failure[]) => {
    if (schema instanceof z.ZodOptional) {
        if (value !== undefined) assertCollectionsPopulated(schema.unwrap(), value, path, failures);
        return;
    }

    if (schema instanceof z.ZodObject) {
        for (const [key, childSchema] of Object.entries(schema.shape)) {
            assertCollectionsPopulated(
                childSchema,
                (value as Record<string, unknown>)[key],
                path ? `${path}.${key}` : key,
                failures
            );
        }
        return;
    }

    if (schema instanceof z.ZodArray) {
        const items = value as unknown[];
        if (items.length === 0) {
            failures.push(`${describePath(path)}: array must contain at least one element`);
        }
        items.forEach((item, index) => assertCollectionsPopulated(schema.element, item, `${path}[${index}]`, failures));
        return;
    }

    if (schema instanceof z.ZodRecord) {
        const entries = Object.entries(value as Record<string, unknown>);
        if (entries.length === 0) {
            failures.push(`${describePath(path)}: record must contain at least one entry`);
        }
        for (const [key, entryValue] of entries) {
            assertCollectionsPopulated(schema.valueType, entryValue, `${path}.${key}`, failures);
        }
        return;
    }
};

// Key-set equality between the schema and the settings model (as embodied by
// the populated fixture) at every object level. A key in the settings but not
// the schema means current exports would fail to import; a key in the schema
// but not the settings means the schema validates a setting that does not
// exist. `streamingPages` is exempt: stripped before validation and absent
// from the schema by design.
const assertKeysConform = (
    schema: z.core.$ZodType,
    value: unknown,
    path: string,
    failures: Failure[],
    rootExemptKeys?: ReadonlySet<string>
) => {
    if (schema instanceof z.ZodOptional) {
        if (value !== undefined) assertKeysConform(schema.unwrap(), value, path, failures);
        return;
    }

    if (schema instanceof z.ZodObject) {
        const settingsObject = value as Record<string, unknown>;
        for (const key of Object.keys(settingsObject)) {
            if (!(key in schema.shape) && !(rootExemptKeys?.has(key) ?? false)) {
                failures.push(`${describePath(path)}: settings key "${key}" is missing from the schema`);
            }
        }
        for (const [key, childSchema] of Object.entries(schema.shape)) {
            if (!(key in settingsObject)) {
                failures.push(`${describePath(path)}: schema key "${key}" is missing from the settings`);
            } else {
                assertKeysConform(childSchema, settingsObject[key], path ? `${path}.${key}` : key, failures);
            }
        }
        return;
    }

    if (schema instanceof z.ZodArray) {
        (value as unknown[]).forEach((item, index) =>
            assertKeysConform(schema.element, item, `${path}[${index}]`, failures)
        );
        return;
    }

    if (schema instanceof z.ZodRecord) {
        for (const [key, entryValue] of Object.entries(value as Record<string, unknown>)) {
            assertKeysConform(schema.valueType, entryValue, `${path}.${key}`, failures);
        }
    }
};

it('populates every array and record in the test settings', () => {
    const failures: Failure[] = [];
    assertCollectionsPopulated(settingsSchema, populatedSettings, '', failures);
    expect(failures).toEqual([]);
});

it('matches the settings schema key-for-key at every nesting level', () => {
    const failures: Failure[] = [];
    assertKeysConform(settingsSchema, populatedSettings, '', failures, new Set(['streamingPages']));
    expect(failures).toEqual([]);
});

it('validates the fully populated settings', () => {
    validateSettings(populatedSettings);
});

// Resolves one path segment against the schema so deprecated path entries can
// be checked for typos; a typo would otherwise silently strip nothing.
const descendSchema = (schema: z.core.$ZodType, segment: IgnorePathSegment, failures: Failure[]): z.core.$ZodType => {
    if (segment === '*') {
        if (!(schema instanceof z.ZodArray)) {
            failures.push(`deprecated path segment "${segment}" must traverse an array schema`);
            return schema;
        }
        return schema.element;
    }
    if (!(schema instanceof z.ZodObject)) {
        failures.push(`deprecated path segment "${segment}" must land on an object schema`);
        return schema;
    }
    if (!(segment in schema.shape)) {
        failures.push(`deprecated path segment "${segment}" does not resolve in the schema`);
        return schema;
    }
    return schema.shape[segment];
};

// A deprecated path must point at a key the schema no longer knows, so the
// entry is only valid if strict validation would have rejected the key.
it('points every deprecated path at a key missing from the schema', () => {
    const failures: Failure[] = [];
    for (const path of deprecatedPaths) {
        let schemaNode: z.core.$ZodType = settingsSchema;
        for (const segment of path.slice(0, -1)) {
            schemaNode = descendSchema(schemaNode, segment, failures);
        }
        const lastSegment = path[path.length - 1];
        if (schemaNode instanceof z.ZodObject && lastSegment in schemaNode.shape) {
            failures.push(`deprecated path ${path.join('.')} points at a key the schema still accepts`);
        }
    }
    expect(failures).toEqual([]);
});

const setAtPath = (target: any, path: readonly IgnorePathSegment[], value: unknown) => {
    const [segment, ...remainingPath] = path;
    if (segment === '*') {
        for (const item of target as unknown[]) setAtPath(item, remainingPath, value);
        return;
    }
    if (remainingPath.length === 0) {
        target[segment] = value;
        return;
    }
    if (!(segment in target)) {
        target[segment] = remainingPath[0] === '*' ? [] : {};
    }
    setAtPath(target[segment], remainingPath, value);
};

const getAtPath = (value: any, path: readonly IgnorePathSegment[]): unknown => {
    const [segment, ...remainingPath] = path;
    if (segment === '*') {
        return (value as unknown[]).map((item) => getAtPath(item, remainingPath));
    }
    if (remainingPath.length === 0) {
        return value?.[segment];
    }
    return getAtPath(value?.[segment], remainingPath);
};

it('strips deprecated keys from older exports instead of rejecting them', () => {
    // The list is empty until a settings key is removed from the model; this
    // keeps the stripping wired so the first removal only needs a path entry.
    for (const path of deprecatedPaths) {
        const legacySettings = JSON.parse(JSON.stringify(populatedSettings));
        setAtPath(legacySettings, path, 'legacy-value');

        const imported = validateSettings(legacySettings);

        expect(getAtPath(imported, path)).toBeUndefined();
    }
});
