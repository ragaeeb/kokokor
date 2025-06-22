import type { Observation, PoetryDetectionOptions } from '@/types';

import { DEFAULT_POETRY_OPTIONS, MAX_PROSE_WORD_COUNT, PROSE_PUNCTUATION_PATTERN } from './constants';
import { isObservationCentered } from './layout';

/**
 * Calculates the average word density (words per pixel) for prose text in the document.
 *
 * Filters observations to identify likely prose content by excluding centered text,
 * very narrow text, and text with too few or too many words. Used as a baseline
 * for poetry detection algorithms that rely on comparing word density patterns.
 *
 * Prose text typically has higher word density than poetry because prose lines
 * extend closer to page margins and contain more words per line.
 *
 * @param observations - Array of text observations to analyze
 * @param imageWidth - Total width of the document/image in pixels
 * @param options - Configuration options for prose identification
 * @param options.centerToleranceRatio - Tolerance for identifying centered text to exclude
 * @param options.minMarginRatio - Minimum margin ratio for identifying centered text to exclude
 * @param options.minWordCount - Minimum word count threshold for valid prose lines
 * @returns Average word density (words per pixel) for prose content, or 0 if no prose found
 */
export const calculateAverageProseDensity = (
    observations: Observation[],
    imageWidth: number,
    options: Pick<
        PoetryDetectionOptions,
        'centerToleranceRatio' | 'minMarginRatio' | 'minWordCount'
    > = DEFAULT_POETRY_OPTIONS,
): number => {
    let totalWords = 0;
    let totalWidth = 0;

    for (const obs of observations) {
        const wordCount = obs.text.split(' ').length;

        // Enhanced filtering for better prose identification
        const isLikelyProse =
            !isObservationCentered(obs.bbox, imageWidth, options) &&
            obs.bbox.width > imageWidth * 0.4 && // Slightly lower threshold
            wordCount >= options.minWordCount &&
            wordCount <= MAX_PROSE_WORD_COUNT; // Exclude very long lines that might be corrupted OCR

        if (isLikelyProse) {
            totalWords += wordCount;
            totalWidth += obs.bbox.width;
        }
    }

    return totalWords > 0 && totalWidth > 0 ? totalWords / totalWidth : 0;
};

/**
 * Validates if two observations form a poetry pair (hemistichs).
 *
 * In traditional poetry, especially Arabic poetry, lines are often split into two
 * hemistichs that appear as separate text observations. This function checks if
 * two observations meet the criteria for being poetry hemistichs based on:
 * - Similar width (indicating balanced structure)
 * - Similar word count (indicating rhythmic balance)
 * - Overall centering when combined (typical poetry layout)
 * - Minimum word count threshold (filtering noise)
 *
 * @param obs1 - First observation (potential first hemistich)
 * @param obs2 - Second observation (potential second hemistich)
 * @param imageWidth - Total width of the document/image in pixels
 * @param options - Poetry detection configuration options
 * @returns True if the observations form a valid poetry pair
 */
export const isPoetryPair = (
    obs1: Observation,
    obs2: Observation,
    imageWidth: number,
    options: PoetryDetectionOptions = DEFAULT_POETRY_OPTIONS,
): boolean => {
    const words1 = obs1.text.split(' ').length;
    const words2 = obs2.text.split(' ').length;

    // Basic validation
    if (words1 < options.minWordCount || words2 < options.minWordCount) return false;

    // Check width similarity
    const avgWidth = (obs1.bbox.width + obs2.bbox.width) / 2;
    const widthDiffRatio = Math.abs(obs1.bbox.width - obs2.bbox.width) / avgWidth;
    if (widthDiffRatio >= options.pairWidthSimilarityRatio) return false;

    // Check word count similarity
    const maxWords = Math.max(words1, words2);
    const wordCountDiffRatio = Math.abs(words1 - words2) / maxWords;
    if (wordCountDiffRatio >= options.pairWordCountSimilarityRatio) return false;

    // For pairs (hemistichs), the centering can be less strict, especially if
    // there is a clear visual gap separating them, which is a common poetic layout.
    const leftObs = obs1.bbox.x < obs2.bbox.x ? obs1 : obs2;
    const rightObs = obs1.bbox.x < obs2.bbox.x ? obs2 : obs1;
    const gap = rightObs.bbox.x - (leftObs.bbox.x + leftObs.bbox.width);

    // A gap is considered significant if it's large relative to the page width OR the text width.
    // This allows for more flexible detection of visually separated hemistichs.
    const hasSignificantGap = gap > imageWidth * 0.07 || gap > avgWidth * 0.25;
    const centeringOptions = hasSignificantGap
        ? { ...options, centerToleranceRatio: options.centerToleranceRatio * 2.5 }
        : options;

    // Check if the pair as a whole is centered using the determined options.
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

    return isObservationCentered(combinedBbox, imageWidth, centeringOptions);
};

