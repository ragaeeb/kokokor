import type { BoundingBox, Size } from '@/types';

import {
    PARAGRAPH_BASELINE_PERCENTILE,
    PARAGRAPH_INDENT_THRESHOLD_RATIO,
    PARAGRAPH_MIN_INDENT_CANDIDATE_WIDTH_RATIO,
    PARAGRAPH_MIN_INDENT_HEIGHT_RATIO,
    PARAGRAPH_MIN_INDENT_PX,
    PARAGRAPH_WIDTH_PERCENTILE,
    PTS_TO_INCHES,
} from './constants';
import { analyzeLineSpacing, computeAdaptiveLineHeightFactor } from './layout';

/**
 * Minimum number of left-edge candidates required before list-start heuristics activate.
 */
const LIST_START_MIN_CANDIDATES = 3;

/**
 * Minimum relative vertical gap between consecutive list starts.
 */
const LIST_START_GAP_HEIGHT_FACTOR = 0.9;

/**
 * Smaller indentation threshold used for repeated list-start lines.
 */
const LIST_START_INDENT_THRESHOLD_RATIO = 0.03;

/**
 * Low percentile for detecting a stable left-edge baseline for list starts.
 */
const LIST_START_BASELINE_PERCENTILE = 0.1;

/**
 * Number of short indented continuation lines needed to confirm list topology.
 */
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
    const prevCenterY = prev.bbox.y + prev.bbox.height / 2;
    const currentCenterY = current.bbox.y + current.bbox.height / 2;
    const centerDistance = Math.abs(currentCenterY - prevCenterY);
    const minimumHeight = Math.min(prev.bbox.height, current.bbox.height);
    const maximumHeight = Math.max(prev.bbox.height, current.bbox.height);
    const prevRight = prev.bbox.x + prev.bbox.width;
    const currentRight = current.bbox.x + current.bbox.width;
    const horizontalGap = Math.max(current.bbox.x - prevRight, prev.bbox.x - currentRight, 0);
    const areSeparateColumns = horizontalGap > minimumHeight;

    // OCR engines often give the narrow numeric column of an index row a much
    // shorter box than the Arabic label. Compare against the taller box only
    // for horizontally separated columns. This joins the cell to its nearest
    // row without letting it bridge into the following row transitively.
    if ((areSeparateColumns && centerDistance <= maximumHeight * 0.85) || centerDistance <= minimumHeight * 0.5) {
        return false;
    }

    // Primary threshold based on average height
    const avgHeight = (prev.bbox.height + current.bbox.height) * 0.5;
    const baseThresh = avgHeight * effectiveFactor;
    const threshold = baseThresh + effectiveYTolerance;

    // Compare vertical centers for the general case. Top edges are unstable
    // when one OCR box contains tall diacritics or a compact citation cell;
    // center distance separates neighboring rows without letting those cells
    // bridge two rows transitively.
    let shouldSeparate = centerDistance > threshold;

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
    let lineAnchor = sortedItems[0];
    marked[0] = { ...lineAnchor, index: currentLine };

    for (let i = 1; i < len; i++) {
        const item = sortedItems[i];

        // Compare every candidate with the observation that opened the current
        // line. Pairwise chaining can otherwise let a compact index cell bridge
        // two neighboring rows when its box overlaps both of them.
        if (shouldSeparateLines(lineAnchor, item, effectiveFactor, effectiveYTolerance, spacingAnalysis)) {
            currentLine += 1;
            lineAnchor = item;
        }

        marked[i] = { ...item, index: currentLine };
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
    const index = Math.min(sortedValues.length - 1, Math.max(0, Math.floor((sortedValues.length - 1) * percentile)));
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

type BreakReason = 'indent' | 'list-start' | 'vertical' | null;

type ParagraphMetrics = {
    baselineX: number;
    indentThreshold: number;
    listStartBaselineX: number;
    listStartIndentThreshold: number;
    minIndentCandidateWidth: number;
    shouldUseListStartSignal: boolean;
    shouldUseRtlTableEntryStartSignal: boolean;
    shouldUseTableOfContentsSignal: boolean;
    thresholdWidth: number;
};

const TABLE_OF_CONTENTS_MIN_ENTRY_ENDS = 4;
const TABLE_OF_CONTENTS_MIN_LEADERS = 3;
const TABLE_OF_CONTENTS_DENSE_MIN_ENTRY_ENDS = 8;
const TABLE_OF_CONTENTS_DENSE_ENTRY_END_RATIO = 0.75;
const TABLE_OF_CONTENTS_LEADER_PATTERN = /\.{2,}/u;
const TABLE_OF_CONTENTS_PAGE_END_PATTERN = /[0-9٠-٩۰-۹][\s.)\]}»]*$/u;
const TABLE_OF_CONTENTS_ARABIC_ENTRY_START_PATTERN = /^\s*[0-9٠-٩۰-۹]{1,3}(?=\s|$)/u;
const TABLE_OF_CONTENTS_HADITH_HEADER_PATTERN = /أطراف\s+الصفحة/u;
const TABLE_OF_CONTENTS_ARABIC_HEADER_LABELS = ['الموضوع', 'الصفحة', 'الفائدة', 'الاسم', 'رقم'] as const;
const TABLE_OF_CONTENTS_NAMED_ENTRY_PATTERN = /^(?:مقدمة|الفصل|فصل|الخاتمة|الفهرس|فهرس)(?:\s|:|[.،])/u;

