import { readFile, writeFile, access, mkdir, readdir } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { XMLBuilder } from 'fast-xml-parser';
import { flattenedLocJsonByNamespace } from './locales.js';

const dirname = fileURLToPath(new URL('.', import.meta.url));
const glossaryJsonPath = join(dirname, '../../loc/glossary.json');
const glossaryTbxPath = join(dirname, 'glossary/glossary.tbx');

// Extending a glossary entry: allowlist the new key here, validate it below,
// and map it in conceptEntry() so it reaches the generated TBX.
const allowlistedKeys = new Set(['term', 'description']);

const slug = (term) => {
    const slugified = term
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    // The 'i+1' entry and friends must not produce an empty or colliding id.
    return slugified.length > 0 ? slugified : 'term';
};

const docsPath = join(dirname, '../../docs/docs');

async function readDocsText() {
    const entries = await readdir(docsPath, { withFileTypes: true, recursive: true });
    const contents = await Promise.all(
        entries
            .filter((entry) => entry.isFile() && /\.(md|mdx)$/.test(entry.name))
            .map((entry) => readFile(join(entry.parentPath ?? entry.path, entry.name), 'utf8'))
    );
    return contents.join('\n');
}

async function englishSourceText() {
    const en = await flattenedLocJsonByNamespace('en');
    const locText = Object.values(en)
        .flatMap((namespace) => Object.values(namespace))
        .join('\n');
    const docsText = await readDocsText();
    return `${locText}\n${docsText}`.toLowerCase();
}

async function validate() {
    const errors = [];
    const fail = (message) => errors.push(message);
    let glossary;
    try {
        glossary = JSON.parse(await readFile(glossaryJsonPath, 'utf-8'));
    } catch (e) {
        return [`loc/glossary.json is not valid JSON: ${e.message}`];
    }

    if (typeof glossary !== 'object' || glossary === null || Array.isArray(glossary)) {
        return ['loc/glossary.json must be an object with a single "terms" key'];
    }
    for (const key of Object.keys(glossary)) {
        if (key !== 'terms') fail(`unknown top-level key "${key}"`);
    }
    const terms = glossary.terms;
    if (!Array.isArray(terms) || terms.length === 0) {
        return ['"terms" must be a non-empty array'];
    }

    const seenTerms = new Map();
    const seenSlugs = new Map();
    let previousTerm;
    for (const [index, entry] of terms.entries()) {
        if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
            fail(`terms[${index}] must be an object`);
            continue;
        }
        for (const key of Object.keys(entry)) {
            if (!allowlistedKeys.has(key)) fail(`terms[${index}] has unknown key "${key}"`);
        }
        const { term, description } = entry;
        if (typeof term !== 'string' || term.trim().length === 0) {
            fail(`terms[${index}] is missing a non-empty "term"`);
            continue;
        }
        if (typeof description !== 'string' || description.trim().length === 0) {
            fail(`terms[${index}] ("${term}") is missing a non-empty "description"`);
        }

        const normalized = term.toLowerCase();
        if (seenTerms.has(normalized)) {
            fail(`duplicate term "${term}" (also "${seenTerms.get(normalized)}")`);
        } else {
            seenTerms.set(normalized, term);
        }
        const entrySlug = slug(term);
        if (seenSlugs.has(entrySlug)) {
            fail(`terms "${term}" and "${seenSlugs.get(entrySlug)}" produce the same TBX id "${entrySlug}"`);
        } else {
            seenSlugs.set(entrySlug, term);
        }
        if (previousTerm !== undefined && normalized < previousTerm) {
            fail(`terms must be sorted case-insensitively: "${term}" before "${previousTerm}"`);
        }
        previousTerm = normalized;
    }

    if (errors.length > 0) {
        return errors;
    }

    // A term that no longer appears in any English source string is stale and should be removed.
    const sourceText = await englishSourceText();
    for (const { term } of terms) {
        if (!sourceText.includes(term.toLowerCase())) {
            fail(`term "${term}" does not appear in any English source string`);
        }
    }

    return errors;
}

async function validateCrowdinConfig() {
    // The glossary push scripts read this section with jq; keep its shape strict so a
    // project.json edit cannot silently disable the glossary push.
    const project = JSON.parse(await readFile(join(dirname, '../../project.json'), 'utf-8'));
    const crowdin = project.crowdin ?? {};
    const errors = [];
    if (!Number.isInteger(crowdin.projectId) || crowdin.projectId <= 0) {
        errors.push('project.json must define "crowdin.projectId" as a positive integer');
    }
    if (!Number.isInteger(crowdin.glossaryId) || crowdin.glossaryId < 0) {
        errors.push(
            'project.json must define "crowdin.glossaryId" as a non-negative integer (0 while the Crowdin glossary has not been created yet)'
        );
    }
    return errors;
}

const conceptEntry = (entry) => ({
    '@_id': slug(entry.term),
    // TBX-Basic permits the 'definition' data category only at the conceptEntry or
    // langSec level; a descrip inside termSec would fail strict dialect validation.
    descrip: { '@_type': 'definition', '#text': entry.description },
    langSec: {
        '@_xml:lang': 'en',
        termSec: { term: entry.term },
    },
});

function tbxDocument(glossary) {
    return {
        tbx: {
            '@_type': 'TBX-Basic',
            '@_style': 'dca',
            '@_xml:lang': 'en',
            '@_xmlns': 'urn:iso:std:iso:30042:ed-2',
            tbxHeader: {
                fileDesc: {
                    sourceDesc: {
                        p: 'asbplayer translator glossary',
                    },
                },
            },
            text: {
                body: {
                    conceptEntry: glossary.terms.map((entry) => conceptEntry(entry)),
                },
            },
        },
    };
}

async function ensureDirectory(path) {
    try {
        await access(path);
    } catch (e) {
        await mkdir(path);
    }
}

async function generate() {
    const glossary = JSON.parse(await readFile(glossaryJsonPath, 'utf-8'));
    const options = { ignoreAttributes: false, attributeNamePrefix: '@_', format: true };
    const xml = new XMLBuilder(options).build(tbxDocument(glossary));
    await ensureDirectory(join(dirname, 'glossary'));
    await writeFile(glossaryTbxPath, `<?xml version="1.0" encoding="UTF-8"?>\n${xml}\n`);
    console.log(`generated ${glossaryTbxPath}`);
}

const command = process.argv[2];
if (command === 'check') {
    const errors = [...(await validate()), ...(await validateCrowdinConfig())];
    if (errors.length > 0) {
        for (const error of errors) {
            console.error(error);
        }
        console.error('^^^^ loc glossary validation failed ^^^^');
        process.exit(1);
    }
} else if (command === 'generate') {
    const errors = await validate();
    if (errors.length > 0) {
        for (const error of errors) {
            console.error(error);
        }
        process.exit(1);
    }
    await generate();
} else {
    console.error(`usage: ${process.argv[1]} <check|generate>`);
    process.exit(1);
}
