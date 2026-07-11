export function keysAreEqual(a: any, b: any) {
    for (const key in a) {
        if (!(key in b)) {
            return false;
        }
    }

    for (const key in b) {
        if (!(key in a)) {
            return false;
        }
    }

    return true;
}