const hasTableOfContentsEntryEnd = <T extends { text?: string }>(item: T) =>
    TABLE_OF_CONTENTS_PAGE_END_PATTERN.test(item.text?.trim() ?? '');

const hasArabicTableHeader = <T extends { text?: string }>(item: T) => {
    const text = item.text ?? '';
    return TABLE_OF_CONTENTS_ARABIC_HEADER_LABELS.filter((label) => text.includes(label)).length >= 2;
};

const hasTableOfContentsHeader = <T extends { text?: string }>(item: T) =>
    hasArabicTableHeader(item) || TABLE_OF_CONTENTS_HADITH_HEADER_PATTERN.test(item.text ?? '');

const hasArabicTableEntryStart = <T extends { text?: string }>(item: T) =>
    TABLE_OF_CONTENTS_ARABIC_ENTRY_START_PATTERN.test(item.text?.trim() ?? '');

const hasNamedTableOfContentsEntryStart = <T extends { text?: string }>(item: T) =>
    TABLE_OF_CONTENTS_NAMED_ENTRY_PATTERN.test(item.text?.trim() ?? '');

const shouldUseRtlTableEntryStartSignal = <T extends { text?: string }>(items: T[]) =>
    items.some((item) => hasArabicTableHeader(item)) &&
    items.filter((item) => hasTableOfContentsEntryEnd(item)).length >= 2;

/**
 * Detects repeated leader-plus-page-number topology before applying entry-end
 * paragraph breaks. Requiring several examples avoids treating isolated prose
 * citations as contents rows.
 */
const shouldUseTableOfContentsSignal = <T extends { text?: string }>(items: T[]) => {
    let entryEndCount = 0;
    let leaderCount = 0;
    for (const item of items) {
        if (hasTableOfContentsEntryEnd(item)) {
            entryEndCount++;
        }
        if (TABLE_OF_CONTENTS_LEADER_PATTERN.test(item.text ?? '')) {
            leaderCount++;
        }
    }
    const hasLeaderTopology =
        entryEndCount >= TABLE_OF_CONTENTS_MIN_ENTRY_ENDS && leaderCount >= TABLE_OF_CONTENTS_MIN_LEADERS;
    const hasDenseNumericColumnTopology =
        entryEndCount >= TABLE_OF_CONTENTS_DENSE_MIN_ENTRY_ENDS &&
        entryEndCount / items.length >= TABLE_OF_CONTENTS_DENSE_ENTRY_END_RATIO;
    const hasArabicTableTopology = shouldUseRtlTableEntryStartSignal(items);
    const hasNamedEntryTopology =
        entryEndCount >= 3 && items.filter((item) => hasNamedTableOfContentsEntryStart(item)).length >= 3;

    return hasLeaderTopology || hasDenseNumericColumnTopology || hasArabicTableTopology || hasNamedEntryTopology;
};

