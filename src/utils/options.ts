/**
 * Resolves optional overrides against a default options object.
 *
 * This is a shallow merge helper intended for option bags where
 * top-level keys are merged and nested objects are handled explicitly
 * by the caller when needed.
 */
export const resolveWithDefaults = <T extends object>(defaults: T, overrides?: Partial<T>): T => ({
    ...defaults,
    ...(overrides
        ? (Object.fromEntries(Object.entries(overrides).filter(([, value]) => value !== undefined)) as Partial<T>)
        : {}),
});
