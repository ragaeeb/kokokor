import { beforeEach, describe, expect, it } from 'bun:test';

import {
    analyzeLineSpacing,
    computeAdaptiveLineHeightFactor,
    filterHorizontalLinesOutsideRectangles,
    getLastHorizontalLineY,
    isBoundingBoxContained,
    isObservationCentered,
    mapMatrixToBoundingBox,
} from './layout';

describe('layout', () => {
    describe('isObservationCentered', () => {
        let defaultOptions;

        beforeEach(() => {
            defaultOptions = {
                centerToleranceRatio: 0.05,
                minMarginRatio: 0.1,
            };
        });

        it('should be true if the observation is in the center of the page', () => {
            expect(isObservationCentered({ width: 286, x: 298 }, 960, defaultOptions)).toBeTrue();
        });

        it('should be false if the observation is in not in the center of the page', () => {
            expect(isObservationCentered({ width: 716, x: 73 }, 960, defaultOptions)).toBeFalse();
        });

        it('should be true even for wide footnotes near page edges', () => {
            expect(isObservationCentered({ width: 726, x: 103.82 }, 960, defaultOptions)).toBeTrue();
        });

        it('should be false if the observation spans the majority of the page', () => {
            expect(isObservationCentered({ width: 2026, x: 232 }, 2481, defaultOptions)).toBeFalse();
        });

        it('should return true for a centered observation with sufficient margins', () => {
            const bbox = { height: 20, width: 286, x: 298, y: 100 };
            const imageWidth = 960;

            const result = isObservationCentered(bbox, imageWidth, defaultOptions);

            expect(result).toBe(true);
        });

        it('should return false for a wide observation spanning most of the page', () => {
            const bbox = { height: 20, width: 2026, x: 232, y: 100 };
            const imageWidth = 2481;

            const result = isObservationCentered(bbox, imageWidth, defaultOptions);

            expect(result).toBe(false);
        });

        it('should return false when center point is not within tolerance', () => {
            const bbox = { height: 20, width: 100, x: 100, y: 100 };
            const imageWidth = 1000;

            const result = isObservationCentered(bbox, imageWidth, defaultOptions);

            expect(result).toBe(false);
        });

        it('should return false when left margin is insufficient', () => {
            const bbox = { height: 20, width: 300, x: 50, y: 100 };
            const imageWidth = 1000;

            const result = isObservationCentered(bbox, imageWidth, defaultOptions);

            expect(result).toBe(false);
        });

        it('should return false when right margin is insufficient', () => {
            const bbox = { height: 20, width: 300, x: 650, y: 100 };
            const imageWidth = 1000;

            const result = isObservationCentered(bbox, imageWidth, defaultOptions);

            expect(result).toBe(false);
        });

        it('should handle edge case with exact center alignment', () => {
            const bbox = { height: 20, width: 200, x: 400, y: 100 };
            const imageWidth = 1000;

            const result = isObservationCentered(bbox, imageWidth, defaultOptions);

            expect(result).toBe(true);
        });

        it('should handle very small image width', () => {
            const bbox = { height: 20, width: 20, x: 40, y: 100 };
            const imageWidth = 100;

            const result = isObservationCentered(bbox, imageWidth, defaultOptions);

            expect(result).toBe(true);
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

        it('should filter out lines contained within rectangles', () => {
            const rectangles = [
                { height: 100, width: 200, x: 100, y: 100 },
                { height: 80, width: 150, x: 400, y: 200 },
            ];
            const horizontalLines = [
                { height: 2, width: 100, x: 120, y: 150 }, // inside first rectangle
                { height: 1, width: 800, x: 0, y: 50 }, // outside all rectangles
                { height: 1, width: 80, x: 420, y: 220 }, // inside second rectangle
                { height: 2, width: 100, x: 600, y: 300 }, // outside all rectangles
            ];

            const result = filterHorizontalLinesOutsideRectangles(rectangles, horizontalLines);

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({ height: 1, width: 800, x: 0, y: 50 });
            expect(result[1]).toEqual({ height: 2, width: 100, x: 600, y: 300 });
        });

        it('should return all lines when no rectangles provided', () => {
            const rectangles = [];
            const horizontalLines = [
                { height: 1, width: 800, x: 0, y: 50 },
                { height: 2, width: 200, x: 100, y: 150 },
            ];

            const result = filterHorizontalLinesOutsideRectangles(rectangles, horizontalLines);

            expect(result).toHaveLength(2);
            expect(result).toEqual(horizontalLines);
        });

        it('should handle empty arrays', () => {
            const result1 = filterHorizontalLinesOutsideRectangles([], []);
            const result2 = filterHorizontalLinesOutsideRectangles([{ height: 100, width: 100, x: 0, y: 0 }], []);

            expect(result1).toEqual([]);
            expect(result2).toEqual([]);
        });
    });

    describe('getLastHorizontalLineY', () => {
        it('should return y-coordinate of last horizontal line outside rectangles', () => {
            const rectangles = [{ height: 100, width: 200, x: 100, y: 100 }];
            const horizontalLines = [
                { height: 1, width: 800, x: 0, y: 50 },
                { height: 2, width: 100, x: 120, y: 150 }, // inside rectangle
                { height: 1, width: 800, x: 0, y: 300 },
                { height: 1, width: 800, x: 0, y: 400 },
            ];

            const result = getLastHorizontalLineY(rectangles, horizontalLines);

            expect(result).toBe(400);
        });

        it('should filter out artifacts that are very low y-coordinates', () => {
            const result = getLastHorizontalLineY(
                [],
                [
                    {
                        height: 5,
                        width: 1221,
                        x: 2463,
                        y: 31,
                    },
                    {
                        height: 10,
                        width: 1227,
                        x: 2460,
                        y: 4,
                    },
                ],
            );

            expect(result).toEqual(31);
        });

        it('should return undefined when no horizontal lines exist', () => {
            const rectangles = [{ height: 100, width: 200, x: 100, y: 100 }];
            const horizontalLines = [];

            const result = getLastHorizontalLineY(rectangles, horizontalLines);

            expect(result).toBeUndefined();
        });

        it('should return undefined when all lines are contained within rectangles', () => {
            const rectangles = [{ height: 1000, width: 1000, x: 0, y: 0 }];
            const horizontalLines = [
                { height: 2, width: 200, x: 100, y: 100 },
                { height: 2, width: 200, x: 100, y: 200 },
            ];

            const result = getLastHorizontalLineY(rectangles, horizontalLines);

            expect(result).toBeUndefined();
        });

        it('should use all horizontal lines when no rectangles provided', () => {
            const rectangles = [];
            const horizontalLines = [
                { height: 1, width: 800, x: 0, y: 50 },
                { height: 1, width: 800, x: 0, y: 300 },
                { height: 1, width: 800, x: 0, y: 200 },
            ];

            const result = getLastHorizontalLineY(rectangles, horizontalLines);

            expect(result).toBe(200); // last item in array
        });
    });

    describe('isBoundingBoxContained', () => {
        it('should return true when inner box is completely contained', () => {
            const inner = { height: 50, width: 100, x: 150, y: 150 };
            const outer = { height: 100, width: 200, x: 100, y: 100 };

            const result = isBoundingBoxContained(inner, outer, 0);

            expect(result).toBe(true);
        });

        it('should return false when inner box extends beyond outer box', () => {
            const inner = { height: 50, width: 200, x: 150, y: 150 };
            const outer = { height: 100, width: 200, x: 100, y: 100 };

            const result = isBoundingBoxContained(inner, outer, 0);

            expect(result).toBe(false);
        });

        it('should use tolerance to extend outer box boundaries', () => {
            const inner = { height: 110, width: 210, x: 95, y: 95 };
            const outer = { height: 100, width: 200, x: 100, y: 100 };

            const resultWithoutTolerance = isBoundingBoxContained(inner, outer, 0);
            const resultWithTolerance = isBoundingBoxContained(inner, outer, 10);

            expect(resultWithoutTolerance).toBe(false);
            expect(resultWithTolerance).toBe(true);
        });

        it('should handle exact boundary matches', () => {
            const inner = { height: 100, width: 200, x: 100, y: 100 };
            const outer = { height: 100, width: 200, x: 100, y: 100 };

            const result = isBoundingBoxContained(inner, outer, 0);

            expect(result).toBe(true);
        });

        it('should handle inner box at top-left corner', () => {
            const inner = { height: 50, width: 50, x: 100, y: 100 };
            const outer = { height: 100, width: 200, x: 100, y: 100 };

            const result = isBoundingBoxContained(inner, outer, 0);

            expect(result).toBe(true);
        });

        it('should handle inner box at bottom-right corner', () => {
            const inner = { height: 50, width: 50, x: 250, y: 150 };
            const outer = { height: 100, width: 200, x: 100, y: 100 };

            const result = isBoundingBoxContained(inner, outer, 0);

            expect(result).toBe(true);
        });

        it('should handle negative tolerance', () => {
            const inner = { height: 100, width: 200, x: 100, y: 100 };
            const outer = { height: 100, width: 200, x: 100, y: 100 };

            const result = isBoundingBoxContained(inner, outer, -5);

            expect(result).toBe(false);
        });
    });

    describe('mapMatrixToBoundingBox', () => {
        it('should convert matrix coordinates to bounding box format', () => {
            const matrix: [number, number, number, number] = [10, 20, 110, 70];

            const result = mapMatrixToBoundingBox(matrix);

            expect(result).toEqual({
                height: 50,
                width: 100,
                x: 10,
                y: 20,
            });
        });

        it('should handle zero dimensions', () => {
            const matrix: [number, number, number, number] = [5, 5, 5, 5];

            const result = mapMatrixToBoundingBox(matrix);

            expect(result).toEqual({
                height: 0,
                width: 0,
                x: 5,
                y: 5,
            });
        });

        it('should handle negative coordinates', () => {
            const matrix: [number, number, number, number] = [-10, -20, 50, 30];

            const result = mapMatrixToBoundingBox(matrix);

            expect(result).toEqual({
                height: 50,
                width: 60,
                x: -10,
                y: -20,
            });
        });

        it('should handle large coordinates', () => {
            const matrix: [number, number, number, number] = [1000, 2000, 1500, 2500];

            const result = mapMatrixToBoundingBox(matrix);

            expect(result).toEqual({
                height: 500,
                width: 500,
                x: 1000,
                y: 2000,
            });
        });

        it('should handle floating point coordinates', () => {
            const matrix: [number, number, number, number] = [10, 20, 110, 70];

            const result = mapMatrixToBoundingBox(matrix);

            expect(result).toEqual({
                height: 50,
                width: 100,
                x: 10,
                y: 20,
            });
        });
    });

    describe('analyzeLineSpacing', () => {
        const createItem = (y: number) => ({ bbox: { y } });

        it('should return zeros for insufficient items', () => {
            const items = [createItem(100)];

            const result = analyzeLineSpacing(items);

            expect(result).toEqual({
                minIntraLineGap: 0,
                typicalGap: 0,
            });
        });

        it('should calculate line spacing statistics for normal distribution', () => {
            const items = [
                createItem(100),
                createItem(120),
                createItem(140),
                createItem(160),
                createItem(180),
                createItem(200),
            ];

            const result = analyzeLineSpacing(items);

            expect(result.typicalGap).toBe(20);
            expect(result.minIntraLineGap).toBe(8); // min of (20 * 0.6, 20 * 0.4)
        });

        it('should handle irregular spacing', () => {
            const items = [
                createItem(100),
                createItem(105), // small gap
                createItem(125), // larger gap
                createItem(145),
                createItem(165),
                createItem(200), // very large gap
            ];

            const result = analyzeLineSpacing(items);

            expect(result.typicalGap).toBeGreaterThan(result.minIntraLineGap);
            expect(result.minIntraLineGap).toBeGreaterThan(0);
        });

        it('should handle two items', () => {
            const items = [createItem(100), createItem(120)];

            const result = analyzeLineSpacing(items);

            expect(result).toEqual({
                minIntraLineGap: 0,
                typicalGap: 0,
            });
        });

        it('should handle identical y-coordinates', () => {
            const items = [createItem(100), createItem(100), createItem(100), createItem(120)];

            const result = analyzeLineSpacing(items);

            expect(result.typicalGap).toBe(20);
            expect(result.minIntraLineGap).toBe(0); // min of (0 * 0.6, 20 * 0.4)
        });

        it('should handle large dataset', () => {
            const items = Array.from({ length: 100 }, (_, i) => createItem(i * 25));

            const result = analyzeLineSpacing(items);

            expect(result.typicalGap).toBe(25);
            expect(result.minIntraLineGap).toBe(10); // min of (25 * 0.6, 25 * 0.4)
        });
    });

    describe('computeAdaptiveLineHeightFactor', () => {
        it('should return default factor for empty heights array', () => {
            const result = computeAdaptiveLineHeightFactor([], 20);

            expect(result).toBe(0.3);
        });

        it('should return 0.15 for small gap-to-height ratio', () => {
            const heights = [20, 22, 18, 25, 20]; // avg = 21
            const typicalGap = 15; // ratio = 15/21 ≈ 0.71 < 0.8

            const result = computeAdaptiveLineHeightFactor(heights, typicalGap);

            expect(result).toBe(0.15);
        });

        it('should return 0.25 for medium gap-to-height ratio', () => {
            const heights = [20, 22, 18, 25, 20]; // avg = 21
            const typicalGap = 21; // ratio = 21/21 = 1.0 (between 0.8 and 1.2)

            const result = computeAdaptiveLineHeightFactor(heights, typicalGap);

            expect(result).toBe(0.25);
        });

        it('should return 0.4 for large gap-to-height ratio', () => {
            const heights = [20, 22, 18, 25, 20]; // avg = 21
            const typicalGap = 30; // ratio = 30/21 ≈ 1.43 > 1.2

            const result = computeAdaptiveLineHeightFactor(heights, typicalGap);

            expect(result).toBe(0.4);
        });

        it('should handle single height value', () => {
            const heights = [25];
            const typicalGap = 15;

            const result = computeAdaptiveLineHeightFactor(heights, typicalGap);

            expect(result).toBe(0.15);
        });

        it('should handle zero typical gap', () => {
            const heights = [20, 22, 18];
            const typicalGap = 0;

            const result = computeAdaptiveLineHeightFactor(heights, typicalGap);

            expect(result).toBe(0.15);
        });

        it('should handle very large heights', () => {
            const heights = [1000, 1100, 900];
            const typicalGap = 500;

            const result = computeAdaptiveLineHeightFactor(heights, typicalGap);

            expect(result).toBe(0.15); // 500/1000 = 0.5 < 0.8
        });
    });
});
