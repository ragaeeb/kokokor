import type { CenteringOptions, Observation, PoetryDetectionOptions } from '@/types';

import { DEFAULT_POETRY_OPTIONS, MAX_PROSE_WORD_COUNT, PROSE_PUNCTUATION_PATTERN } from './constants';
import { isObservationCentered } from './layout';
import { resolveWithDefaults } from './options';

const DEFAULT_CENTER_TOLERANCE = DEFAULT_POETRY_OPTIONS.centerToleranceRatio ?? 0.05;
const DEFAULT_MIN_MARGIN = DEFAULT_POETRY_OPTIONS.minMarginRatio ?? 0.1;
const DEFAULT_MIN_WIDTH_RATIO_FOR_MERGED = DEFAULT_POETRY_OPTIONS.minWidthRatioForMerged ?? 0.6;
const DEFAULT_MIN_WORD_COUNT = DEFAULT_POETRY_OPTIONS.minWordCount ?? 2;
const DEFAULT_PAIR_WIDTH_SIMILARITY = DEFAULT_POETRY_OPTIONS.pairWidthSimilarityRatio ?? 0.4;
const DEFAULT_PAIR_WORD_SIMILARITY = DEFAULT_POETRY_OPTIONS.pairWordCountSimilarityRatio ?? 0.5;
const DEFAULT_DENSITY_RATIO = DEFAULT_POETRY_OPTIONS.wordDensityComparisonRatio ?? 0.95;
const DEFAULT_MAX_VERTICAL_GAP_RATIO = DEFAULT_POETRY_OPTIONS.maxVerticalGapRatio ?? 2.0;

const NBSP_PATTERN = /\u00A0/g;
const TATWEEL_PATTERN = /\u0640/g;
const NON_WHITESPACE_PATTERN = /\S+/g;
const STRIP_PUNCTUATION_SYMBOLS_AND_SPACE_PATTERN = /[\p{P}\p{S}\s]+/gu;
const ARABIC_OR_LATIN_DIGITS_PATTERN = /^[\d\u0660-\u0669]+$/;

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
const resolveCenteringOptions = (options?: Partial<CenteringOptions>) =>
    resolveWithDefaults(
        {
            centerToleranceRatio: DEFAULT_CENTER_TOLERANCE,
            minMarginRatio: DEFAULT_MIN_MARGIN,
        },
        options,
    );

const getWordCount = (text: string) => {
    const normalized = text.replace(NBSP_PATTERN, ' ').replace(TATWEEL_PATTERN, '').trim();
    if (!normalized) {
        return 0;
    }

    return normalized.match(NON_WHITESPACE_PATTERN)?.length ?? 0;
};

const isNumericOnlyToken = (text: string) => {
    const stripped = text
        .replace(NBSP_PATTERN, ' ')
        .replace(TATWEEL_PATTERN, '')
        .replace(STRIP_PUNCTUATION_SYMBOLS_AND_SPACE_PATTERN, '');

    return stripped.length > 0 && ARABIC_OR_LATIN_DIGITS_PATTERN.test(stripped);
};

const hasCompatiblePairWidths = (obs1: Observation, obs2: Observation, pairWidthSimilarityRatio: number) => {
    const avgWidth = (obs1.bbox.width + obs2.bbox.width) / 2;
    const widthDiffRatio = Math.abs(obs1.bbox.width - obs2.bbox.width) / avgWidth;

    return { avgWidth, isCompatible: widthDiffRatio < pairWidthSimilarityRatio };
};

const hasCompatibleWordCounts = (words1: number, words2: number, pairWordCountSimilarityRatio: number) => {
    const maxWords = Math.max(words1, words2);
    const wordCountDiffRatio = Math.abs(words1 - words2) / maxWords;

    return wordCountDiffRatio < pairWordCountSimilarityRatio;
};

const hasCompatibleVerticalGap = (obs1: Observation, obs2: Observation, maxVerticalGapRatio: number) => {
    const centerY1 = obs1.bbox.y + obs1.bbox.height / 2;
    const centerY2 = obs2.bbox.y + obs2.bbox.height / 2;
    const dy = Math.abs(centerY1 - centerY2);
    const avgHeight = (obs1.bbox.height + obs2.bbox.height) / 2;

    return dy <= maxVerticalGapRatio * avgHeight;
};

