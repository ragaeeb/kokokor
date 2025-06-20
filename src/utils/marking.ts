import type { IndexedObservation, Observation, Size } from '@/types';

import { PTS_TO_INCHES } from './constants';

/**
 * Analyzes the typical line spacing in the document to determine
 * what constitutes a normal gap vs. an intra-line gap.
 *
 * @param sortedObservations - Array of observations sorted by y-coordinate
 * @returns Object containing typical gap size and minimum intra-line gap threshold
 */
const analyzeLineSpacing = (sortedObservations: Observation[]): { minIntraLineGap: number; typicalGap: number } => {
    const len = sortedObservations.length;
    if (len < 3) {
        return { minIntraLineGap: 0, typicalGap: 0 };
    }

    // Calculate gaps in a single pass
    const gaps: number[] = new Array(len - 1);
    for (let i = 1; i < len; i++) {
        gaps[i - 1] = sortedObservations[i].bbox.y - sortedObservations[i - 1].bbox.y;
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
 * Computes an adaptive line height factor based on observation heights and spacing patterns.
 *
 * @param observations - Array of OCR observations
 * @param typicalGap - Typical vertical gap between lines in the document
 * @returns Adaptive line height factor (0.15-0.4)
 */
const computeAdaptiveLineHeightFactor = (observations: Observation[], typicalGap: number): number => {
    if (observations.length === 0) return 0.3;

    // Calculate average height in a single pass
    let totalHeight = 0;
    for (let i = 0; i < observations.length; i++) {
        totalHeight += observations[i].bbox.height;
    }
    const avgHeight = totalHeight / observations.length;

    // Determine factor based on gap-to-height ratio
    const gapToHeightRatio = typicalGap / avgHeight;

    if (gapToHeightRatio < 0.8) return 0.15; // Small gaps - likely intra-line groupings
    if (gapToHeightRatio < 1.2) return 0.25; // Medium gaps
    return 0.4; // Large gaps - mostly separate lines
};

/**
 * Determines if two consecutive observations should be placed on separate lines.
 *
 * @param prev - Previous observation
 * @param current - Current observation
 * @param effectiveFactor - Line height factor to use
 * @param effectiveYTolerance - DPI-adjusted vertical tolerance
 * @param spacingAnalysis - Document spacing analysis results
 * @returns True if observations should be on separate lines
 */
const shouldSeparateLines = (
    prev: Observation,
    current: Observation,
    effectiveFactor: number,
    effectiveYTolerance: number,
    spacingAnalysis: { minIntraLineGap: number; typicalGap: number },
): boolean => {
    const dy = current.bbox.y - prev.bbox.y;

    // Primary threshold based on average height
    const avgHeight = (prev.bbox.height + current.bbox.height) * 0.5;
    const baseThresh = avgHeight * effectiveFactor;
    const threshold = baseThresh + effectiveYTolerance;

    let shouldSeparate = dy > threshold;

    // Secondary check based on document spacing patterns
    if (!shouldSeparate && spacingAnalysis.minIntraLineGap > 0 && dy > spacingAnalysis.minIntraLineGap) {
        const conservativeThreshold = Math.min(avgHeight * 0.2, spacingAnalysis.minIntraLineGap);
        shouldSeparate = dy > conservativeThreshold;
    }

    return shouldSeparate;
};

/**
 * Processes the sorted observations and assigns line indices.
 *
 * @param sortedObservations - Array of observations sorted by y-coordinate
 * @param effectiveFactor - Line height factor to use
 * @param effectiveYTolerance - DPI-adjusted vertical tolerance
 * @param spacingAnalysis - Document spacing analysis results
 * @returns Array of observations with line index assignments
 */
const assignLineIndices = (
    sortedObservations: Observation[],
    effectiveFactor: number,
    effectiveYTolerance: number,
    spacingAnalysis: { minIntraLineGap: number; typicalGap: number },
): IndexedObservation[] => {
    const len = sortedObservations.length;
    const marked: IndexedObservation[] = new Array(len);

    let currentLine = 0;
    let prev = sortedObservations[0];
    marked[0] = { ...prev, index: currentLine };

    for (let i = 1; i < len; i++) {
        const obs = sortedObservations[i];

        if (shouldSeparateLines(prev, obs, effectiveFactor, effectiveYTolerance, spacingAnalysis)) {
            currentLine += 1;
        }

        marked[i] = { ...obs, index: currentLine };
        prev = obs;
    }

    return marked;
};

/**
 * Groups observations into lines based on vertical proximity.
 *
 * This function sorts observations by y-coordinate and then groups them into lines
 * based on their vertical proximity. The algorithm uses adaptive thresholds that
 * analyze the document's spacing patterns to distinguish between separate lines
 * and text elements that belong on the same line.
 *
 * Two observations are considered to be on the same line if the vertical distance
 * between them is less than a dynamically computed threshold based on:
 * - Average height of the observations
 * - Adaptive line height factor (computed from document patterns)
 * - DPI-adjusted pixel tolerance
 * - Document-wide spacing analysis
 *
 * @param observations - Array of OCR observations to be grouped into lines
 * @param dpi - Document DPI (dots per inch), used to scale tolerance values appropriately
 * @param pixelTolerance - Additional vertical tolerance in pixels at 72 DPI
 * @param lineHeightFactor - Optional fixed line height factor. If not provided, will be computed adaptively
 * @returns Array of observations with index properties indicating their line assignments, sorted by line then y-coordinate
 */
export const indexObservationsAsLines = (
    observations: Observation[],
    dpi: number,
    pixelTolerance: number,
    lineHeightFactor?: number,
): IndexedObservation[] => {
    // Sort observations by y-coordinate
    const byY = observations.toSorted((a, b) => a.bbox.y - b.bbox.y);
    const effectiveYTolerance = pixelTolerance * (dpi / PTS_TO_INCHES);

    // Determine line height factor and spacing analysis
    let effectiveFactor: number;
    let spacingAnalysis: { minIntraLineGap: number; typicalGap: number };

    if (lineHeightFactor) {
        effectiveFactor = lineHeightFactor;
        spacingAnalysis = { minIntraLineGap: 0, typicalGap: 0 }; // Skip analysis if factor provided
    } else {
        spacingAnalysis = analyzeLineSpacing(byY);
        effectiveFactor = computeAdaptiveLineHeightFactor(observations, spacingAnalysis.typicalGap);
    }

    // Assign line indices
    const marked = assignLineIndices(byY, effectiveFactor, effectiveYTolerance, spacingAnalysis);

    // Sort by line index, then by y-coordinate
    return marked.toSorted((a, b) => (a.index !== b.index ? a.index - b.index : a.bbox.y - b.bbox.y));
};

/**
 * Utility function to calculate the DPI based on the image size and original PDF size.
 * @param imageSize The size of the image.
 * @param pdfSize The size of the PDF the image was exported from.
 * @returns The x and y DPI values.
 */
export const calculateDPI = (imageSize: Size, pdfSize: Size) => {
    const x = imageSize.width / (pdfSize.width / PTS_TO_INCHES);
    const y = imageSize.height / (pdfSize.height / PTS_TO_INCHES);

    return { x, y };
};

/**
 * Groups observations into paragraphs based on vertical spacing and line width.
 *
 * This function analyzes the pattern of vertical spacing between observations and their widths
 * to identify paragraph breaks. A new paragraph is created when:
 * 1. There's a significant increase in vertical gap compared to previous gaps, or
 * 2. An observation's width is significantly less than the maximum width (indicating a short line)
 *
 * @param observations - Array of OCR observations (typically lines) to be grouped into paragraphs
 * @param verticalJumpFactor - Factor determining how much larger a gap needs to be to indicate a paragraph break
 * @param widthTolerance - Fraction of maximum width below which a line is considered "short" (0-1)
 * @returns Array of observations with index properties indicating their paragraph assignments
 */
export const indexObservationsAsParagraphs = (
    observations: Observation[],
    verticalJumpFactor: number,
    widthTolerance: number,
): IndexedObservation[] => {
    if (observations.length === 0) {
        return [];
    }
    // 1) compute width threshold
    const maxWidth = Math.max(...observations.map((o) => o.bbox.width));
    const thresholdWidth = maxWidth * widthTolerance;

    const out: IndexedObservation[] = [];
    let index = 0;

    for (let i = 0; i < observations.length; i++) {
        const o = observations[i];

        // a) only apply vertical‐jump if *both* of the two preceding lines
        //    were “full” (not short).  This prevents double‐counting at the
        //    body→footer cut.
        if (i > 1) {
            const prev = observations[i - 1];
            const prevPrev = observations[i - 2];
            if (prev.bbox.width >= thresholdWidth && prevPrev.bbox.width >= thresholdWidth) {
                const gap = o.bbox.y - prev.bbox.y;
                const prevGap = prev.bbox.y - prevPrev.bbox.y;
                // Ensure prevGap is not zero to avoid division by zero or infinite jumpFactor sensitivity
                if (prevGap > 0 && gap > prevGap * verticalJumpFactor) {
                    index++;
                } else if (prevGap === 0 && gap > 0) {
                    // If previous gap was zero (overlapping lines), consider it a paragraph break
                    // if the current gap is significant compared to line height
                    if (gap > o.bbox.height * 0.5 * verticalJumpFactor) {
                        index++;
                    }
                }
            }
        } else if (i === 1) {
            const prev = observations[i - 1]; // This is observations[0]
            // Only consider a vertical jump if the FIRST line was full-width.
            // If the first line was short, its shortness already incremented 'index' for the current line.
            if (prev.bbox.width >= thresholdWidth) {
                const gap = o.bbox.y - prev.bbox.y;
                if (gap > prev.bbox.height * verticalJumpFactor) {
                    index++;
                }
            }
        }

        // tag
        out.push({ ...o, index });

        // b) short‐width break for the *next* line
        if (o.bbox.width < thresholdWidth) {
            index++;
        }
    }

    // stable sort by index then y
    return out.sort((a, b) => (a.index !== b.index ? a.index - b.index : a.bbox.y - b.bbox.y));
};

/**
 * Ensures that the set of `index` values on your observations
 * forms a contiguous 0…N sequence with no gaps.
 * Throws an Error if it finds any missing index.
 */
export function assertIndicesContinuous<T extends { index: number }>(marked: T[]): void {
    // collect the unique indices, sorted
    const unique = Array.from(new Set(marked.map((o) => o.index))).sort((a, b) => a - b);

    if (unique.length === 0) return;

    // must start at zero
    if (unique[0] !== 0) {
        throw new Error(`Paragraph indices must start at 0, but first index is ${unique[0]}`);
    }

    // check for gaps
    for (let i = 0; i < unique.length; i++) {
        if (unique[i] !== i) {
            throw new Error(
                `Paragraph index gap: expected index ${i} but got ${unique[i]}. ` +
                    `Full index list: [${unique.join(', ')}]`,
            );
        }
    }
}
