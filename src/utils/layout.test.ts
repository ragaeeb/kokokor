import { describe, expect, it } from 'bun:test';

import {
    filterHorizontalLinesOutsideRectangles,
    filterObservationsInsideRectangles,
    isObservationCentered,
} from './layout';

describe('layout', () => {
    describe('isObservationCentered', () => {
        it('should be true if the observation is in the center of the page', () => {
            expect(
                isObservationCentered({ bbox: { width: 286, x: 298 } }, 960, {
                    centerToleranceRatio: 0.05,
                    minMarginRatio: 0.1,
                }),
            ).toBeTrue();
        });

        it('should be false if the observation is in not in the center of the page', () => {
            expect(
                isObservationCentered({ bbox: { width: 716, x: 73 } }, 960, {
                    centerToleranceRatio: 0.05,
                    minMarginRatio: 0.1,
                }),
            ).toBeFalse();
        });

        it('should be true even for wide footnotes near page edges', () => {
            expect(
                isObservationCentered({ bbox: { width: 726, x: 103.82 } }, 960, {
                    centerToleranceRatio: 0.05,
                    minMarginRatio: 0.1,
                }),
            ).toBeTrue();
        });

        it('should be false if the observation spans the majority of the page', () => {
            expect(
                isObservationCentered({ bbox: { width: 2026, x: 232 } }, 2481, {
                    centerToleranceRatio: 0.05,
                    minMarginRatio: 0.1,
                }),
            ).toBeFalse();
        });

        it('should be false if the observation spans more than one line', () => {
            expect(
                isObservationCentered({ bbox: { width: 1857, x: 300 } }, 2481, {
                    centerToleranceRatio: 0.05,
                    minMarginRatio: 0.2,
                }),
            ).toBeFalse();
        });
    });

    describe('filterHorizontalLinesOutsideRectangles', () => {
        it('should only keep the last horizontal line', () => {
            const horizontalLines = [
                {
                    x: 145,
                    y: 13,
                    width: 660,
                    height: 3,
                },
                {
                    x: 145,
                    y: 105,
                    width: 660,
                    height: 3,
                },
                {
                    x: 585,
                    y: 1063,
                    width: 291,
                    height: 3,
                },
            ];

            const actual = filterHorizontalLinesOutsideRectangles(
                [
                    {
                        x: 104,
                        y: 11,
                        width: 740,
                        height: 97,
                    },
                ],
                horizontalLines,
                5,
            );

            expect(actual).toEqual([horizontalLines.at(-1)]);
        });

        it('should not keep any horizontal lines', () => {
            const actual = filterHorizontalLinesOutsideRectangles(
                [
                    {
                        x: 864,
                        y: 16,
                        width: 770,
                        height: 201,
                    },
                ],
                [
                    {
                        x: 878,
                        y: 18,
                        width: 736,
                        height: 9,
                    },
                ],
                5,
            );

            expect(actual).toBeEmpty();
        });
    });

    describe('filterObservationsInsideRectangles', () => {
        it('should only return the first observation since it is in the title rectangle', () => {
            const observations = [
                {
                    text: 'A',
                    bbox: {
                        y: 40,
                        x: 240,
                        width: 480,
                        height: 40,
                    },
                },
                {
                    text: 'B',
                    bbox: {
                        height: 42,
                        y: 120,
                        width: 642,
                        x: 190,
                    },
                },
            ];

            const actual = filterObservationsInsideRectangles(observations, [
                {
                    x: 104,
                    y: 11,
                    width: 740,
                    height: 97,
                },
            ]);

            expect(actual).toEqual(observations.slice(0, 1));
        });
    });
});