/**
 * Determines if a single observation represents a wide poetic line.
 *
 * Some poetry appears as single wide lines rather than split hemistichs.
 * These lines are identified by:
 * - Being centered on the page
 * - Having sufficient width (not just short fragments)
 * - Having lower word density compared to prose (more spaced out)
 * - Meeting minimum word count requirements
 *
 * The word density comparison helps distinguish poetry from prose: poetry
 * typically has more spacing between words and shorter lines relative to
 * the number of words, resulting in lower words-per-pixel density.
 *
 * @param obs - The observation to analyze
 * @param imageWidth - Total width of the document/image in pixels
 * @param avgProseWordDensity - Average word density of prose content for comparison
 * @param options - Poetry detection configuration options
 * @returns True if the observation represents a wide poetic line
 */
export const isWidePoeticLine = (
    obs: Observation,
    imageWidth: number,
    avgProseWordDensity: number,
    options: PoetryDetectionOptions = DEFAULT_POETRY_OPTIONS,
) => {
    const wordCount = obs.text.split(' ').length;

    if (wordCount < options.minWordCount) {
        return false;
    }

    // Heuristic: Prose lines often contain punctuation like commas or parentheses,
    // which are less common in single, distinct lines of poetry. This helps filter
    // out wide prose that might otherwise be misidentified. Footnotes within pairs
    // like "text (1)" are handled by the isPoetryPair logic, so this check is
    // safe for single-line analysis.
    if (PROSE_PUNCTUATION_PATTERN.test(obs.text)) {
        return false;
    }

    if (!isObservationCentered(obs.bbox, imageWidth, options)) {
        return false;
    }

    // minWidthRatioForMerged is 0.6 by default
    if (obs.bbox.width > imageWidth * options.minWidthRatioForMerged) {
        // Only perform density comparison if we have a reliable prose baseline
        if (avgProseWordDensity <= 0) {
            return false;
        }

        const obsDensity = wordCount / obs.bbox.width;

        // The observation density should be notably lower than prose density.
        if (obsDensity > 0) {
            const densityRatio = obsDensity / avgProseWordDensity;

            // To prevent false positives from prose, the density check is tiered. The
            // original threshold for very wide lines was too lenient. This version
            // tightens it slightly, which works well in combination with the
            // punctuation heuristic above.
            const widthRatio = obs.bbox.width / imageWidth;
            const requiredDensityRatio = widthRatio > 0.75 ? options.wordDensityComparisonRatio * 0.95 : 0.5;

            if (densityRatio < requiredDensityRatio) {
                return true;
            }
        }
    }

    return false;
};

/**
 * Determines if a group of observations represents poetic content.
 *
 * This function handles the two main patterns of poetry layout:
 * 1. Single wide lines: Complete poetic lines that appear as one observation
 * 2. Hemistich pairs: Poetry lines split into two balanced parts (hemistichs)
 *
 * For single observations, it checks if the line is wide, centered, and has
 * low word density compared to prose content in the document.
 *
 * For pairs of observations, it validates them as poetry hemistichs based on
 * width similarity, word count similarity, and overall centering when combined.
 *
 * Groups with more than 2 observations are not considered poetic content
 * as they don't match common poetry formatting patterns.
 *
 * @param group - Array of observations to analyze (typically 1-2 items for poetry)
 * @param imageWidth - Total width of the document/image in pixels
 * @param avgProseWordDensity - Average word density of prose content for comparison
 * @param options - Poetry detection configuration options
 * @returns True if the group represents poetic content
 */
export const isPoeticGroup = (
    group: Observation[],
    imageWidth: number,
    avgProseWordDensity: number,
    options: PoetryDetectionOptions = DEFAULT_POETRY_OPTIONS,
) => {
    if (group.length === 1) {
        return isWidePoeticLine(group[0], imageWidth, avgProseWordDensity, options);
    }

    if (group.length === 2) {
        return isPoetryPair(group[0], group[1], imageWidth, options);
    }

    return false;
};