const getOrderedPairObservations = (obs1: Observation, obs2: Observation) => {
    const leftObs = obs1.bbox.x < obs2.bbox.x ? obs1 : obs2;
    const rightObs = obs1.bbox.x < obs2.bbox.x ? obs2 : obs1;
    const gap = rightObs.bbox.x - (leftObs.bbox.x + leftObs.bbox.width);

    return { gap, leftObs, rightObs };
};

const hasAsymmetricSparseGap = (
    leftObs: Observation,
    rightObs: Observation,
    gap: number,
    avgWidth: number,
    imageWidth: number,
) => {
    const pageCenter = imageWidth / 2;
    const innerLeft = leftObs.bbox.x + leftObs.bbox.width;
    const innerRight = rightObs.bbox.x;
    const leftDelta = Math.abs(pageCenter - innerLeft);
    const rightDelta = Math.abs(innerRight - pageCenter);
    const asymmetry = Math.abs(leftDelta - rightDelta);
    const isVerySparsePair = gap > avgWidth * 2;

    return isVerySparsePair && asymmetry > imageWidth * 0.12;
};

const resolvePairCenteringOptions = (hasSignificantGap: boolean, options: PoetryDetectionOptions) => {
    if (!hasSignificantGap) {
        return resolveCenteringOptions(options);
    }

    return {
        ...resolveCenteringOptions(options),
        centerToleranceRatio: (options.centerToleranceRatio ?? DEFAULT_CENTER_TOLERANCE) * 2.5,
        minMarginRatio: (options.minMarginRatio ?? DEFAULT_MIN_MARGIN) * 0.75,
    };
};

const toCombinedBbox = (obs1: Observation, obs2: Observation) => {
    const leftX = Math.min(obs1.bbox.x, obs2.bbox.x);
    const rightmostPoint = Math.max(obs1.bbox.x + obs1.bbox.width, obs2.bbox.x + obs2.bbox.width);

    return {
        height:
            Math.max(obs1.bbox.y + obs1.bbox.height, obs2.bbox.y + obs2.bbox.height) -
            Math.min(obs1.bbox.y, obs2.bbox.y),
        width: rightmostPoint - leftX,
        x: leftX,
        y: Math.min(obs1.bbox.y, obs2.bbox.y),
    };
};

const hasPoetryLikeDensity = (
    obs: Observation,
    wordCount: number,
    imageWidth: number,
    avgProseWordDensity: number,
    minWidthRatioForMerged: number,
    wordDensityComparisonRatio: number,
) => {
    if (
        obs.bbox.width <= imageWidth * minWidthRatioForMerged ||
        !Number.isFinite(avgProseWordDensity) ||
        avgProseWordDensity <= 0
    ) {
        return false;
    }

    const obsDensity = wordCount / obs.bbox.width;

    if (obsDensity <= 0) {
        return false;
    }

    const densityRatio = obsDensity / avgProseWordDensity;
    const widthRatio = obs.bbox.width / imageWidth;
    const requiredDensityRatio = widthRatio > 0.75 ? wordDensityComparisonRatio * 0.95 : 0.5;

    return densityRatio < requiredDensityRatio;
};

