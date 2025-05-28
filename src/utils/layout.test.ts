import { describe, expect, it } from 'bun:test';

import {
    filterHorizontalLinesOutsideRectangles,
    filterObservationsInsideRectangles,
    isObservationCentered,
} from './layout';

describe('layout', () => {
    describe('isObservationCentered', () => {
        it('should be true if the observation is in the center of the page', () => {
            expect(isObservationCentered({ bbox: { width: 286, x: 298 } }, 960)).toBeTrue();
        });

        it('should be false if the observation is in not in the center of the page', () => {
            expect(isObservationCentered({ bbox: { width: 716, x: 73 } }, 960)).toBeFalse();
        });

        it('should be true even for wide footnotes near page edges', () => {
            expect(isObservationCentered({ bbox: { width: 726, x: 103.82 } }, 960)).toBeTrue();
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
