import type { BoundingBox, Size } from '@/types';

import {
    PARAGRAPH_BASELINE_PERCENTILE,
    PARAGRAPH_INDENT_THRESHOLD_RATIO,
    PARAGRAPH_MIN_INDENT_CANDIDATE_WIDTH_RATIO,
    PARAGRAPH_MIN_INDENT_PX,
    PARAGRAPH_WIDTH_PERCENTILE,
    PTS_TO_INCHES,
} from './constants';
import { analyzeLineSpacing, computeAdaptiveLineHeightFactor } from './layout';

const LIST_START_MIN_CANDIDATES = 3;
const LIST_START_GAP_HEIGHT_FACTOR = 0.9;
const LIST_START_INDENT_THRESHOLD_RATIO = 0.03;
const LIST_START_BASELINE_PERCENTILE = 0.1;
const LIST_START_MIN_SHORT_INDENTED_LINES = 2;

/**
 * Determines if two consecutive items should be placed on separate lines based on spacing analysis.
 *
 * This function uses multiple criteria to determine line breaks:
 * - Primary threshold based on average height and line height factor
 * - Secondary check using document-wide spacing patterns
 * - DPI-adjusted tolerance for consistent behavior across different resolutions
 *
 * @template T - Type extending an object with a bounding box
 * @param prev - Previous item in the sequence
 * @param current - Current item being evaluated
 * @param effectiveFactor - Line height factor multiplier for threshold calculation
 * @param effectiveYTolerance - DPI-adjusted vertical tolerance in pixels
 * @param spacingAnalysis - Document spacing analysis containing gap measurements
 * @returns True if items should be placed on separate lines, false otherwise
 */
