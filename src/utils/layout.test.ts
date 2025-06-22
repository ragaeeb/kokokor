import { describe, expect, it } from 'bun:test';

import { filterHorizontalLinesOutsideRectangles, isObservationCentered } from './layout';

describe('layout', () => {
    describe('isObservationCentered', () => {
        it('should be true if the observation is in the center of the page', () => {
            expect(
                isObservationCentered({ width: 286, x: 298 }, 960, {
                    centerToleranceRatio: 0.05,
                    minMarginRatio: 0.1,
                }),
            ).toBeTrue();
        });

        it('should be false if the observation is in not in the center of the page', () => {
            expect(
                isObservationCentered({ width: 716, x: 73 }, 960, {
                    centerToleranceRatio: 0.05,
                    minMarginRatio: 0.1,
                }),
            ).toBeFalse();
        });

        it('should be true even for wide footnotes near page edges', () => {
            expect(
                isObservationCentered({ width: 726, x: 103.82 }, 960, {
                    centerToleranceRatio: 0.05,
                    minMarginRatio: 0.1,
                }),
            ).toBeTrue();
        });

        it('should be false if the observation spans the majority of the page', () => {
            expect(
                isObservationCentered({ width: 2026, x: 232 }, 2481, {
                    centerToleranceRatio: 0.05,
                    minMarginRatio: 0.1,
                }),
            ).toBeFalse();
        });

        it('should be false if the observation spans more than one line', () => {
            expect(
                isObservationCentered({ width: 1857, x: 300 }, 2481, {
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
                    height: 3,
                    width: 660,
                    x: 145,
                    y: 13,
                },
                {
                    height: 3,
                    width: 660,
                    x: 145,
                    y: 105,
                },
                {
                    height: 3,
                    width: 291,
                    x: 585,
                    y: 1063,
                },
            ];

            const actual = filterHorizontalLinesOutsideRectangles(
                [
                    {
                        height: 97,
                        width: 740,
                        x: 104,
                        y: 11,
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
                        height: 201,
                        width: 770,
                        x: 864,
                        y: 16,
                    },
                ],
                [
                    {
                        height: 9,
                        width: 736,
                        x: 878,
                        y: 18,
                    },
                ],
                5,
            );

            expect(actual).toBeEmpty();
        });
    });
});
