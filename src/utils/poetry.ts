import type { Observation } from '@/types';

import { areObservationsVerticallyAligned, isObservationCentered } from './layout';

/**
 * Represents all observation groups on a page.
 */
export type AllObservations = ObservationGroup[];

/**
 * Represents a group of observations that are on the same horizontal line.
 */
export type ObservationGroup = Observation[];

/**
 * Configuration options to fine-tune the poetry detection logic.
 */
export interface PoetryDetectionOptions {
    /**
     * For checking centering: Tolerance for the center point's alignment with the page center.
     * @default 0.1 (10% of image width)
     */
    centerToleranceRatio: number;

    /**
     * Maximum allowed vertical gap between observations to be considered a poetry pair.
     * As a ratio of the average height of the two observations.
     * @default 2.0 (200% of average height)
     */
    maxVerticalGapRatio: number;

    /**
     * Minimum character count for Arabic text processing optimizations.
     * @default 3
     */
    minCharCount: number;

    /**
     * For checking centering: The minimum required margin on both left and right sides.
     * @default 0.15 (15% of image width)
     */
    minMarginRatio: number;

    /**
     * For merged lines: The minimum width a line must have to be considered for
     * this heuristic, as a ratio of the image width.
     * @default 0.6 (60%)
     */
    minWidthRatioForMerged: number;

    /**
     * The minimum number of words a line must have to be considered poetry.
     * Helps filter out noise like page numbers or single-word labels.
     * @default 2
     */
    minWordCount: number;

    /**
     * For paired lines: How similar in width two hemistichs must be.
     * The check is `|w1 - w2| / avg(w1, w2) < ratio`.
     * @default 0.4 (40%)
     */
    pairWidthSimilarityRatio: number;

    /**
     * For paired lines: How similar in word count two hemistichs must be.
     * The check is `|c1 - c2| / max(c1, c2) < ratio`.
     * @default 0.5 (50%)
     */
    pairWordCountSimilarityRatio: number;

    /**
     * For merged lines: A line is poetic if its density (words/pixel) is less than
     * this ratio multiplied by the average prose density of the document.
     * @default 0.8 (80%)
     */
    wordDensityComparisonRatio: number;
}

/**
 * A rich result object that categorizes the detected poetry.
 */
export interface PoetryResult {
    /** A combined array of all identified poetry for easy iteration. */
    allPoetry: (Observation | ObservationGroup)[];
    /** Single, wide observations identified as merged poetic lines. */
    mergedPoetryLines: Observation[];
    /** Metadata about the detection process. */
    metadata: {
        averageProseDensity: number;
        processingTimeMs?: number;
        totalObservationsProcessed: number;
    };
    /** Groups of two observations identified as poetic pairs (hemistichs). */
    poetryPairs: ObservationGroup[];
    /** Single, short observations identified as centered verses. */
    singleVerses: Observation[];
}

/**
 * Default options for poetry detection, providing a balanced starting point.
 */
export const DEFAULT_POETRY_OPTIONS: PoetryDetectionOptions = {
    centerToleranceRatio: 0.1,
    maxVerticalGapRatio: 2.0,
    minCharCount: 3,
    minMarginRatio: 0.1,
    minWidthRatioForMerged: 0.6,
    minWordCount: 2,
    pairWidthSimilarityRatio: 0.4,
    pairWordCountSimilarityRatio: 0.5,
    wordDensityComparisonRatio: 0.95,
};

// --- Enhanced Helper Functions ---

/**
 * Enhanced Arabic text word counting with better handling of Arabic-specific cases
 */
const getWordCount = (text: string): number => {
    if (!text?.trim()) return 0;

    // Handle Arabic text by removing diacritics and normalizing
    const normalizedText = text
        .trim()
        // Remove common Arabic diacritics that might interfere with word splitting
        .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
        // Split on whitespace and Arabic punctuation
        .split(/[\s\u060C\u061B\u061F\u06D4]+/)
        .filter((word) => word.length > 0);

    return normalizedText.length;
};