const shouldSeparateLines = <T extends { bbox: BoundingBox }>(
    prev: T,
    current: T,
    effectiveFactor: number,
    effectiveYTolerance: number,
    spacingAnalysis: { minIntraLineGap: number; typicalGap: number },
) => {
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
 * Processes sorted items and assigns line indices based on vertical spacing.
 *
 * This function iterates through vertically sorted items and assigns line numbers
 * based on spacing analysis. Items that are close enough vertically are assigned
 * to the same line, while items with significant vertical gaps start new lines.
 *
 * @template T - Type extending an object with a bounding box
 * @param sortedItems - Array of items sorted by y-coordinate (top to bottom)
 * @param effectiveFactor - Line height factor to use for threshold calculations
 * @param effectiveYTolerance - DPI-adjusted vertical tolerance in pixels
 * @param spacingAnalysis - Document spacing analysis results
 * @returns Array of items with assigned line index properties
 */
const assignLineIndices = <T extends { bbox: BoundingBox }>(
    sortedItems: T[],
    effectiveFactor: number,
    effectiveYTolerance: number,
    spacingAnalysis: { minIntraLineGap: number; typicalGap: number },
) => {
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
 * Groups items into lines based on vertical proximity and document spacing patterns.
 *
 * This function implements an adaptive line detection algorithm that analyzes the document's
 * spacing patterns to distinguish between separate lines and text elements that belong on
 * the same line. The algorithm:
 *
 * 1. Sorts items by y-coordinate (top to bottom)
 * 2. Analyzes document-wide spacing patterns (unless lineHeightFactor is provided)
 * 3. Computes adaptive thresholds based on item heights and spacing analysis
 * 4. Assigns line indices based on vertical proximity
 * 5. Returns items sorted by line index, then by y-coordinate
 *
 * Two items are considered to be on the same line if the vertical distance between them
 * is less than a dynamically computed threshold based on:
 * - Average height of the items
 * - Adaptive line height factor (computed from document patterns or provided)
 * - DPI-adjusted pixel tolerance
 * - Document-wide spacing analysis
 *
 * @template T - Type extending an object with a bounding box
 * @param items - Array of items to be grouped into lines
 * @param dpi - Document DPI (dots per inch) for scaling tolerance values appropriately
 * @param pixelTolerance - Additional vertical tolerance in pixels at 72 DPI
 * @param lineHeightFactor - Optional fixed line height factor. If not provided, computed adaptively from document patterns
 * @returns Array of items with index properties indicating line assignments, sorted by line then y-coordinate
 *
 * @example
 * ```typescript
 * const observations = [
 *   { bbox: { x: 0, y: 0, width: 100, height: 20 }, text: "First line" },
 *   { bbox: { x: 0, y: 25, width: 100, height: 20 }, text: "Second line" }
 * ];
 * const lines = indexItemsAsLines(observations, 300, 5);
 * // Result: Items with index: 0 for first line, index: 1 for second line
 * ```
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
 * Calculates the DPI (dots per inch) based on image dimensions and original PDF size.
 *
 * This utility function helps determine the resolution at which a PDF was rasterized
 * by comparing the resulting image dimensions with the original PDF page dimensions.
 * The DPI values are essential for proper scaling of pixel-based tolerances and
 * measurements throughout the document processing pipeline.
 *
 * @param imageSize - Dimensions of the rasterized image in pixels
 * @param pdfSize - Original dimensions of the PDF page in points (1/72 inch)
 * @returns Object containing x and y DPI values
 *
 * @example
 * ```typescript
 * const imageSize = { width: 2480, height: 3508 };
 * const pdfSize = { width: 595, height: 842 }; // A4 page in points
 * const dpi = calculateDPI(imageSize, pdfSize);
 * // Result: { x: 300, y: 300 } for a 300 DPI scan
 * ```
 */
export const calculateDPI = (imageSize: Size, pdfSize: Size) => {
    const x = imageSize.width / (pdfSize.width / PTS_TO_INCHES);
    const y = imageSize.height / (pdfSize.height / PTS_TO_INCHES);

    return { x, y };
};

/**
 * Returns a percentile value from a sorted numeric array.
 */
const pickPercentile = (sortedValues: number[], percentile: number) => {
    const index = Math.min(
        sortedValues.length - 1,
        Math.max(0, Math.floor((sortedValues.length - 1) * percentile)),
    );
    return sortedValues[index];
};

/**
 * Returns true when line start is indented relative to baseline.
 */
const isIndentedLine = <T extends { bbox: BoundingBox }>(item: T, baselineX: number, indentThreshold: number) =>
    item.bbox.x - baselineX > indentThreshold;

/**
 * Returns true when a list-start candidate line is near the start baseline and sufficiently wide.
 */
const isListStartCandidate = <T extends { bbox: BoundingBox }>(
    item: T,
    baselineX: number,
    indentThreshold: number,
    minWidth: number,
) => !isIndentedLine(item, baselineX, indentThreshold) && item.bbox.width >= minWidth;

/**
 * Groups items into paragraphs based on vertical spacing patterns and line width analysis.
 *
 * This function analyzes vertical spacing between consecutive items and their widths to
 * identify paragraph boundaries. The algorithm uses two main heuristics:
 *
 * 1. **Vertical jump detection**: A new paragraph starts when there's a significant
 *    increase in vertical gap compared to previous gaps, but only when both preceding
 *    lines are "full-width" (not short lines that might indicate natural breaks)
 *
 * 2. **Short line detection**: Lines significantly narrower than a robust reference width
 *    are considered paragraph-ending lines, causing the next line to start a new paragraph
 *
 * These heuristics work together to handle various paragraph patterns including:
 * - Standard paragraphs with consistent spacing
 * - Paragraphs ending with short lines
 * - Headers and subheadings with extra spacing
 * - Footer content separated by spacing
 *
 * @template T - Type extending an object with a bounding box
 * @param items - Array of items (typically lines) to be grouped into paragraphs
 * @param verticalJumpFactor - Multiplier determining how much larger a gap needs to be to indicate a paragraph break (e.g., 2.0 means 200% larger)
 * @param widthTolerance - Fraction of reference width below which a line is considered "short" (0-1, e.g., 0.8 means 80% of reference width)
 * @returns Array of items with index properties indicating paragraph assignments, sorted by paragraph then y-coordinate
 *
 * @example
 * ```typescript
 * const lines = [
 *   { bbox: { y: 0, width: 400, height: 20 }, text: "First paragraph line" },
 *   { bbox: { y: 25, width: 300, height: 20 }, text: "Short line ending" }, // Short line
 *   { bbox: { y: 55, width: 400, height: 20 }, text: "Second paragraph" }   // Gap + new para
 * ];
 * const paragraphs = indexItemsAsParagraphs(lines, 2.0, 0.8);
 * // Result: First two lines index: 0, third line index: 1
 * ```
 */
export const indexItemsAsParagraphs = <T extends { bbox: BoundingBox }>(
    items: T[],
    verticalJumpFactor: number,
    widthTolerance: number,
): (T & { index: number })[] => {
    if (items.length === 0) {
        return [];
    }

    // 1) Compute width threshold from a robust reference width instead of a single max outlier.
    const widths = items.map((item) => item.bbox.width).toSorted((a, b) => a - b);
    const referenceWidth =
        widths.length >= 4 ? pickPercentile(widths, PARAGRAPH_WIDTH_PERCENTILE) : widths[widths.length - 1];
    const thresholdWidth = referenceWidth * widthTolerance;

    // 2) Build a right-edge baseline from sufficiently wide lines, then use a low percentile
    // to reduce sensitivity to occasional x outliers.
    const minIndentCandidateWidth = thresholdWidth * PARAGRAPH_MIN_INDENT_CANDIDATE_WIDTH_RATIO;
    const baselineCandidates = items
        .filter((item) => item.bbox.width >= minIndentCandidateWidth)
        .map((item) => item.bbox.x)
        .toSorted((a, b) => a - b);
    const allX = items.map((item) => item.bbox.x).toSorted((a, b) => a - b);
    const xValues = baselineCandidates.length > 0 ? baselineCandidates : allX;
    const baselineX = pickPercentile(xValues, PARAGRAPH_BASELINE_PERCENTILE);

    // 3) Keep a small floor so low-resolution pages don't treat jitter as indentation.
    const indentThreshold = Math.max(referenceWidth * PARAGRAPH_INDENT_THRESHOLD_RATIO, PARAGRAPH_MIN_INDENT_PX);
    const listStartBaselineX = pickPercentile(allX, LIST_START_BASELINE_PERCENTILE);
    const listStartIndentThreshold = Math.max(
        referenceWidth * LIST_START_INDENT_THRESHOLD_RATIO,
        PARAGRAPH_MIN_INDENT_PX,
    );
    const listStartCandidateCount = items.filter((item) =>
        isListStartCandidate(item, listStartBaselineX, listStartIndentThreshold, minIndentCandidateWidth),
    ).length;
    const shortIndentedLineCount = items.filter(
        (item) =>
            item.bbox.width < minIndentCandidateWidth &&
            isIndentedLine(item, listStartBaselineX, listStartIndentThreshold),
    ).length;
    const hasListBridge = items.some((item, i) => {
        if (i === 0 || i === items.length - 1) {
            return false;
        }

        const prev = items[i - 1];
        const next = items[i + 1];
        const isShortIndentedContinuation =
            item.bbox.width < minIndentCandidateWidth &&
            isIndentedLine(item, listStartBaselineX, listStartIndentThreshold);

        return (
            isShortIndentedContinuation &&
            isListStartCandidate(prev, listStartBaselineX, listStartIndentThreshold, minIndentCandidateWidth) &&
            isListStartCandidate(next, listStartBaselineX, listStartIndentThreshold, minIndentCandidateWidth)
        );
    });
    const shouldUseListStartSignal =
        listStartCandidateCount >= LIST_START_MIN_CANDIDATES &&
        shortIndentedLineCount >= LIST_START_MIN_SHORT_INDENTED_LINES &&
        hasListBridge;

    const out: (T & { index: number })[] = [];
    let index = 0;

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        let shouldBreakBeforeCurrent = false;
        let breakReason: 'indent' | 'list-start' | 'vertical' | null = null;

        // a) Vertical jump signal (for current line)
        if (i > 1) {
            const prev = items[i - 1];
            const prevPrev = items[i - 2];
            if (prev.bbox.width >= thresholdWidth && prevPrev.bbox.width >= thresholdWidth) {
                const gap = item.bbox.y - prev.bbox.y;
                const prevGap = prev.bbox.y - prevPrev.bbox.y;
                // Ensure prevGap is not zero to avoid division by zero or infinite jumpFactor sensitivity
                if (prevGap > 0 && gap > prevGap * verticalJumpFactor) {
                    shouldBreakBeforeCurrent = true;
                    breakReason = 'vertical';
                } else if (prevGap === 0 && gap > 0) {
                    // If previous gap was zero (overlapping lines), consider it a paragraph break
                    // if the current gap is significant compared to line height
                    if (gap > item.bbox.height * 0.5 * verticalJumpFactor) {
                        shouldBreakBeforeCurrent = true;
                        breakReason = 'vertical';
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
                    shouldBreakBeforeCurrent = true;
                    breakReason = 'vertical';
                }
            }
        }

        // b) Indent signal (for current line)
        if (!shouldBreakBeforeCurrent && i > 0) {
            const prev = items[i - 1];
            const isCurrentIndented = isIndentedLine(item, baselineX, indentThreshold);
            const wasPrevShort = prev.bbox.width < thresholdWidth;

            if (isCurrentIndented && !wasPrevShort && item.bbox.width >= minIndentCandidateWidth) {
                const wasPrevIndented = isIndentedLine(prev, baselineX, indentThreshold);
                if (!wasPrevIndented) {
                    shouldBreakBeforeCurrent = true;
                    breakReason = 'indent';
                }
            }
        }

        // c) List-start signal (for current line).
        // Use geometric starts: baseline-aligned + sufficiently wide, and only when we
        // detect repeated list-like structure with continuation lines in the same block.
        if (!shouldBreakBeforeCurrent && i > 0 && shouldUseListStartSignal) {
            const prev = items[i - 1];

            const isCurrentListStart = isListStartCandidate(
                item,
                listStartBaselineX,
                listStartIndentThreshold,
                minIndentCandidateWidth,
            );
            const isPrevListStart = isListStartCandidate(
                prev,
                listStartBaselineX,
                listStartIndentThreshold,
                minIndentCandidateWidth,
            );
            const wasPrevShort = prev.bbox.width < thresholdWidth;
            const gap = item.bbox.y - prev.bbox.y;
            const minGapForListStart = Math.min(prev.bbox.height, item.bbox.height) * LIST_START_GAP_HEIGHT_FACTOR;

            if (isCurrentListStart && isPrevListStart && !wasPrevShort && gap >= minGapForListStart) {
                shouldBreakBeforeCurrent = true;
                breakReason = 'list-start';
            }
        }

        if (shouldBreakBeforeCurrent) {
            index++;
        }

        // tag
        out.push({ ...item, index });

        // d) Short-width signal applies to the next line, except when this line
        // already started a paragraph due to indentation.
        if (item.bbox.width < thresholdWidth) {
            if (i === 0) {
                index++;
            } else {
                if (breakReason !== 'indent') {
                    index++;
                }
            }
        }
    }

    // stable sort by index then y
    return out.sort((a, b) => (a.index !== b.index ? a.index - b.index : a.bbox.y - b.bbox.y));
};