export const calculateAverageProseDensity = (
    observations: Observation[],
    imageWidth: number,
    options: Pick<
        PoetryDetectionOptions,
        'centerToleranceRatio' | 'minMarginRatio' | 'minWordCount'
    > = DEFAULT_POETRY_OPTIONS,
): number => {
    const centeringOptions = resolveCenteringOptions(options);
    const minWordCount = options.minWordCount ?? DEFAULT_MIN_WORD_COUNT;
    let totalWords = 0;
    let totalWidth = 0;

    for (const obs of observations) {
        const wordCount = getWordCount(obs.text);

        // Enhanced filtering for better prose identification
        const isLikelyProse =
            !isObservationCentered(obs.bbox, imageWidth, centeringOptions) &&
            obs.bbox.width > imageWidth * 0.4 && // Slightly lower threshold
            wordCount >= minWordCount &&
            wordCount <= MAX_PROSE_WORD_COUNT; // Exclude very long lines that might be corrupted OCR

        if (isLikelyProse) {
            totalWords += wordCount;
            totalWidth += obs.bbox.width;
        }
    }

    if (totalWords <= 0 || totalWidth <= 0) {
        return 0;
    }

    const density = totalWords / totalWidth;
    return Number.isFinite(density) && density > 0 ? density : 0;
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
    const minWordCount = options.minWordCount ?? DEFAULT_MIN_WORD_COUNT;
    const maxVerticalGapRatio = options.maxVerticalGapRatio ?? DEFAULT_MAX_VERTICAL_GAP_RATIO;
    const pairWidthSimilarityRatio = options.pairWidthSimilarityRatio ?? DEFAULT_PAIR_WIDTH_SIMILARITY;
    const pairWordCountSimilarityRatio = options.pairWordCountSimilarityRatio ?? DEFAULT_PAIR_WORD_SIMILARITY;
    const words1 = getWordCount(obs1.text);
    const words2 = getWordCount(obs2.text);

    // Basic validation
    if (words1 < minWordCount || words2 < minWordCount) {
        return false;
    }

    const { avgWidth, isCompatible: hasCompatibleWidths } = hasCompatiblePairWidths(
        obs1,
        obs2,
        pairWidthSimilarityRatio,
    );
    if (!hasCompatibleWidths) {
        return false;
    }

    if (!hasCompatibleWordCounts(words1, words2, pairWordCountSimilarityRatio)) {
        return false;
    }

    if (!hasCompatibleVerticalGap(obs1, obs2, maxVerticalGapRatio)) {
        return false;
    }

    // For pairs (hemistichs), the centering can be less strict, especially if
    // there is a clear visual gap separating them, which is a common poetic layout.
    const { gap, leftObs, rightObs } = getOrderedPairObservations(obs1, obs2);

    if (isNumericOnlyToken(leftObs.text)) {
        return false;
    }

    // A gap is considered significant if it's large relative to the page width OR the text width.
    // This allows for more flexible detection of visually separated hemistichs.
    const hasSignificantGap = gap > imageWidth * 0.07 || gap > avgWidth * 0.15;
    if (hasSignificantGap && hasAsymmetricSparseGap(leftObs, rightObs, gap, avgWidth, imageWidth)) {
        return false;
    }

    const centeringOptions = resolvePairCenteringOptions(hasSignificantGap, options);
    const combinedBbox = toCombinedBbox(obs1, obs2);

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
    const wordCount = getWordCount(obs.text);
    const minWordCount = options.minWordCount ?? DEFAULT_MIN_WORD_COUNT;
    const wordDensityComparisonRatio = options.wordDensityComparisonRatio ?? DEFAULT_DENSITY_RATIO;

    if (wordCount < minWordCount) {
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

    if (!isObservationCentered(obs.bbox, imageWidth, resolveCenteringOptions(options))) {
        return false;
    }

    // minWidthRatioForMerged is 0.6 by default
    const minWidthRatioForMerged = options.minWidthRatioForMerged ?? DEFAULT_MIN_WIDTH_RATIO_FOR_MERGED;

    // To prevent false positives from prose, the density check is tiered by width
    // and requires sufficiently lower density than prose baseline.
    return hasPoetryLikeDensity(
        obs,
        wordCount,
        imageWidth,
        avgProseWordDensity,
        minWidthRatioForMerged,
        wordDensityComparisonRatio,
    );
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
    const minWidthRatioForMerged = options.minWidthRatioForMerged ?? DEFAULT_MIN_WIDTH_RATIO_FOR_MERGED;

    if (group.length === 1 && minWidthRatioForMerged !== null) {
        return isWidePoeticLine(group[0], imageWidth, avgProseWordDensity, { ...options, minWidthRatioForMerged });
    }

    if (group.length === 2) {
        return isPoetryPair(group[0], group[1], imageWidth, options);
    }

    return false;
};