const computeReferenceWidth = <T extends { bbox: BoundingBox }>(items: T[]) => {
    const widths = items.map((item) => item.bbox.width).toSorted((a, b) => a - b);
    return widths.length >= 4 ? pickPercentile(widths, PARAGRAPH_WIDTH_PERCENTILE) : widths[widths.length - 1];
};

const computeBaselineX = <T extends { bbox: BoundingBox }>(items: T[], minIndentCandidateWidth: number) => {
    const baselineCandidates = items
        .filter((item) => item.bbox.width >= minIndentCandidateWidth)
        .map((item) => item.bbox.x)
        .toSorted((a, b) => a - b);
    const allX = items.map((item) => item.bbox.x).toSorted((a, b) => a - b);
    const xValues = baselineCandidates.length > 0 ? baselineCandidates : allX;

    return {
        allX,
        baselineX: pickPercentile(xValues, PARAGRAPH_BASELINE_PERCENTILE),
    };
};

const computeIndentFloor = <T extends { bbox: BoundingBox }>(items: T[]) => {
    const heights = items.map((item) => item.bbox.height).toSorted((a, b) => a - b);
    const typicalLineHeight = pickPercentile(heights, 0.5);

    return Math.max(PARAGRAPH_MIN_INDENT_PX, typicalLineHeight * PARAGRAPH_MIN_INDENT_HEIGHT_RATIO);
};

/**
 * Detects repeated list-start geometry (e.g., numbered footnote items) without
 * depending on semantic markers such as `isFootnote` or regex prefixes.
 *
 * The signal activates only when we observe:
 * - multiple near-baseline list-start candidates,
 * - short indented continuation lines,
 * - at least one bridge pattern (start -> continuation -> start),
 * - and short lines present in the block.
 */
const shouldUseListStartSignal = <T extends { bbox: BoundingBox }>(
    items: T[],
    thresholdWidth: number,
    minIndentCandidateWidth: number,
    listStartBaselineX: number,
    listStartIndentThreshold: number,
) => {
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

    return (
        listStartCandidateCount >= LIST_START_MIN_CANDIDATES &&
        shortIndentedLineCount >= LIST_START_MIN_SHORT_INDENTED_LINES &&
        hasListBridge &&
        items.some((item) => item.bbox.width < thresholdWidth)
    );
};

const buildParagraphMetrics = <T extends { bbox: BoundingBox; text?: string }>(
    items: T[],
    widthTolerance: number,
): ParagraphMetrics => {
    const referenceWidth = computeReferenceWidth(items);
    const thresholdWidth = referenceWidth * widthTolerance;
    const minIndentCandidateWidth = thresholdWidth * PARAGRAPH_MIN_INDENT_CANDIDATE_WIDTH_RATIO;
    const { allX, baselineX } = computeBaselineX(items, minIndentCandidateWidth);
    const listStartBaselineX = pickPercentile(allX, LIST_START_BASELINE_PERCENTILE);
    const indentFloor = computeIndentFloor(items);
    const indentThreshold = Math.max(referenceWidth * PARAGRAPH_INDENT_THRESHOLD_RATIO, indentFloor);
    const listStartIndentThreshold = Math.max(referenceWidth * LIST_START_INDENT_THRESHOLD_RATIO, indentFloor);

    return {
        baselineX,
        indentThreshold,
        listStartBaselineX,
        listStartIndentThreshold,
        minIndentCandidateWidth,
        shouldUseListStartSignal: shouldUseListStartSignal(
            items,
            thresholdWidth,
            minIndentCandidateWidth,
            listStartBaselineX,
            listStartIndentThreshold,
        ),
        shouldUseRtlTableEntryStartSignal: shouldUseRtlTableEntryStartSignal(items),
        shouldUseTableOfContentsSignal: shouldUseTableOfContentsSignal(items),
        thresholdWidth,
    };
};

