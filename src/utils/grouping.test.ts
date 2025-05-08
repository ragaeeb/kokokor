import { describe, expect, it } from 'bun:test';

import { groupObservationsByIndex, mergeGroupedObservations } from './grouping';

describe('grouping', () => {
    describe('groupObservationsByIndex', () => {
        it('should group the observations by their closest y-coordinate and sort the observations by their respective x-coordinates', () => {
            const actual = groupObservationsByIndex(
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
                            width: 628,
                            x: 469,
                            y: 292,
                        },
                        text: 'وكم نحروا في سوحها من نحيرة',
                    },
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
                            height: 74,
                            width: 609,
                            x: 1260,
                            y: 36,
                        },
                        text: 'يغوث وود بئس ذلك من ود',
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
                    {
                        bbox: {
                            height: 83,
                            width: 665,
                            x: 1251,
                            y: 283,
                        },
                        text: 'أهلت لغير اللّٰه جهراً على عمد',
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
                72,
            );

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
    });

    describe('mergeGroupedObservations', () => {
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