/**
 * Enhanced character count for minimum length validation
 */
const getCharCount = (text: string): number => {
    return text.replace(/\s/g, '').length;
};

/**
 * Enhanced prose density calculation with better filtering and error handling
 */
export const calculateAverageProseDensity = (
    allObservations: AllObservations,
    imageWidth: number,
    options: PoetryDetectionOptions = DEFAULT_POETRY_OPTIONS,
): number => {
    const proseLines: Observation[] = [];

    for (const group of allObservations) {
        for (const obs of group) {
            const wordCount = getWordCount(obs.text);
            const charCount = getCharCount(obs.text);

            // Enhanced filtering for better prose identification
            const isLikelyProse =
                !isObservationCentered(obs.bbox, imageWidth, options) &&
                obs.bbox.width > imageWidth * 0.4 && // Slightly lower threshold
                wordCount >= options.minWordCount &&
                charCount >= options.minCharCount &&
                wordCount <= 25; // Exclude very long lines that might be corrupted OCR

            if (isLikelyProse) {
                proseLines.push(obs);
            }
        }
    }

    if (proseLines.length === 0) return 0;

    const totalWords = proseLines.reduce((sum, obs) => sum + getWordCount(obs.text), 0);
    const totalWidth = proseLines.reduce((sum, obs) => sum + obs.bbox.width, 0);

    return totalWords > 0 && totalWidth > 0 ? totalWords / totalWidth : 0;
};

/**
 * Enhanced validation for poetry pairs with better Arabic text handling
 */
export const isValidPoetryPair = (
    obs1: Observation,
    obs2: Observation,
    imageWidth: number,
    options: PoetryDetectionOptions = DEFAULT_POETRY_OPTIONS,
): boolean => {
    const words1 = getWordCount(obs1.text);
    const words2 = getWordCount(obs2.text);
    const chars1 = getCharCount(obs1.text);
    const chars2 = getCharCount(obs2.text);

    // Basic validation
    if (words1 < options.minWordCount || words2 < options.minWordCount) return false;
    if (chars1 < options.minCharCount || chars2 < options.minCharCount) return false;

    // Check vertical alignment
    if (!areObservationsVerticallyAligned(obs1, obs2, options.maxVerticalGapRatio)) return false;

    // Check width similarity
    const avgWidth = (obs1.bbox.width + obs2.bbox.width) / 2;
    const widthDiffRatio = Math.abs(obs1.bbox.width - obs2.bbox.width) / avgWidth;
    if (widthDiffRatio >= options.pairWidthSimilarityRatio) return false;

    // Check word count similarity
    const maxWords = Math.max(words1, words2);
    const wordCountDiffRatio = Math.abs(words1 - words2) / maxWords;
    if (wordCountDiffRatio >= options.pairWordCountSimilarityRatio) return false;

    // Check if the pair as a whole is centered
    const leftX = Math.min(obs1.bbox.x, obs2.bbox.x);
    const rightmostPoint = Math.max(obs1.bbox.x + obs1.bbox.width, obs2.bbox.x + obs2.bbox.width);
    const combinedBbox = {
        height:
            Math.max(obs1.bbox.y + obs1.bbox.height, obs2.bbox.y + obs2.bbox.height) -
            Math.min(obs1.bbox.y, obs2.bbox.y),
        width: rightmostPoint - leftX,
        x: leftX,
        y: Math.min(obs1.bbox.y, obs2.bbox.y),
    };
    return isObservationCentered(combinedBbox, imageWidth, options);
};

export const isWidePoeticLine = (
    obs: Observation,
    imageWidth: number,
    avgProseWordDensity: number,
    options: PoetryDetectionOptions = DEFAULT_POETRY_OPTIONS,
) => {
    const wordCount = getWordCount(obs.text);
    const charCount = getCharCount(obs.text);

    if (wordCount < options.minWordCount || charCount < options.minCharCount) {
        return false;
    }

    if (!isObservationCentered(obs.bbox, imageWidth, options)) {
        return false;
    }

    if (obs.bbox.width > imageWidth * options.minWidthRatioForMerged) {
        const obsDensity = wordCount / obs.bbox.width;
        const densityThreshold = avgProseWordDensity * options.wordDensityComparisonRatio;

        if (obsDensity < densityThreshold && obsDensity > 0) {
            return true;
        }
    }

    return false;
};

