import type { BoundingBox, CenteringOptions, Observation } from '@/types';

/**
 * Determines if an observation is centered on the page with sufficient whitespace around it.
 *
 * An observation is considered centered if:
 * 1. Its center point is within tolerance of the page center
 * 2. It has sufficient margins (whitespace) on both left and right sides
 *
 * This prevents false positives where wide observations span most of the page
 * but happen to have their center point near the page center.
 *
 * @param observation - The observation to check for centering
 * @param imageWidth - The total width of the page/image in pixels
 * @param options - Configuration options for centering criteria
 * @param options.centerToleranceRatio - The tolerance for center point alignment as a ratio of image width (default: 0.05 = 5%)
 * @param options.minMarginRatio - The minimum margin required on each side as a ratio of image width (default: 0.1 = 10%)
 * @returns True if the observation is centered with sufficient whitespace, false otherwise
 *
 * @example
 * ```typescript
 * // Using default options
 * isObservationCentered({ bbox: { width: 286, x: 298 } }, 960, { centerToleranceRatio: 0.05, minMarginRatio: 0.1 }) // true
 *
 * // Using custom options for stricter centering
 * isObservationCentered(
 *   { bbox: { width: 286, x: 298 } },
 *   960,
 *   { centerToleranceRatio: 0.02, minMarginRatio: 0.15 }
 * )
 *
 * // A wide observation spanning most of the page - should return false
 * isObservationCentered({ bbox: { width: 2026, x: 232 } }, 2481, { centerToleranceRatio: 0.05, minMarginRatio: 0.1 }) // false
 * ```
 */
export const isObservationCentered = (bbox: BoundingBox, imageWidth: number, options: CenteringOptions) => {
    const pageCenter = imageWidth / 2;
    const tolPx = imageWidth * options.centerToleranceRatio;
    const centerX = bbox.x + bbox.width / 2;

    // Check if the center point is near the page center
    const isCenterPointCentered = Math.abs(centerX - pageCenter) <= tolPx;

    // Check if there's sufficient whitespace on both sides
    // An observation should have meaningful margins to be considered "centered"
    const leftMargin = bbox.x;
    const rightMargin = imageWidth - (bbox.x + bbox.width);
    const minMargin = imageWidth * options.minMarginRatio;

    const hasSufficientMargins = leftMargin >= minMargin && rightMargin >= minMargin;

    return isCenterPointCentered && hasSufficientMargins;
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
    tolerance = 5,
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
 * @param tolerance - The pixel tolerance for boundary checking
 * @returns True if the inner bounding box is contained within the outer bounding box
 */
export const isBoundingBoxContained = (inner: BoundingBox, outer: BoundingBox, tolerance: number): boolean => {
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

/**
 * Check if two observations are close enough vertically to be considered a poetry pair
 */
export const areObservationsVerticallyAligned = (
    obs1: Observation,
    obs2: Observation,
    maxVerticalGapRatio = 2,
): boolean => {
    const avgHeight = (obs1.bbox.height + obs2.bbox.height) / 2;
    const verticalGap = Math.abs(obs1.bbox.y - obs2.bbox.y);
    const maxAllowedGap = avgHeight * maxVerticalGapRatio;

    return verticalGap <= maxAllowedGap;
};
