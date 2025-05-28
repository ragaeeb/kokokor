import type { BoundingBox, Observation } from '@/types';

export const isObservationCentered = (observation: Observation, imageWidth: number, toleranceRatio = 0.05) => {
    const pageCenter = imageWidth / 2;
    const tolPx = imageWidth * toleranceRatio;
    const centerX = observation.bbox.x + observation.bbox.width / 2;
    return Math.abs(centerX - pageCenter) <= tolPx;
};

/**
 * @param  lines           Array of “rows” (each row is an array of Observations on that horizontal band)
 * @param  expectedCols    How many segments per row to expect (2 for most Arabic poetry)
 * @param  minPoeticRatio  What fraction of rows must match expectedCols in order to call it “poetic”
 */
export const isPoeticLayout = (lines: Observation[][], expectedCols = 2, minPoeticRatio = 0.6) => {
    if (lines.length < 3) {
        return false;
    }

    const poeticCount = lines.filter((row) => row.length === expectedCols).length;
    const ratio = poeticCount / lines.length;

    return ratio >= minPoeticRatio;
};

/**
 * Filters out horizontal lines that are contained within any of the provided rectangles.
 * @param rectangles - Array of rectangles to check containment against
 * @param horizontalLines - Array of horizontal lines to filter
 * @param tolerance - Pixel tolerance for boundary checking (default: 5)
 * @returns Array of horizontal lines that are NOT contained within any rectangle
 */
export const filterHorizontalLinesOutsideRectangles = (
    rectangles: BoundingBox[],
    horizontalLines: BoundingBox[],
    tolerance: number = 5,
) => {
    return horizontalLines.filter((line) => {
        // Check if this line is contained within any rectangle
        return !rectangles.some((rect) => {
            return isBoundingBoxContained(line, rect, tolerance);
        });
    });
};

/**
 * Checks if a bounding box is contained within another bounding box with tolerance.
 * @param inner - The bounding box to check if it's inside
 * @param outer - The bounding box to check if it contains the inner box
 * @param tolerance - The pixel tolerance for boundary checking (default: 5)
 * @returns True if the inner bounding box is contained within the outer bounding box
 */
export const isBoundingBoxContained = (inner: BoundingBox, outer: BoundingBox, tolerance: number = 5): boolean => {
    const outerLeft = outer.x - tolerance;
    const outerRight = outer.x + outer.width + tolerance;
    const outerTop = outer.y - tolerance;
    const outerBottom = outer.y + outer.height + tolerance;

    const innerLeft = inner.x;
    const innerRight = inner.x + inner.width;
    const innerTop = inner.y;
    const innerBottom = inner.y + inner.height;

    return innerLeft >= outerLeft && innerRight <= outerRight && innerTop >= outerTop && innerBottom <= outerBottom;
};

/**
 * Filters observations to return only those that are contained within any of the provided rectangles.
 * Uses a tolerance-based approach to account for slight pixel misalignments.
 *
 * @param observations - Array of observations to filter
 * @param rectangles - Array of bounding boxes representing rectangles to check containment against
 * @param tolerance - Pixel tolerance for boundary checking (default: 5)
 * @returns Array of observations that are contained within any of the rectangles
 *
 * @example
 * ```typescript
 * const observations = [
 *   { text: "Sample text", bbox: { x: 240, y: 40, width: 480, height: 40 } }
 * ];
 * const rectangles = [
 *   { x: 104, y: 11, width: 740, height: 97 }
 * ];
 * const filtered = filterObservationsInsideRectangles(observations, rectangles);
 * ```
 */
export const filterObservationsInsideRectangles = (
    observations: Observation[],
    rectangles: BoundingBox[],
    tolerance: number = 5,
): Observation[] => {
    return observations.filter((observation) =>
        rectangles.some((rectangle) => isBoundingBoxContained(observation.bbox, rectangle, tolerance)),
    );
};