// --- Main Enhanced Identification Function ---

/**
 * Enhanced version of the poetry identification function with better Arabic text handling,
 * improved validation, and performance optimizations.
 *
 * @param allObservations - An array of all observation groups from the page.
 * @param imageWidth - The total width of the source image in pixels.
 * @param userOptions - Optional configuration to override default detection thresholds.
 * @returns A `PoetryResult` object containing categorized lists of detected poetry with metadata.
 *
 * @example
 * ```typescript
 * const poetry = identifyPoeticLines(allMyObservations, 4959, {
 *     minMarginRatio: 0.2, // Require larger margins for centered lines
 *     maxVerticalGapRatio: 1.5, // Stricter vertical alignment
 * });
 *
 * console.log(`Found ${poetry.poetryPairs.length} poetry pairs.`);
 * console.log(`Processing took ${poetry.metadata.processingTimeMs}ms`);
 * ```
 */
export const identifyPoeticLines = (
    allObservations: AllObservations,
    imageWidth: number,
    userOptions?: Partial<PoetryDetectionOptions>,
): PoetryResult => {
    const startTime = performance.now();
    const options: PoetryDetectionOptions = { ...DEFAULT_POETRY_OPTIONS, ...userOptions };

    // Input validation
    if (!allObservations?.length || imageWidth <= 0) {
        return {
            allPoetry: [],
            mergedPoetryLines: [],
            metadata: {
                averageProseDensity: 0,
                processingTimeMs: performance.now() - startTime,
                totalObservationsProcessed: 0,
            },
            poetryPairs: [],
            singleVerses: [],
        };
    }

    const avgProseWordDensity = calculateAverageProseDensity(allObservations, imageWidth, options);
    let totalProcessed = 0;

    const result: PoetryResult = {
        allPoetry: [],
        mergedPoetryLines: [],
        metadata: {
            averageProseDensity: avgProseWordDensity,
            totalObservationsProcessed: 0,
        },
        poetryPairs: [],
        singleVerses: [],
    };

    for (const group of allObservations) {
        totalProcessed += group.length;

        // --- Enhanced Poetry Pairs Detection ---
        if (group.length === 2) {
            const [obs1, obs2] = group;

            if (isValidPoetryPair(obs1, obs2, imageWidth, options)) {
                result.poetryPairs.push(group);
                result.allPoetry.push(group);
                continue;
            }
        }

        // --- Enhanced Single-Line Verses Detection ---
        if (group.length === 1) {
            const obs = group[0];
            const wordCount = getWordCount(obs.text);
            const charCount = getCharCount(obs.text);

            if (wordCount < options.minWordCount || charCount < options.minCharCount) continue;

            // Heuristic 1: Short, centered verse
            if (isObservationCentered(obs.bbox, imageWidth, options)) {
                result.singleVerses.push(obs);
                result.allPoetry.push(obs);
                continue;
            }

            // Heuristic 2: Wide, merged line with low word density
            if (avgProseWordDensity > 0) {
                const isWideEnough = obs.bbox.width > imageWidth * options.minWidthRatioForMerged;
                if (isWideEnough) {
                    const obsDensity = wordCount / obs.bbox.width;
                    const densityThreshold = avgProseWordDensity * options.wordDensityComparisonRatio;

                    if (obsDensity < densityThreshold && obsDensity > 0) {
                        result.mergedPoetryLines.push(obs);
                        result.allPoetry.push(obs);
                    }
                }
            }
        }
    }

    result.metadata.totalObservationsProcessed = totalProcessed;
    result.metadata.processingTimeMs = performance.now() - startTime;

    return result;
};
