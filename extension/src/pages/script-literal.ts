// Players can declare subtitle tracks as JS literals rather than JSON, e.g.
// `player.setup({ tracks: [{ file: "/en.vtt", label: "English" }] })`.
// This is best-effort extraction of a small subset of static values, including minified forms like
// `!0` and `void 0`. It never evaluates page code and is not a general JavaScript parser.

const subtitleArrayKey =
    /^(?:(?:closed[_-]?)?captions?(?:tracks?|languages?|[_-][\w-]+)?|subtitles?(?:tracks?|infos?|sets?|[_-][\w-]+)?|text[_-]?tracks?|tracks|cc(?:_\w+)?)$/i;
const scriptTokens =
    /\/\/[^\r\n]*|\/\*[\s\S]*?(?:\*\/|$)|"(?:[^"\\]|\\[\s\S])*(?:"|$)|'(?:[^'\\]|\\[\s\S])*(?:'|$)|`(?:[^`\\]|\\[\s\S])*(?:`|$)|[\w$]+|[^\s]/g;
const regexLiteral = /\/(?:\\[^\r\n]|\[(?:\\[^\r\n]|[^\]\\\r\n])*\]|[^/\\[\r\n])*\/[a-z]*/iy;
const regexPrefix = /^(?:[=(:,;[{}?!&|~^%*/<>+-]|return|throw|case|yield|typeof|void|delete|await)$/;
const controlCondition = /^(?:if|while|for|with|switch|catch)$/;
const arrayValue = /\s*:\s*\[/y;
const scriptTrivia = /(?:\s+|\/\/[^\r\n]*|\/\*[\s\S]*?\*\/)*/y;
const decimalNumber = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/y;
const nextFlightPush = /\.__next_f\.push\(\[\s*1\s*,\s*(?=["'])/y;
const nextFlightPushEnd = /\s*\]\s*\)/y;
const maximumLiteralLength = 64_000;
const maximumArraysPerScript = 5;
const maximumArrayAttempts = 20;

function* scriptTokenMatches(text: string) {
    const matcher = new RegExp(scriptTokens);
    const controlParentheses: boolean[] = [];
    let previous = '';
    let expectingCondition = false;
    let afterCondition = false;
    for (let match = matcher.exec(text); match !== null; match = matcher.exec(text)) {
        let token = match[0];
        if (token.startsWith('//') || token.startsWith('/*')) continue;
        // A slash can start a regex where an expression is expected; after a value it is usually division.
        if (token === '/' && (afterCondition || previous === '' || regexPrefix.test(previous))) {
            regexLiteral.lastIndex = match.index;
            const regex = regexLiteral.exec(text);
            if (regex !== null) {
                token = regex[0];
                matcher.lastIndex = regexLiteral.lastIndex;
            }
        }
        if (token === '(') controlParentheses.push(expectingCondition);
        // The closing parenthesis of an if/while condition can precede a regex statement, unlike a call.
        afterCondition = token === ')' && controlParentheses.pop() === true;
        expectingCondition = previous !== '.' && controlCondition.test(token);
        previous = token;
        yield { token, index: match.index };
    }
}

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
const unicodeCodePoint = /\{([0-9a-fA-F]+)\}/y;

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
        if (escaped === 'u') {
            const hex = source.slice(index + 1, index + 5);
            if (/^[0-9a-fA-F]{4}$/.test(hex)) {
                value += String.fromCharCode(parseInt(hex, 16));
                index += 4;
            } else {
                unicodeCodePoint.lastIndex = index + 1;
                const match = unicodeCodePoint.exec(source);
                if (match === null) return;
                const codePoint = parseInt(match[1], 16);
                if (codePoint > 0x10ffff) return;
                value += String.fromCodePoint(codePoint);
                index = unicodeCodePoint.lastIndex - 1;
            }
        } else if (escaped === 'x') {
            const hex = source.slice(index + 1, index + 3);
            if (!/^[0-9a-fA-F]{2}$/.test(hex)) return;
            value += String.fromCharCode(parseInt(hex, 16));
            index += 2;
        } else {
            value += { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v', '0': '\0' }[escaped] ?? escaped;
        }
    }
    return;
}

// Converts the JS array or object literal starting at `start` to JSON text.
export function jsLiteralToJson(source: string, start: number): string | undefined {
    return readJsLiteral(source, start)?.json;
}

function readJsLiteral(source: string, start: number) {
    source = source.slice(start, start + maximumLiteralLength);
    const end = source.length;
    let output = '';
    let depth = 0;
    let index = 0;

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
            if (--depth === 0) return { json: output, end: start + index };
        } else if (char === ',' || char === ':') {
            output += char;
            index++;
        } else if (char === '"' || char === "'") {
            const string = readString(source, index);
            if (string === undefined) return;
            output += JSON.stringify(string.value);
            index = string.end;
        } else if (/[-+.\d]/.test(char)) {
            decimalNumber.lastIndex = index;
            const number = decimalNumber.exec(source)?.[0];
            if (number === undefined) return;
            index = skipWhitespace(source, decimalNumber.lastIndex);
            const next = source[index];
            if (next !== ',' && next !== ']' && next !== '}') return;
            output += String(Number(number));
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
    for (const { token, index } of scriptTokenMatches(text)) {
        if (token !== 'self') continue;
        nextFlightPush.lastIndex = index + token.length;
        if (!nextFlightPush.test(text)) continue;
        const string = readString(text, nextFlightPush.lastIndex);
        if (string === undefined) continue;
        nextFlightPushEnd.lastIndex = string.end;
        if (nextFlightPushEnd.test(text)) decoded += string.value;
    }
    return decoded || undefined;
}

// Returns each array literal found under a subtitle-like key (e.g. `captions: [...]`).
export function subtitleArraysFromScript(text: string): unknown[][] {
    const found: unknown[][] = [];
    let attempts = 0;
    let propertyPosition = true;
    for (const { token, index } of scriptTokenMatches(text)) {
        const wasPropertyPosition = propertyPosition;
        propertyPosition = token === '{' || token === ',';
        if (!wasPropertyPosition) continue;
        const key = token.startsWith('"') || token.startsWith("'") ? token.slice(1, -1) : token;
        if (!subtitleArrayKey.test(key)) continue;
        arrayValue.lastIndex = index + token.length;
        if (!arrayValue.test(text)) continue;
        if (attempts++ >= maximumArrayAttempts) break;
        const literal = readJsLiteral(text, arrayValue.lastIndex - 1);
        if (literal === undefined) continue;
        scriptTrivia.lastIndex = literal.end;
        scriptTrivia.exec(text);
        const next = text[scriptTrivia.lastIndex];
        if (next !== undefined && next !== ',' && next !== '}') continue;
        try {
            found.push(JSON.parse(literal.json) as unknown[]);
            if (found.length >= maximumArraysPerScript) break;
        } catch {
            // Not a plain literal after all.
        }
    }
    return found;
}