const hasVerticalBreakSignal = <T extends { bbox: BoundingBox }>(
    items: T[],
    index: number,
    thresholdWidth: number,
    verticalJumpFactor: number,
) => {
    if (index === 0) {
        return false;
    }

    const item = items[index];
    const prev = items[index - 1];

    if (index === 1) {
        if (prev.bbox.width < thresholdWidth) {
            return false;
        }

        const gap = item.bbox.y - prev.bbox.y;
        if (gap > prev.bbox.height * verticalJumpFactor) {
            return true;
        }

        if (items.length < 3) {
            return false;
        }

        const whitespaceGap = item.bbox.y - (prev.bbox.y + prev.bbox.height);
        const next = items[index + 1];
        const nextWhitespaceGap = next.bbox.y - (item.bbox.y + item.bbox.height);
        const minimumWhitespace = Math.min(prev.bbox.height, item.bbox.height) * 0.35;

        return (
            whitespaceGap >= minimumWhitespace && whitespaceGap > Math.max(1, nextWhitespaceGap) * verticalJumpFactor
        );
    }

    const prevPrev = items[index - 2];
    if (prev.bbox.width < thresholdWidth || prevPrev.bbox.width < thresholdWidth) {
        return false;
    }

    const gap = item.bbox.y - prev.bbox.y;
    const prevGap = prev.bbox.y - prevPrev.bbox.y;

    if (prevGap > 0) {
        return gap > prevGap * verticalJumpFactor;
    }

    return prevGap === 0 && gap > 0 && gap > item.bbox.height * 0.5 * verticalJumpFactor;
};

const hasIndentBreakSignal = <T extends { bbox: BoundingBox }>(
    items: T[],
    index: number,
    metrics: ParagraphMetrics,
) => {
    if (index === 0) {
        return false;
    }

    const item = items[index];
    const prev = items[index - 1];
    const isCurrentIndented = isIndentedLine(item, metrics.baselineX, metrics.indentThreshold);
    const wasPrevShort = prev.bbox.width < metrics.thresholdWidth;

    if (!isCurrentIndented || wasPrevShort || item.bbox.width < metrics.minIndentCandidateWidth) {
        return false;
    }

    const wasPrevIndented = isIndentedLine(prev, metrics.baselineX, metrics.indentThreshold);
    return !wasPrevIndented;
};

const hasListStartBreakSignal = <T extends { bbox: BoundingBox }>(
    items: T[],
    index: number,
    metrics: ParagraphMetrics,
) => {
    if (index === 0 || !metrics.shouldUseListStartSignal) {
        return false;
    }

    const item = items[index];
    const prev = items[index - 1];
    const isCurrentListStart = isListStartCandidate(
        item,
        metrics.listStartBaselineX,
        metrics.listStartIndentThreshold,
        metrics.minIndentCandidateWidth,
    );
    const isPrevListStart = isListStartCandidate(
        prev,
        metrics.listStartBaselineX,
        metrics.listStartIndentThreshold,
        metrics.minIndentCandidateWidth,
    );
    const wasPrevShort = prev.bbox.width < metrics.thresholdWidth;
    const gap = item.bbox.y - prev.bbox.y;
    const minGapForListStart = Math.min(prev.bbox.height, item.bbox.height) * LIST_START_GAP_HEIGHT_FACTOR;

    return isCurrentListStart && isPrevListStart && !wasPrevShort && gap >= minGapForListStart;
};

const resolveBreakReason = <T extends { bbox: BoundingBox }>(
    items: T[],
    index: number,
    verticalJumpFactor: number,
    metrics: ParagraphMetrics,
): BreakReason => {
    if (index === 0) {
        return null;
    }

    if (hasVerticalBreakSignal(items, index, metrics.thresholdWidth, verticalJumpFactor)) {
        return 'vertical';
    }

    if (hasIndentBreakSignal(items, index, metrics)) {
        return 'indent';
    }

    if (hasListStartBreakSignal(items, index, metrics)) {
        return 'list-start';
    }

    return null;
};

