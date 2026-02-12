import { describe, expect, it } from 'bun:test';

import { resolveWithDefaults } from './options';

describe('options', () => {
    describe('resolveWithDefaults', () => {
        it('should return defaults when overrides are omitted', () => {
            const defaults = { a: 1, b: 'x' };

            const result = resolveWithDefaults(defaults);

            expect(result).toEqual({ a: 1, b: 'x' });
        });

        it('should override provided keys and keep the rest from defaults', () => {
            const defaults = { a: 1, b: 'x', c: true };
            const overrides = { b: 'y' };

            const result = resolveWithDefaults(defaults, overrides);

            expect(result).toEqual({ a: 1, b: 'y', c: true });
        });

        it('should not mutate defaults or overrides', () => {
            const defaults = { a: 1, nested: { x: 1 } };
            const overrides = { a: 2 };

            const result = resolveWithDefaults(defaults, overrides);

            expect(result).toEqual({ a: 2, nested: { x: 1 } });
            expect(defaults).toEqual({ a: 1, nested: { x: 1 } });
            expect(overrides).toEqual({ a: 2 });
        });
    });
});
