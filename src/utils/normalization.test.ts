import { describe, expect, it } from 'bun:test';

import {
    containsArabicHonorific,
    filterObservationsByContent,
    mapOcrResultToRTLObservations,
    normalizeObservationsX,
} from './normalization';

const codePointRange = (start: number, end: number) =>
    Array.from({ length: end - start + 1 }, (_, index) => String.fromCodePoint(start + index));

const honorificInventory = [
    ...codePointRange(0x0610, 0x0614),
    ...codePointRange(0xfbc3, 0xfbd2),
    ...codePointRange(0xfd40, 0xfd4f),
    ...codePointRange(0xfdc8, 0xfdcf),
    ...codePointRange(0xfdfa, 0xfdfb),
    ...codePointRange(0xfdfd, 0xfdff),
    ...codePointRange(0x10ed1, 0x10ed8),
];

describe('normalization', () => {
    describe('filterObservationsByContent', () => {
        it('keeps compact Arabic reference labels but rejects symbol-heavy ornament OCR', () => {
            const observations = [
                { bbox: { height: 20, width: 100, x: 10, y: 10 }, text: 'نص عربي مفيد' },
                { bbox: { height: 20, width: 40, x: 10, y: 40 }, text: 'ج٥٤-' },
                { bbox: { height: 20, width: 80, x: 10, y: 70 }, text: '٥@@@ج' },
            ];

            expect(filterObservationsByContent(observations, 'arabic').map((observation) => observation.text)).toEqual([
                'نص عربي مفيد',
                'ج٥٤-',
            ]);
        });

        it.each(['any', 'arabic'] as const)(
            'preserves isolated honorific signs and ligatures with the %s content policy',
            (contentFilter) => {
                const observations = [
                    { bbox: { height: 20, width: 100, x: 10, y: 10 }, text: 'نص عربي مفيد' },
                    ...honorificInventory.map((text, index) => ({
                        bbox: { height: 10, width: 10, x: 10, y: 40 + index * 12 },
                        text,
                    })),
                ];

                const retained = filterObservationsByContent(observations, contentFilter).map(
                    (observation) => observation.text,
                );

                expect(retained).toEqual(observations.map((observation) => observation.text));
            },
        );

        it('does not classify the Rial currency sign as an honorific', () => {
            expect(containsArabicHonorific('﷼')).toBeFalse();
        });
    });

    describe('mapOcrResultToRTLObservations', () => {
        it('should correct the x-coordinates to be from the right', () => {
            const actual = mapOcrResultToRTLObservations(
                [{ bbox: { height: 1, width: 50, x: 0, y: 0 }, text: 'Ewwo' }],
                100,
            );

            expect(actual).toEqual([{ bbox: { height: 1, width: 50, x: 50, y: 0 }, text: 'Ewwo' }]);
        });

        it('should handle multiple observations', () => {
            const observations = [
                { bbox: { height: 10, width: 30, x: 10, y: 5 }, text: 'Text 1' },
                { bbox: { height: 15, width: 40, x: 50, y: 20 }, text: 'Text 2' },
            ];
            const imageWidth = 200;

            const result = mapOcrResultToRTLObservations(observations, imageWidth);

            expect(result).toEqual([
                { bbox: { height: 10, width: 30, x: 160, y: 5 }, text: 'Text 1' },
                { bbox: { height: 15, width: 40, x: 110, y: 20 }, text: 'Text 2' },
            ]);
        });

        it('should handle an empty observations array', () => {
            const result = mapOcrResultToRTLObservations([], 100);
            expect(result).toEqual([]);
        });
    });

    describe('normalizeObservationsX', () => {
        it('should normalize the x-coordinates based on the margins and threshold', () => {
            const actual = normalizeObservationsX(
                [
                    { bbox: { height: 5, width: 10, x: 22, y: 0 }, text: 'Text 1' },
                    { bbox: { height: 5, width: 15, x: 25, y: 10 }, text: 'Text 2' },
                    { bbox: { height: 5, width: 20, x: 28, y: 20 }, text: 'Text 3' },
                    { bbox: { height: 5, width: 25, x: 26, y: 30 }, text: 'Text 4' },
                    { bbox: { height: 5, width: 30, x: 219.99, y: 40 }, text: 'Text 5' },
                ],
                72,
                300,
            );

            expect(actual).toEqual([
                { bbox: { height: 5, width: 10, x: 22, y: 0 }, text: 'Text 1' },
                { bbox: { height: 5, width: 15, x: 22, y: 10 }, text: 'Text 2' },
                { bbox: { height: 5, width: 20, x: 22, y: 20 }, text: 'Text 3' },
                { bbox: { height: 5, width: 25, x: 22, y: 30 }, text: 'Text 4' },
                { bbox: { height: 5, width: 30, x: 219.99, y: 40 }, text: 'Text 5' },
            ]);
        });

        it('should handle empty observations array', () => {
            const result = normalizeObservationsX([], 72, 300);
            expect(result).toEqual([]);
        });
    });
});
