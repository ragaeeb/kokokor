import type { BoundingBox, CenteringOptions, Observation } from '@/types';

const MIN_FOOTNOTE_SEPARATOR_Y_RATIO = 0.15;
const MIN_BODY_OBSERVATION_WIDTH_RATIO = 0.4;

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
 * @param bbox - The bounding box to check for centering
 * @param imageWidth - The total width of the page/image in pixels
 * @param options - Configuration options for centering criteria
 * @param options.centerToleranceRatio - The tolerance for center point alignment as a ratio of image width (default: 0.05 = 5%)
 * @param options.minMarginRatio - The minimum margin required on each side as a ratio of image width (default: 0.1 = 10%)
 * @returns True if the observation is centered with sufficient whitespace, false otherwise
 *
 * @example
 * ```typescript
 * // Using default options
 * isObservationCentered({ width: 286, x: 298 }, 960, { centerToleranceRatio: 0.05, minMarginRatio: 0.1 }) // true
 *
 * // Using custom options for stricter centering
 * isObservationCentered(
 *   { width: 286, x: 298 },
 *   960,
 *   { centerToleranceRatio: 0.02, minMarginRatio: 0.15 }
 * )
 *
 * // A wide observation spanning most of the page - should return false
 * isObservationCentered({ width: 2026, x: 232 }, 2481, { centerToleranceRatio: 0.05, minMarginRatio: 0.1 }) // false
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
 *
 * This is useful for removing header/footer lines that appear within document sections
 * while preserving lines that mark true document boundaries or section separators.
 *
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
 * Removes page-border artifacts that span nearly the entire page. These are
 * common on scans and should not behave like semantic text boxes.
 */
export const filterStructuralRectangles = (rectangles: BoundingBox[], page: { height: number; width: number }) =>
    rectangles.filter((rectangle) => rectangle.height < page.height * 0.9);

/**
 * Finds the y-coordinate of the last horizontal line that's not contained within any rectangle.
 *
 * Used to identify the footer boundary - text below this line is typically footnotes.
 * Filters out horizontal lines that are contained within rectangles before finding the last one.
 *
 * @param rectangles - Array of rectangles to exclude horizontal lines from
 * @param horizontalLines - Array of horizontal lines to consider
 * @param pixelTolerance - Pixel tolerance for containment checking (default: 5)
 * @returns Y-coordinate of the last qualifying horizontal line, or undefined if none found
 */
export const getLastHorizontalLineY = (
    rectangles: BoundingBox[],
    horizontalLines: BoundingBox[],
    pixelTolerance = 5,
) => {
    if (rectangles.length > 0 && horizontalLines.length > 0) {
        horizontalLines = filterHorizontalLinesOutsideRectangles(rectangles, horizontalLines, pixelTolerance);
    }

    horizontalLines = horizontalLines.filter((line) => line.y > pixelTolerance); // take out lines that are very close to the top-edge which are probably artifacts

    return horizontalLines.at(-1)?.y;
};

type FootnoteSeparatorContext = {
    observations: Observation[];
    observationsAreHorizontallyMirrored: boolean;
    pageHeight: number;
    pageWidth: number;
};

const getHorizontalOverlap = (first: BoundingBox, second: BoundingBox) =>
    Math.min(first.x + first.width, second.x + second.width) - Math.max(first.x, second.x);

const overlapsVertically = (
    first: BoundingBox,
    second: BoundingBox,
    pageWidth: number,
    observationsAreHorizontallyMirrored: boolean,
) => {
    const secondBottom = second.y + second.height;
    const firstCenterY = first.y + first.height / 2;
    if (firstCenterY <= second.y || firstCenterY >= secondBottom) {
        return false;
    }
    const relativePosition = (firstCenterY - second.y) / second.height;
    if (relativePosition >= 0.1 && relativePosition <= 0.9) {
        return true;
    }

    const horizontalOverlap = Math.max(
        getHorizontalOverlap(first, second),
        observationsAreHorizontallyMirrored
            ? getHorizontalOverlap(first, { ...second, x: pageWidth - (second.x + second.width) })
            : 0,
    );
    const isUnderlineNearObservationBottom =
        relativePosition > 0.9 &&
        relativePosition <= 0.95 &&
        first.width >= second.width * 0.5 &&
        horizontalOverlap >= first.width * 0.9;
    return (horizontalOverlap > 0 && second.width <= first.width * 0.4) || isUnderlineNearObservationBottom;
};

const areSimilarHorizontalRules = (first: BoundingBox, second: BoundingBox) => {
    const referenceWidth = Math.max(first.width, second.width);
    const horizontalTolerance = Math.max(12, referenceWidth * 0.08);
    return (
        Math.abs(first.x - second.x) <= horizontalTolerance &&
        Math.abs(first.width - second.width) <= horizontalTolerance
    );
};

const getObservationsBetweenRules = (first: BoundingBox, second: BoundingBox, observations: Observation[]) => {
    const upperRule = first.y <= second.y ? first : second;
    const lowerRule = first.y <= second.y ? second : first;
    const upperBottom = upperRule.y + upperRule.height;
    return observations.filter(
        (observation) =>
            observation.bbox.y >= upperBottom && observation.bbox.y + observation.bbox.height <= lowerRule.y,
    );
};

const isPairedDecoration = (
    candidate: BoundingBox,
    horizontalLines: BoundingBox[],
    context: FootnoteSeparatorContext,
) =>
    horizontalLines.some((other) => {
        if (other === candidate) {
            return false;
        }
        const separation = Math.abs(candidate.y - other.y);
        const isNearbyPair = separation <= context.pageHeight * 0.2;
        const isWideFrame = Math.min(candidate.width, other.width) >= context.pageWidth * 0.5;
        const observationsBetween = getObservationsBetweenRules(candidate, other, context.observations);
        if (observationsBetween.length === 0) {
            return false;
        }

        const isSimilarPair = areSimilarHorizontalRules(candidate, other);
        const onlyFramesNarrowCenteredText =
            isNearbyPair &&
            observationsBetween.every((observation) => observation.bbox.width <= context.pageWidth * 0.5) &&
            observationsBetween.some((observation) => {
                const centerX = observation.bbox.x + observation.bbox.width / 2;
                return Math.abs(centerX - context.pageWidth / 2) <= context.pageWidth * 0.1;
            });

        return (isSimilarPair && (isNearbyPair || isWideFrame)) || onlyFramesNarrowCenteredText;
    });

const countArabicLetters = (text: string) =>
    [...text.normalize('NFKC')].filter(
        (character) => /\p{Letter}/u.test(character) && /\p{Script=Arabic}/u.test(character),
    ).length;

/**
 * Detects a section-heading ornament made from two horizontal fragments with
 * short centered Arabic text in the gap. A single fragment can otherwise look
 * exactly like a high footnote rule when its partner is a few pixels lower.
 */
const isSplitTitleDecoration = (
    candidate: BoundingBox,
    horizontalLines: BoundingBox[],
    context: FootnoteSeparatorContext,
    pixelTolerance: number,
) =>
    horizontalLines.some((other) => {
        if (other === candidate) {
            return false;
        }

        const candidateCenterY = candidate.y + candidate.height / 2;
        const otherCenterY = other.y + other.height / 2;
        const rowTolerance = Math.max(pixelTolerance * 2, candidate.height * 2, other.height * 2);
        if (Math.abs(candidateCenterY - otherCenterY) > rowTolerance) {
            return false;
        }

        const [left, right] = candidate.x <= other.x ? [candidate, other] : [other, candidate];
        const gapStart = left.x + left.width;
        const gapEnd = right.x;
        const minimumFragmentWidth = context.pageWidth * 0.12;
        if (
            gapEnd <= gapStart ||
            left.width < minimumFragmentWidth ||
            right.width < minimumFragmentWidth ||
            left.x >= context.pageWidth / 2 ||
            right.x + right.width <= context.pageWidth / 2
        ) {
            return false;
        }

        const decorationCenterY = (candidateCenterY + otherCenterY) / 2;
        return context.observations.some((observation) => {
            const observationRight = observation.bbox.x + observation.bbox.width;
            const observationBottom = observation.bbox.y + observation.bbox.height;
            const observationCenterX = observation.bbox.x + observation.bbox.width / 2;
            const overlapsGap = Math.min(observationRight, gapEnd) > Math.max(observation.bbox.x, gapStart);
            const overlapsRuleRow =
                decorationCenterY >= observation.bbox.y - pixelTolerance &&
                decorationCenterY <= observationBottom + pixelTolerance;
            const isShortCenteredTitle =
                Math.abs(observationCenterX - context.pageWidth / 2) <= context.pageWidth * 0.12 &&
                observation.bbox.width <= context.pageWidth * 0.45 &&
                countArabicLetters(observation.text) >= 3;

            return overlapsGap && overlapsRuleRow && isShortCenteredTitle;
        });
    });

/**
 * Selects the lowest horizontal rule that plausibly separates body text from
 * footnotes. Decorative headers, rules crossing OCR text, and bottom-edge
 * artifacts are rejected using page and observation context.
 */
export const getFootnoteSeparatorY = (
    rectangles: BoundingBox[],
    horizontalLines: BoundingBox[],
    context: FootnoteSeparatorContext,
    pixelTolerance = 5,
) => {
    const outsideRectangles = filterHorizontalLinesOutsideRectangles(rectangles, horizontalLines, pixelTolerance);
    const minimumY = context.pageHeight * MIN_FOOTNOTE_SEPARATOR_Y_RATIO;
    const nonEdgeLines = outsideRectangles.filter((line) => line.y + line.height < context.pageHeight - pixelTolerance);
    const candidates = nonEdgeLines
        .filter((line) => line.y >= minimumY)
        .filter((line) => !isPairedDecoration(line, nonEdgeLines, context))
        .filter((line) => !isSplitTitleDecoration(line, nonEdgeLines, context, pixelTolerance))
        .filter(
            (line) =>
                !context.observations.some((observation) =>
                    overlapsVertically(
                        line,
                        observation.bbox,
                        context.pageWidth,
                        context.observationsAreHorizontallyMirrored,
                    ),
                ),
        )
        .filter((line) => {
            const lineCenterY = line.y + line.height / 2;
            const observationsAbove = context.observations.filter(
                (observation) => observation.bbox.y + observation.bbox.height / 2 < lineCenterY,
            );
            const headerUnderlineTolerance = pixelTolerance * 2;
            const contentWellAboveLine = observationsAbove.filter(
                (observation) => line.y - (observation.bbox.y + observation.bbox.height) > headerUnderlineTolerance,
            );
            const hasWideContentAboveLine = observationsAbove.some(
                (observation) =>
                    observation.bbox.y + observation.bbox.height <= line.y &&
                    observation.bbox.width >= context.pageWidth * MIN_BODY_OBSERVATION_WIDTH_RATIO,
            );
            const hasMultipleContentRowsAboveLine = contentWellAboveLine.some((observation, index) =>
                contentWellAboveLine.slice(index + 1).some((other) => {
                    const centerDistance = Math.abs(
                        observation.bbox.y + observation.bbox.height / 2 - (other.bbox.y + other.bbox.height / 2),
                    );
                    const rowTolerance = Math.max(
                        headerUnderlineTolerance,
                        Math.min(observation.bbox.height, other.bbox.height) * 0.5,
                    );
                    return centerDistance > rowTolerance;
                }),
            );
            const hasBodyContentWellAboveLine = hasWideContentAboveLine || hasMultipleContentRowsAboveLine;
            const hasObservationBelow = context.observations.some(
                (observation) => observation.bbox.y + observation.bbox.height / 2 > lineCenterY,
            );
            return observationsAbove.length >= 2 && hasBodyContentWellAboveLine && hasObservationBelow;
        })
        .toSorted((first, second) => first.y - second.y);

    return candidates.at(-1)?.y;
};

/**
 * Checks if a bounding box is contained within another bounding box with tolerance.
 *
 * The tolerance extends the outer bounding box in all directions, making containment
 * checking more lenient for cases where elements might be slightly outside due to
 * OCR inaccuracies or minor positioning variations.
 *
 * @param inner - The bounding box to check if it's inside
 * @param outer - The bounding box to check if it contains the inner box
 * @param tolerance - The pixel tolerance for boundary checking (extends outer box boundaries)
 * @returns True if the inner bounding box is contained within the outer bounding box (with tolerance)
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
 * Converts bounding box coordinates from array format to object format.
 * Transforms [x1, y1, x2, y2] coordinates to {x, y, width, height} format.
 *
 * @param box - Array containing [x1, y1, x2, y2] coordinates where (x1,y1) is top-left and (x2,y2) is bottom-right
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
 * This analysis helps distinguish between text that belongs on the same logical line
 * but was split by OCR, versus text that represents separate lines. The function
 * calculates percentiles of vertical gaps to establish thresholds.
 *
 * @param sortedItems - Array of observations sorted by y-coordinate (top to bottom)
 * @returns Object containing typical gap size and minimum intra-line gap threshold
 * @returns returns.typicalGap - The 75th percentile gap size, representing normal line spacing
 * @returns returns.minIntraLineGap - Threshold below which gaps are considered intra-line
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
 * The line height factor is used to determine how much vertical space to allow when
 * grouping text observations into lines. A smaller factor groups items more aggressively,
 * while a larger factor is more conservative about grouping.
 *
 * @param heights - Array of heights from bounding box properties
 * @param typicalGap - Typical vertical gap between lines in the document (from analyzeLineSpacing)
 * @returns Adaptive line height factor between 0.15 and 0.4
 *   - 0.15: Small gaps relative to text height (likely intra-line groupings)
 *   - 0.25: Medium gaps (standard line spacing)
 *   - 0.4: Large gaps (widely spaced separate lines)
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

    if (gapToHeightRatio < 0.8) {
        return 0.15; // Small gaps - likely intra-line groupings
    }
    if (gapToHeightRatio < 1.2) {
        return 0.25; // Medium gaps
    }

    return 0.4; // Large gaps - mostly separate lines
};
