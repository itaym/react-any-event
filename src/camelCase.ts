// Tiny inlined replacement for the `camelcase` package: this library only
// ever needs to camel-case a two-word, space-separated phrase ("on banana",
// "old value"), so pulling in a dependency for it isn't worth an extra
// install (and, until this file existed, `camelcase` wasn't even declared as
// a dependency at all - it only resolved by accident via a hoisted,
// unrelated devDependency).
export function toCamelCase(words: string): string {
    return words
        .trim()
        .split(/[\s_-]+/)
        .map((word, index) => {
            const lower = word.toLowerCase();
            return index === 0 ? lower : lower.charAt(0).toUpperCase() + lower.slice(1);
        })
        .join('');
}
