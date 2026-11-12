// Players often declare subtitle tracks in executable inline scripts as JS object literals, e.g.
// `player.setup({ tracks: [{ file: "/en.vtt", label: "English" }] })` or SvelteKit/devalue hydration data
// `subtitles:[{url:"…",language:"English",format:"ass"}]`. These are not JSON, so they are converted here
// without evaluating any code. Anything beyond plain literals (calls, references, templates) aborts the
// conversion of that array.

// e.g. captions, closed_captions, captionTracks, subtitles, textTracks, and the generic player `tracks`
// Matching starts at the keyword (no backtracking over long identifiers); `tracks` must be the whole key.
const subtitleArrayKey = /(?:caption|subtit|texttrack|(?<![\w$])tracks)[\w$]*["']?\s*:\s*\[/gi;
const nextFlightPush = /self\.__next_f\.push\(\[1,(?=["'])/g;
const maximumLiteralLength = 64_000;
const maximumArraysPerScript = 5;

// Written out instead of a regex because this runs once per character.
function isSpace(char: string) {
    return char === ' ' || char === '\n' || char === '\r' || char === '\t';
}

function skipWhitespace(source: string, index: number) {
    while (index < source.length && isSpace(source[index])) index++;
    return index;
}

const doubleQuoted = /"[^"\\\n]*(?:\\.[^"\\\n]*)*"/y;
const nonJsonEscape = /\\[^"\\/bfnrtu]/;

function readString(source: string, start: number): { value: string; end: number } | undefined {
    // Most strings, and all Next.js flight data, are valid JSON strings: the native parser decodes those far
    // faster than the character loop below.
    if (source[start] === '"') {
        doubleQuoted.lastIndex = start;
        const literal = doubleQuoted.exec(source)?.[0];
        if (literal === undefined) return;
        if (!nonJsonEscape.test(literal)) {
            try {
                return { value: JSON.parse(literal) as string, end: start + literal.length };
            } catch {
                // e.g. raw control characters, which JS allows but JSON does not
            }
        }
    }

    const quote = source[start];
    let value = '';
    for (let index = start + 1; index < source.length; index++) {
        const char = source[index];
        if (char === quote) return { value, end: index + 1 };
        if (char === '\n') return;
        if (char !== '\\') {
            value += char;
            continue;
        }

        const escaped = source[++index];
        if (escaped === undefined) return;
        if (escaped === 'u' && /^[0-9a-fA-F]{4}$/.test(source.slice(index + 1, index + 5))) {
            value += String.fromCharCode(parseInt(source.slice(index + 1, index + 5), 16));
            index += 4;
        } else if (escaped === 'x' && /^[0-9a-fA-F]{2}$/.test(source.slice(index + 1, index + 3))) {
            value += String.fromCharCode(parseInt(source.slice(index + 1, index + 3), 16));
            index += 2;
        } else {
            value += { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v', '0': '\0' }[escaped] ?? escaped;
        }
    }
    return;
}

// Converts the JS array or object literal starting at `start` to JSON text.
export function jsLiteralToJson(source: string, start: number): string | undefined {
    const end = Math.min(source.length, start + maximumLiteralLength);
    let output = '';
    let depth = 0;
    let index = start;

    while (index < end) {
        const char = source[index];
        if (isSpace(char)) {
            index++;
        } else if (char === '[' || char === '{') {
            depth++;
            output += char;
            index++;
        } else if (char === ']' || char === '}') {
            if (output.endsWith(',')) output = output.slice(0, -1); // trailing commas are valid JS, not JSON
            output += char;
            index++;
            if (--depth === 0) return output;
        } else if (char === ',' || char === ':') {
            output += char;
            index++;
        } else if (char === '"' || char === "'") {
            const string = readString(source, index);
            if (string === undefined) return;
            output += JSON.stringify(string.value);
            index = string.end;
        } else if (/[-+.\d]/.test(char)) {
            const number = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/.exec(source.slice(index, index + 32))?.[0];
            if (number === undefined) return;
            output += String(Number(number));
            index += number.length;
        } else if (char === '!' && (source[index + 1] === '0' || source[index + 1] === '1')) {
            output += source[index + 1] === '0' ? 'true' : 'false'; // minified booleans
            index += 2;
        } else if (/[A-Za-z_$]/.test(char)) {
            const identifier = /^[A-Za-z_$][\w$]*/.exec(source.slice(index, index + 256))![0];
            index += identifier.length;
            if (source[skipWhitespace(source, index)] === ':') {
                output += JSON.stringify(identifier);
            } else if (identifier === 'true' || identifier === 'false' || identifier === 'null') {
                output += identifier;
            } else if (identifier === 'undefined') {
                output += 'null';
            } else if (identifier === 'void' && /^\s*0/.test(source.slice(index, index + 8))) {
                output += 'null';
                index = skipWhitespace(source, index) + 1;
            } else {
                return;
            }
        } else {
            return;
        }
    }
    return;
}

// Next.js App Router streams page data as JSON text inside string literals:
// `self.__next_f.push([1,"…\"captions\":[…]…"])`. Returns the decoded strings joined together.
export function nextFlightText(text: string): string | undefined {
    let decoded = '';
    for (const match of text.matchAll(nextFlightPush)) {
        const string = readString(text, match.index + match[0].length);
        if (string !== undefined) decoded += string.value;
    }
    return decoded || undefined;
}

// Returns each array literal found under a subtitle-like key (e.g. `captions: [...]`).
export function subtitleArraysFromScript(text: string): unknown[][] {
    const found: unknown[][] = [];
    for (const match of text.matchAll(subtitleArrayKey)) {
        if (found.length >= maximumArraysPerScript) break;
        const json = jsLiteralToJson(text, match.index + match[0].length - 1);
        if (json === undefined) continue;
        try {
            found.push(JSON.parse(json) as unknown[]);
        } catch {
            // Not a plain literal after all.
        }
    }
    return found;
}
