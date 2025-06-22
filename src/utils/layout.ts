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

export const getLastHorizontalLineY = (
    rectangles: BoundingBox[],
    horizontalLines: BoundingBox[],
    pixelTolerance = 5,
) => {
    if (rectangles.length > 0 && horizontalLines.length > 0) {
        horizontalLines = filterHorizontalLinesOutsideRectangles(rectangles, horizontalLines, pixelTolerance);
    }

    return horizontalLines.at(-1)?.y;
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

/**
 * Converts bounding box coordinates from array format to object format.
 * Transforms [x1, y1, x2, y2] coordinates to {x, y, width, height} format.
 *
 * @param box - Array containing [x1, y1, x2, y2] coordinates
 * @returns Bounding box object with x, y, width, and height properties
 */
export const mapMatrixToBoundingBox = (box: [number, number, number, number]) => {
    const [x1, y1, x2, y2] = box;
    return { height: y2 - y1, width: x2 - x1, x: x1, y: y1 };
};

/**
 * Analyzes the typical line spacing in the document to determine
 * what constitutes a normal gap vs. an intra-line gap.
 *
 * @param sortedObservations - Array of observations sorted by y-coordinate
 * @returns Object containing typical gap size and minimum intra-line gap threshold
 */
export const analyzeLineSpacing = <T extends { bbox: { y: number } }>(
    sortedItems: T[],
): { minIntraLineGap: number; typicalGap: number } => {
    const len = sortedItems.length;
    if (len < 3) {
        return { minIntraLineGap: 0, typicalGap: 0 };
    }

    // Calculate gaps in a single pass
    const gaps: number[] = new Array(len - 1);
    for (let i = 1; i < len; i++) {
        gaps[i - 1] = sortedItems[i].bbox.y - sortedItems[i - 1].bbox.y;
    }

    // Sort gaps to find percentiles
    gaps.sort((a, b) => a - b);

    const medianIdx = Math.floor(gaps.length * 0.5);
    const p75Idx = Math.floor(gaps.length * 0.75);

    const medianGap = gaps[medianIdx];
    const typicalGap = gaps[p75Idx];
    const minIntraLineGap = Math.min(medianGap * 0.6, typicalGap * 0.4);

    return { minIntraLineGap, typicalGap };
};

/**
 * Computes an adaptive line height factor based on item heights and spacing patterns.
 *
 * @param items - Array of heights from bbox properties
 * @param typicalGap - Typical vertical gap between lines in the document
 * @returns Adaptive line height factor (0.15-0.4)
 */
export const computeAdaptiveLineHeightFactor = (heights: number[], typicalGap: number): number => {
    if (heights.length === 0) {
        return 0.3;
    }

    // Calculate average height in a single pass
    let totalHeight = 0;

    for (const height of heights) {
        totalHeight += height;
    }

    const avgHeight = totalHeight / heights.length;

    // Determine factor based on gap-to-height ratio
    const gapToHeightRatio = typicalGap / avgHeight;

    if (gapToHeightRatio < 0.8) return 0.15; // Small gaps - likely intra-line groupings
    if (gapToHeightRatio < 1.2) return 0.25; // Medium gaps

    return 0.4; // Large gaps - mostly separate lines
};