const shouldAdvanceAfterShortLine = <T extends { bbox: BoundingBox }>(
    item: T,
    index: number,
    breakReason: BreakReason,
    thresholdWidth: number,
) => {
    if (item.bbox.width >= thresholdWidth) {
        return false;
    }

    return index === 0 || breakReason !== 'indent';
};

const getTableOfContentsAdvance = <T extends { bbox: BoundingBox; text?: string }>(
    item: T,
    itemIndex: number,
    breakReason: BreakReason,
    thresholdWidth: number,
) => {
    const endedEntry = hasTableOfContentsEntryEnd(item);
    const endedHeader = hasTableOfContentsHeader(item);
    const endedLeadingHeader =
        itemIndex === 0 && shouldAdvanceAfterShortLine(item, itemIndex, breakReason, thresholdWidth);

    return { advance: endedEntry || endedHeader || endedLeadingHeader, endedEntry };
};

const isRtlTableEntryStart = <T extends { bbox: BoundingBox; text?: string }>(item: T, metrics: ParagraphMetrics) =>
    metrics.shouldUseRtlTableEntryStartSignal &&
    item.bbox.width >= metrics.thresholdWidth &&
    (hasTableOfContentsEntryEnd(item) || hasArabicTableEntryStart(item));

const resolveTableAwareBreakReason = <T extends { bbox: BoundingBox; text?: string }>(
    items: T[],
    itemIndex: number,
    verticalJumpFactor: number,
    metrics: ParagraphMetrics,
    previousAdvancedTableOfContentsParagraph: boolean,
) => {
    if (previousAdvancedTableOfContentsParagraph) {
        return null;
    }

    const breakReason = resolveBreakReason(items, itemIndex, verticalJumpFactor, metrics);
    const previous = items[itemIndex - 1];
    if (breakReason === 'indent' && previous && isRtlTableEntryStart(previous, metrics)) {
        return null;
    }

    return breakReason;
};

const shouldStartRtlTableParagraph = <T extends { bbox: BoundingBox; text?: string }>(
    items: T[],
    itemIndex: number,
    metrics: ParagraphMetrics,
    shouldStartNextTableLine: boolean,
) => {
    if (!metrics.shouldUseRtlTableEntryStartSignal || itemIndex === 0) {
        return false;
    }

    const item = items[itemIndex];
    const previous = items[itemIndex - 1];
    return (
        isRtlTableEntryStart(item, metrics) ||
        shouldStartNextTableLine ||
        hasArabicTableHeader(item) ||
        (isRtlTableEntryStart(previous, metrics) && item.bbox.width >= metrics.thresholdWidth)
    );
};

const shouldStartNamedTableOfContentsEntry = <T extends { text?: string }>(
    item: T,
    itemIndex: number,
    metrics: ParagraphMetrics,
    previousAlreadyAdvanced: boolean,
) =>
    metrics.shouldUseTableOfContentsSignal &&
    itemIndex > 0 &&
    !previousAlreadyAdvanced &&
    hasNamedTableOfContentsEntryStart(item);

