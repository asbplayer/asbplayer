export function arrayEquals<T>(
    a: readonly T[] | undefined,
    b: readonly T[] | undefined,
    equals = (lhs: T, rhs: T) => lhs === rhs
): boolean {
    if (a === b) return true;
    if (!a || !b) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; ++i) {
        if (!equals(a[i], b[i])) return false;
    }
    return true;
}
