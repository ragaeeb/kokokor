import { describe, expect, it } from 'bun:test';

import { groupObservationsByIndex, mergeGroupedObservations, sortGroupsHorizontally } from './grouping';

describe('grouping', () => {
    describe('groupObservationsByIndex', () => {
        it('should group the observations by their closest y-coordinate and sort the observations by their respective x-coordinates', () => {
            const actual = groupObservationsByIndex([
                {
                    bbox: {
                        height: 93,
                        width: 600,
                        x: 479,
                        y: 36,
                    },
                    index: 0,
                    text: 'أعادوا بها معنى سواع ومثله',
                },
                {
                    bbox: {
                        height: 79,
                        width: 632,
                        x: 469,
                        y: 172,
                    },
                    index: 1,
                    text: 'وقد هتفوا عند الشدائد باسمها',
                },
                {
                    bbox: {
                        height: 79,
                        width: 628,
                        x: 469,
                        y: 292,
                    },
                    index: 2,
                    text: 'وكم نحروا في سوحها من نحيرة',
                },
                {
                    bbox: {
                        height: 84,
                        width: 632,
                        x: 469,
                        y: 413,
                    },
                    index: 3,
                    text: 'وكم طائف حول القبور مقبلاً',
                },
                {
                    bbox: {
                        height: 74,
                        width: 609,
                        x: 1260,
                        y: 36,
                    },
                    index: 0,
                    text: 'يغوث وود بئس ذلك من ود',
                },
                {
                    bbox: {
                        height: 79,
                        width: 711,
                        x: 1260,
                        y: 167,
                    },
                    index: 1,
                    text: 'كما يهتف المضطر بالصمد الفرد',
                },
                {
                    bbox: {
                        height: 83,
                        width: 665,
                        x: 1251,
                        y: 283,
                    },
                    index: 2,
                    text: 'أهلت لغير اللّٰه جهراً على عمد',
                },
                {
                    bbox: {
                        height: 114,
                        width: 664,
                        x: 1240,
                        y: 398,
                    },
                    index: 3,
                    text: 'ويستلم الأركان منهن باليد (١)',
                },
            ]);

            expect(actual).toEqual([
                [
                    {
                        bbox: {
                            height: 93,
                            width: 600,
                            x: 479,
                            y: 36,
                        },
                        text: 'أعادوا بها معنى سواع ومثله',
                    },
                    {
                        bbox: {
                            height: 74,
                            width: 609,
                            x: 1260,
                            y: 36,
                        },
                        text: 'يغوث وود بئس ذلك من ود',
                    },
                ],
                [
                    {
                        bbox: {
                            height: 79,
                            width: 632,
                            x: 469,
                            y: 172,
                        },
                        text: 'وقد هتفوا عند الشدائد باسمها',
                    },
                    {
                        bbox: {
                            height: 79,
                            width: 711,
                            x: 1260,
                            y: 167,
                        },
                        text: 'كما يهتف المضطر بالصمد الفرد',
                    },
                ],
                [
                    {
                        bbox: {
                            height: 79,
                            width: 628,
                            x: 469,
                            y: 292,
                        },
                        text: 'وكم نحروا في سوحها من نحيرة',
                    },
                    {
                        bbox: {
                            height: 83,
                            width: 665,
                            x: 1251,
                            y: 283,
                        },
                        text: 'أهلت لغير اللّٰه جهراً على عمد',
                    },
                ],
                [
                    {
                        bbox: {
                            height: 84,
                            width: 632,
                            x: 469,
                            y: 413,
                        },
                        text: 'وكم طائف حول القبور مقبلاً',
                    },
                    {
                        bbox: {
                            height: 114,
                            width: 664,
                            x: 1240,
                            y: 398,
                        },
                        text: 'ويستلم الأركان منهن باليد (١)',
                    },
                ],
            ]);
        });

        it('should group the observations by their index', () => {
            const marked = [
                {
                    bbox: { height: 93, width: 600, x: 479, y: 36 },
                    index: 0,
                    text: 'أعادوا بها معنى سواع ومثله',
                },
                {
                    bbox: { height: 79, width: 632, x: 469, y: 172 },
                    index: 1,
                    text: 'وقد هتفوا عند الشدائد باسمها',
                },
                {
                    bbox: { height: 74, width: 609, x: 1260, y: 36 },
                    index: 0,
                    text: 'يغوث وود بئس ذلك من ود',
                },
                {
                    bbox: { height: 79, width: 711, x: 1260, y: 167 },
                    index: 1,
                    text: 'كما يهتف المضطر بالصمد الفرد',
                },
            ];

            const actual = groupObservationsByIndex(marked);

            expect(actual).toEqual([
                [
                    {
                        bbox: { height: 93, width: 600, x: 479, y: 36 },
                        text: 'أعادوا بها معنى سواع ومثله',
                    },
                    {
                        bbox: { height: 74, width: 609, x: 1260, y: 36 },
                        text: 'يغوث وود بئس ذلك من ود',
                    },
                ],
                [
                    {
                        bbox: { height: 79, width: 632, x: 469, y: 172 },
                        text: 'وقد هتفوا عند الشدائد باسمها',
                    },
                    {
                        bbox: { height: 79, width: 711, x: 1260, y: 167 },
                        text: 'كما يهتف المضطر بالصمد الفرد',
                    },
                ],
            ]);
        });

        it('should group observations by their index property', () => {
            const observations = [
                { bbox: { height: 10, width: 50, x: 10, y: 10 }, index: 0, text: 'Line 1, Word 1' },
                { bbox: { height: 10, width: 50, x: 10, y: 30 }, index: 1, text: 'Line 2, Word 1' },
                { bbox: { height: 10, width: 60, x: 70, y: 10 }, index: 0, text: 'Line 1, Word 2' },
                { bbox: { height: 10, width: 60, x: 70, y: 30 }, index: 1, text: 'Line 2, Word 2' },
                { bbox: { height: 10, width: 100, x: 10, y: 50 }, index: 2, text: 'Line 3' },
            ];

            const result = groupObservationsByIndex(observations);

            expect(Object.keys(result).length).toBe(3); // Three groups
            expect(result[0].length).toBe(2); // Two items in group 0
            expect(result[1].length).toBe(2); // Two items in group 1
            expect(result[2].length).toBe(1); // One item in group 2

            // Check group contents
            expect(result[0].map((o) => o.text)).toEqual(['Line 1, Word 1', 'Line 1, Word 2']);
            expect(result[1].map((o) => o.text)).toEqual(['Line 2, Word 1', 'Line 2, Word 2']);
            expect(result[2].map((o) => o.text)).toEqual(['Line 3']);
        });

        it('should handle empty input array', () => {
            const actual = groupObservationsByIndex([]);
            expect(actual).toEqual([]);
        });

        it('should handle non-sequential indices', () => {
            const marked = [
                { bbox: { height: 10, width: 100, x: 10, y: 10 }, index: 5, text: 'Text 1' },
                { bbox: { height: 10, width: 100, x: 20, y: 20 }, index: 10, text: 'Text 2' },
            ];

            const actual = groupObservationsByIndex(marked);

            // Results should have empty arrays for indices 0-4 and 6-9
            expect(actual[5]).toEqual([
                {
                    bbox: { height: 10, width: 100, x: 10, y: 10 },
                    text: 'Text 1',
                },
            ]);

            expect(actual[10]).toEqual([
                {
                    bbox: { height: 10, width: 100, x: 20, y: 20 },
                    text: 'Text 2',
                },
            ]);
        });
    });

    describe('sortGroupsHorizontally', () => {
        it('should sort each group by x-coordinate', () => {
            const groups = [
                [
                    { bbox: { height: 10, width: 100, x: 200, y: 10 }, text: 'Should be second' },
                    { bbox: { height: 10, width: 100, x: 100, y: 10 }, text: 'Should be first' },
                ],
                [
                    { bbox: { height: 10, width: 100, x: 300, y: 30 }, text: 'Should be third' },
                    { bbox: { height: 10, width: 100, x: 100, y: 30 }, text: 'Should be first' },
                    { bbox: { height: 10, width: 100, x: 200, y: 30 }, text: 'Should be second' },
                ],
            ];

            const sorted = sortGroupsHorizontally(groups);

            expect(sorted[0][0].bbox.x).toBe(100);
            expect(sorted[0][1].bbox.x).toBe(200);
            expect(sorted[1][0].bbox.x).toBe(100);
            expect(sorted[1][1].bbox.x).toBe(200);
            expect(sorted[1][2].bbox.x).toBe(300);
        });

        it('should not modify the original array', () => {
            const original = [
                [
                    { bbox: { height: 10, width: 100, x: 200, y: 10 }, text: 'First' },
                    { bbox: { height: 10, width: 100, x: 100, y: 10 }, text: 'Second' },
                ],
            ];

            const originalFirstX = original[0][0].bbox.x;
            sortGroupsHorizontally(original);

            // Original should remain unchanged
            expect(original[0][0].bbox.x).toBe(originalFirstX);
        });

        it('should handle empty groups', () => {
            const groups = [[], []];
            const sorted = sortGroupsHorizontally(groups);
            expect(sorted).toEqual([[], []]);
        });
    });

    describe('mergeGroupedObservations', () => {
        it('should merge observations within each group into a single observation', () => {
            const grouped = [
                [
                    { bbox: { height: 10, width: 100, x: 100, y: 10 }, text: 'First part' },
                    { bbox: { height: 15, width: 100, x: 200, y: 5 }, text: 'Second part' },
                ],
                [
                    { bbox: { height: 10, width: 100, x: 100, y: 50 }, text: 'Third part' },
                    { bbox: { height: 10, width: 100, x: 200, y: 50 }, text: 'Fourth part' },
                ],
            ];

            const merged = mergeGroupedObservations(grouped);

            expect(merged).toEqual([
                {
                    bbox: { height: 15, width: 200, x: 100, y: 5 },
                    text: 'First part Second part',
                },
                {
                    bbox: { height: 10, width: 200, x: 100, y: 50 },
                    text: 'Third part Fourth part',
                },
            ]);
        });

        it('should correctly calculate bounding box dimensions for merged observations', () => {
            const grouped = [
                [
                    { bbox: { height: 10, width: 50, x: 100, y: 10 }, text: 'First' },
                    { bbox: { height: 20, width: 60, x: 200, y: 5 }, text: 'Second' },
                ],
            ];

            const merged = mergeGroupedObservations(grouped);

            expect(merged[0].bbox).toEqual({
                height: 20,
                width: 160, // max x (200+60=260) - min x (100) = 160
                x: 100, // min x
                y: 5, // min y
            });
        });

        it('should handle single observation groups', () => {
            const grouped = [[{ bbox: { height: 10, width: 100, x: 100, y: 10 }, text: 'Single observation' }]];

            const merged = mergeGroupedObservations(grouped);

            expect(merged).toEqual([{ bbox: { height: 10, width: 100, x: 100, y: 10 }, text: 'Single observation' }]);
        });

        it('should merge the grouped observations', () => {
            const actual = mergeGroupedObservations([
                [
                    {
                        bbox: {
                            height: 93,
                            width: 600,
                            x: 479,
                            y: 36,
                        },
                        text: 'أعادوا بها معنى سواع ومثله',
                    },
                    {
                        bbox: {
                            height: 74,
                            width: 609,
                            x: 1260,
                            y: 36,
                        },
                        text: 'يغوث وود بئس ذلك من ود',
                    },
                ],
                [
                    {
                        bbox: {
                            height: 79,
                            width: 632,
                            x: 469,
                            y: 172,
                        },
                        text: 'وقد هتفوا عند الشدائد باسمها',
                    },
                    {
                        bbox: {
                            height: 79,
                            width: 711,
                            x: 1260,
                            y: 167,
                        },
                        text: 'كما يهتف المضطر بالصمد الفرد',
                    },
                ],
                [
                    {
                        bbox: {
                            height: 79,
                            width: 628,
                            x: 469,
                            y: 292,
                        },
                        text: 'وكم نحروا في سوحها من نحيرة',
                    },
                    {
                        bbox: {
                            height: 83,
                            width: 665,
                            x: 1251,
                            y: 283,
                        },
                        text: 'أهلت لغير اللّٰه جهراً على عمد',
                    },
                ],
                [
                    {
                        bbox: {
                            height: 84,
                            width: 632,
                            x: 469,
                            y: 413,
                        },
                        text: 'وكم طائف حول القبور مقبلاً',
                    },
                    {
                        bbox: {
                            height: 114,
                            width: 664,
                            x: 1240,
                            y: 398,
                        },
                        text: 'ويستلم الأركان منهن باليد (١)',
                    },
                ],
            ]);

            expect(actual).toEqual([
                {
                    bbox: {
                        height: 93,
                        width: 1390,
                        x: 479,
                        y: 36,
                    },
                    text: 'أعادوا بها معنى سواع ومثله يغوث وود بئس ذلك من ود',
                },
                {
                    bbox: {
                        height: 84,
                        width: 1502,
                        x: 469,
                        y: 167,
                    },
                    text: 'وقد هتفوا عند الشدائد باسمها كما يهتف المضطر بالصمد الفرد',
                },
                {
                    bbox: {
                        height: 88,
                        width: 1447,
                        x: 469,
                        y: 283,
                    },
                    text: 'وكم نحروا في سوحها من نحيرة أهلت لغير اللّٰه جهراً على عمد',
                },
                {
                    bbox: {
                        height: 114,
                        width: 1435,
                        x: 469,
                        y: 398,
                    },
                    text: 'وكم طائف حول القبور مقبلاً ويستلم الأركان منهن باليد (١)',
                },
            ]);
        });
    });
});
