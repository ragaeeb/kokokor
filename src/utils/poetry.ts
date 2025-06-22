import type { Observation, PoetryDetectionOptions } from '@/types';

import { MAX_PROSE_WORD_COUNT } from './constants';
import { isObservationCentered } from './layout';

/**
 * Calculates the average word density (words per pixel) for prose text in the document.
 *
 * Filters observations to identify likely prose content by excluding centered text,
 * very narrow text, and text with too few or too many words. Used as a baseline
 * for poetry detection algorithms.
 *
 * @param observations - Array of text observations to analyze
 * @param imageWidth - Total width of the document/image in pixels
 * @param options - Configuration options for prose identification
 * @returns Average word density (words per pixel) for prose content, or 0 if no prose found
 */
export const calculateAverageProseDensity = (
    observations: Observation[],
    imageWidth: number,
    options: Pick<PoetryDetectionOptions, 'centerToleranceRatio' | 'minMarginRatio' | 'minWordCount'>,
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
 * Enhanced validation for poetry pairs with better Arabic text handling
 */
const isPoetryPair = (
    obs1: Observation,
    obs2: Observation,
    imageWidth: number,
    options: PoetryDetectionOptions,
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

const isWidePoeticLine = (
    obs: Observation,
    imageWidth: number,
    avgProseWordDensity: number,
    options: PoetryDetectionOptions,
) => {
    const wordCount = obs.text.split(' ').length;

    if (wordCount < options.minWordCount) {
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

/**
 * Determines if a group of observations represents poetic content.
 *
 * For single observations, checks if it's a wide poetic line (centered with low word density).
 * For pairs of observations, validates them as poetry hemistichs based on width similarity,
 * word count similarity, and overall centering.
 *
 * @param group - Array of observations to analyze (typically 1-2 items)
 * @param imageWidth - Total width of the document/image in pixels
 * @param avgProseWordDensity - Average word density of prose content for comparison
 * @param options - Poetry detection configuration options
 * @returns True if the group represents poetic content
 */
export const isPoeticGroup = (
    group: Observation[],
    imageWidth: number,
    avgProseWordDensity: number,
    options: PoetryDetectionOptions,
) => {
    if (group.length === 1) {
        return isWidePoeticLine(group[0], imageWidth, avgProseWordDensity, options);
    }

    if (group.length === 2) {
        return isPoetryPair(group[0], group[1], imageWidth, options);
    }

    return false;
};