const shouldStartNextRtlTableLine = <T extends { bbox: BoundingBox; text?: string }>(
    items: T[],
    itemIndex: number,
    breakReason: BreakReason,
    metrics: ParagraphMetrics,
    itemIsTableEntryStart: boolean,
) => {
    if (itemIsTableEntryStart) {
        return false;
    }

    const item = items[itemIndex];
    const next = items[itemIndex + 1];
    if (!next) {
        return false;
    }

    const itemIsCentered = (item as { isCentered?: boolean }).isCentered === true;
    const nextIsCentered = (next as { isCentered?: boolean }).isCentered === true;
    const isCenteredContinuationPair = itemIsCentered && nextIsCentered;
    const isSectionMarker = /^\s*فصل(?:\s|\(|[0-9٠-٩۰-۹])/u.test(item.text?.trim() ?? '');
    const nextLooksLikeEntryStart =
        next.bbox.width >= metrics.thresholdWidth * 0.9 && !isCenteredContinuationPair && !isSectionMarker;

    return nextLooksLikeEntryStart && shouldAdvanceAfterShortLine(item, itemIndex, breakReason, metrics.thresholdWidth);
};

/**
 * Groups items into paragraphs based on vertical spacing patterns and line width analysis.
 *
 * This function analyzes vertical spacing between consecutive items and their widths to
 * identify paragraph boundaries. The algorithm uses four coordinated signals:
 *
 * 1. **Vertical jump detection**: A new paragraph starts when there's a significant
 *    increase in vertical gap compared to previous gaps, but only when both preceding
 *    lines are "full-width" (not short lines that might indicate natural breaks)
 *
 * 2. **Indent-start detection**: A line that newly indents from the right-edge baseline
 *    starts a new paragraph.
 *
 * 3. **List-start detection**: Repeated left-edge starts with short indented continuations
 *    are treated as separate list items.
 *
 * 4. **Short line detection**: Lines significantly narrower than a robust reference width
 *    are considered paragraph-ending lines, causing the next line to start a new paragraph.
 *
 * These heuristics work together to handle various paragraph patterns including:
 * - Standard paragraphs with consistent spacing
 * - Consistently indented paragraph starts
 * - Repeated list-start structures (including footnote-style note lists)
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
export const indexItemsAsParagraphs = <T extends { bbox: BoundingBox; text?: string }>(
    items: T[],
    verticalJumpFactor: number,
    widthTolerance: number,
): (T & { index: number })[] => {
    if (items.length === 0) {
        return [];
    }
    const metrics = buildParagraphMetrics(items, widthTolerance);

    const out: (T & { index: number })[] = [];
    let index = 0;
    let previousAdvancedTableOfContentsParagraph = false;
    let shouldStartNextTableLine = false;

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const previousAlreadyAdvanced = previousAdvancedTableOfContentsParagraph;
        const itemIsTableEntryStart = isRtlTableEntryStart(item, metrics);
        const breakReason = resolveTableAwareBreakReason(
            items,
            i,
            verticalJumpFactor,
            metrics,
            previousAdvancedTableOfContentsParagraph,
        );
        const startsTableParagraph = shouldStartRtlTableParagraph(items, i, metrics, shouldStartNextTableLine);
        const startsNamedTableEntry = shouldStartNamedTableOfContentsEntry(item, i, metrics, previousAlreadyAdvanced);
        previousAdvancedTableOfContentsParagraph = false;
        shouldStartNextTableLine = false;

        if (breakReason !== null || startsTableParagraph || startsNamedTableEntry) {
            index++;
        }

        out.push({ ...item, index });

        // Short lines normally trigger a break for the next line; however, if the
        // current line already started a paragraph via indent, avoid a second advance.
        if (metrics.shouldUseRtlTableEntryStartSignal) {
            // In RTL index tables the leftmost page-number cell is normally
            // merged at the end of the first physical line. Treat that line as
            // the row start, then keep any indented continuation lines with it.
            // A short continuation closes the row before the next entry.
            shouldStartNextTableLine = shouldStartNextRtlTableLine(
                items,
                i,
                breakReason,
                metrics,
                itemIsTableEntryStart,
            );
        } else if (metrics.shouldUseTableOfContentsSignal) {
            const tableOfContentsAdvance = getTableOfContentsAdvance(item, i, breakReason, metrics.thresholdWidth);
            if (tableOfContentsAdvance.advance) {
                index++;
            }
            previousAdvancedTableOfContentsParagraph = tableOfContentsAdvance.advance;
        } else if (shouldAdvanceAfterShortLine(item, i, breakReason, metrics.thresholdWidth)) {
            index++;
        }
    }

    // stable sort by index then y
    return out.sort((a, b) => (a.index !== b.index ? a.index - b.index : a.bbox.y - b.bbox.y));
};
