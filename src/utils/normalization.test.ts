import { describe, expect, it } from 'bun:test';

import { mapOcrResultToRTLObservations, normalizeObservationsX } from './normalization';

describe('normalization', () => {
    describe('mapOcrResultToRTLObservations', () => {
        it('should correct the x-coordinates to be from the right', () => {
            const actual = mapOcrResultToRTLObservations(
                [{ bbox: { height: 1, width: 50, x: 0, y: 0 }, text: 'Ewwo' }],
                100,
            );

            expect(actual).toEqual([{ bbox: { height: 1, width: 50, x: 50, y: 0 }, text: 'Ewwo' }]);
        });
    });

    describe('normalizeObservationsX', () => {
        it('should normalize the x-coordinates based on the margins and threshold', () => {
            const actual = normalizeObservationsX(
                [
                    {
                        bbox: {
                            x: 22,
                        },
                    },
                    {
                        bbox: {
                            x: 25,
                        },
                    },
                    {
                        bbox: {
                            x: 28,
                        },
                    },
                    {
                        bbox: {
                            x: 26,
                        },
                    },
                    {
                        bbox: {
                            x: 219.99,
                        },
                    },
                ],
                72,
            );

            expect(actual).toEqual([
                {
                    bbox: {
                        x: 22,
                    },
                },
                {
                    bbox: {
                        x: 22,
                    },
                },
                {
                    bbox: {
                        x: 22,
                    },
                },
                {
                    bbox: {
                        x: 22,
                    },
                },
                {
                    bbox: {
                        x: 219.99,
                    },
                },
            ]);
        });
    });
});
