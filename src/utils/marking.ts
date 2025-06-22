import type { BoundingBox, Size } from '@/types';

import { PTS_TO_INCHES } from './constants';
import { analyzeLineSpacing, computeAdaptiveLineHeightFactor } from './layout';

/**
 * Determines if two consecutive items should be placed on separate lines.
 *
 * @param prev - Previous item
 * @param current - Current item
 * @param effectiveFactor - Line height factor to use
 * @param effectiveYTolerance - DPI-adjusted vertical tolerance
 * @param spacingAnalysis - Document spacing analysis results
 * @returns True if items should be on separate lines
 */
const shouldSeparateLines = <T extends { bbox: BoundingBox }>(
    prev: T,
    current: T,
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
 * Processes the sorted items and assigns line indices.
 *
 * @param sortedItems - Array of items sorted by y-coordinate
 * @param effectiveFactor - Line height factor to use
 * @param effectiveYTolerance - DPI-adjusted vertical tolerance
 * @param spacingAnalysis - Document spacing analysis results
 * @returns Array of items with line index assignments
 */
const assignLineIndices = <T extends { bbox: BoundingBox }>(
    sortedItems: T[],
    effectiveFactor: number,
    effectiveYTolerance: number,
    spacingAnalysis: { minIntraLineGap: number; typicalGap: number },
): (T & { index: number })[] => {
    const len = sortedItems.length;
    const marked: (T & { index: number })[] = new Array(len);

    let currentLine = 0;
    let prev = sortedItems[0];
    marked[0] = { ...prev, index: currentLine };

    for (let i = 1; i < len; i++) {
        const item = sortedItems[i];

        if (shouldSeparateLines(prev, item, effectiveFactor, effectiveYTolerance, spacingAnalysis)) {
            currentLine += 1;
        }

        marked[i] = { ...item, index: currentLine };
        prev = item;
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
export const indexItemsAsLines = <T extends { bbox: BoundingBox }>(
    items: T[],
    dpi: number,
    pixelTolerance: number,
    lineHeightFactor?: number,
): (T & { index: number })[] => {
    // Sort items by y-coordinate
    const byY = items.toSorted((a, b) => a.bbox.y - b.bbox.y);
    const effectiveYTolerance = pixelTolerance * (dpi / PTS_TO_INCHES);

    // Determine line height factor and spacing analysis
    const spacingAnalysis = lineHeightFactor ? { minIntraLineGap: 0, typicalGap: 0 } : analyzeLineSpacing(byY); // Skip analysis if factor provided
    const effectiveFactor =
        lineHeightFactor ||
        computeAdaptiveLineHeightFactor(
            items.map((i) => i.bbox.height),
            spacingAnalysis.typicalGap,
        );

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
export const indexItemsAsParagraphs = <T extends { bbox: BoundingBox }>(
    items: T[],
    verticalJumpFactor: number,
    widthTolerance: number,
): (T & { index: number })[] => {
    if (items.length === 0) {
        return [];
    }
    // 1) compute width threshold
    const maxWidth = Math.max(...items.map((item) => item.bbox.width));
    const thresholdWidth = maxWidth * widthTolerance;

    const out: (T & { index: number })[] = [];
    let index = 0;

    for (let i = 0; i < items.length; i++) {
        const item = items[i];

        // a) only apply vertical‐jump if *both* of the two preceding lines
        //    were "full" (not short).  This prevents double‐counting at the
        //    body→footer cut.
        if (i > 1) {
            const prev = items[i - 1];
            const prevPrev = items[i - 2];
            if (prev.bbox.width >= thresholdWidth && prevPrev.bbox.width >= thresholdWidth) {
                const gap = item.bbox.y - prev.bbox.y;
                const prevGap = prev.bbox.y - prevPrev.bbox.y;
                // Ensure prevGap is not zero to avoid division by zero or infinite jumpFactor sensitivity
                if (prevGap > 0 && gap > prevGap * verticalJumpFactor) {
                    index++;
                } else if (prevGap === 0 && gap > 0) {
                    // If previous gap was zero (overlapping lines), consider it a paragraph break
                    // if the current gap is significant compared to line height
                    if (gap > item.bbox.height * 0.5 * verticalJumpFactor) {
                        index++;
                    }
                }
            }
        } else if (i === 1) {
            const prev = items[i - 1]; // This is items[0]
            // Only consider a vertical jump if the FIRST line was full-width.
            // If the first line was short, its shortness already incremented 'index' for the current line.
            if (prev.bbox.width >= thresholdWidth) {
                const gap = item.bbox.y - prev.bbox.y;
                if (gap > prev.bbox.height * verticalJumpFactor) {
                    index++;
                }
            }
        }

        // tag
        out.push({ ...item, index });

        // b) short‐width break for the *next* line
        if (item.bbox.width < thresholdWidth) {
            index++;
        }
    }

    // stable sort by index then y
    return out.sort((a, b) => (a.index !== b.index ? a.index - b.index : a.bbox.y - b.bbox.y));
};
