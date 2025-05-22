import { normalizeArabicText } from './textUtils';

// Alignment scoring constants
const ALIGNMENT_SCORES = {
    PERFECT_MATCH: 2,
    SOFT_MATCH: 1,
    GAP_PENALTY: -1,
    MISMATCH_PENALTY: -2,
};

/**
 * Calculates Levenshtein distance between two strings using space-optimized dynamic programming.
 * The Levenshtein distance is the minimum number of single-character edits (insertions,
 * deletions, or substitutions) required to change one string into another.
 *
 * @param textA - First string to compare
 * @param textB - Second string to compare
 * @returns Minimum edit distance between the two strings
 * @complexity Time: O(m*n), Space: O(min(m,n)) where m,n are string lengths
 * @example
 * calculateLevenshteinDistance('kitten', 'sitting') // Returns 3
 * calculateLevenshteinDistance('', 'hello') // Returns 5
 */
export const calculateLevenshteinDistance = (textA: string, textB: string): number => {
    const lengthA = textA.length;
    const lengthB = textB.length;

    if (lengthA === 0) {
        return lengthB;
    }

    if (lengthB === 0) {
        return lengthA;
    }

    // Use shorter string for the array to optimize space
    const [shorter, longer] = lengthA <= lengthB ? [textA, textB] : [textB, textA];
    const shortLen = shorter.length;
    const longLen = longer.length;

    let previousRow = Array.from({ length: shortLen + 1 }, (_, index) => index);

    for (let i = 1; i <= longLen; i++) {
        const currentRow = [i];

        for (let j = 1; j <= shortLen; j++) {
            const substitutionCost = longer[i - 1] === shorter[j - 1] ? 0 : 1;
            const minCost = Math.min(
                previousRow[j] + 1, // deletion
                currentRow[j - 1] + 1, // insertion
                previousRow[j - 1] + substitutionCost, // substitution
            );
            currentRow.push(minCost);
        }

        previousRow = currentRow;
    }

    return previousRow[shortLen];
};

/**
 * Calculates similarity ratio between two strings as a value between 0.0 and 1.0.
 * Uses Levenshtein distance normalized by the length of the longer string.
 * A ratio of 1.0 indicates identical strings, 0.0 indicates completely different strings.
 *
 * @param textA - First string to compare
 * @param textB - Second string to compare
 * @returns Similarity ratio from 0.0 (completely different) to 1.0 (identical)
 * @example
 * calculateSimilarity('hello', 'hello') // Returns 1.0
 * calculateSimilarity('hello', 'help') // Returns 0.6
 */
export const calculateSimilarity = (textA: string, textB: string): number => {
    const maxLength = Math.max(textA.length, textB.length) || 1;
    const distance = calculateLevenshteinDistance(textA, textB);
    return (maxLength - distance) / maxLength;
};

/**
 * Checks if two texts are similar after Arabic normalization.
 * Normalizes both texts by removing diacritics and decorative elements,
 * then compares their similarity against the provided threshold.
 *
 * @param textA - First text to compare
 * @param textB - Second text to compare
 * @param threshold - Similarity threshold (0.0 to 1.0)
 * @returns True if normalized texts meet the similarity threshold
 * @example
 * areSimilarAfterNormalization('السَّلام', 'السلام', 0.9) // Returns true
 */
export const areSimilarAfterNormalization = (textA: string, textB: string, threshold: number): boolean => {
    const normalizedA = normalizeArabicText(textA);
    const normalizedB = normalizeArabicText(textB);
    return calculateSimilarity(normalizedA, normalizedB) >= threshold;
};

/**
 * Calculates alignment score for two tokens in sequence alignment.
 * Uses different scoring criteria: perfect match after normalization gets highest score,
 * typo symbols or highly similar tokens get soft match score, mismatches get penalty.
 *
 * @param tokenA - First token to score
 * @param tokenB - Second token to score
 * @param typoSymbols - Array of special symbols that get preferential treatment
 * @param similarityThreshold - Threshold for considering tokens highly similar
 * @returns Alignment score (higher is better match)
 * @example
 * calculateAlignmentScore('hello', 'hello', [], 0.8) // Returns 2 (perfect match)
 * calculateAlignmentScore('hello', 'help', [], 0.8) // Returns 1 or -2 based on similarity
 */
export const calculateAlignmentScore = (
    tokenA: string,
    tokenB: string,
    typoSymbols: string[],
    similarityThreshold: number,
): number => {
    const normalizedA = normalizeArabicText(tokenA);
    const normalizedB = normalizeArabicText(tokenB);

    // Perfect match after normalization
    if (normalizedA === normalizedB) {
        return ALIGNMENT_SCORES.PERFECT_MATCH;
    }

    // Check if either token is a typo symbol or high similarity
    const isTypoSymbol = typoSymbols.includes(tokenA) || typoSymbols.includes(tokenB);
    const isHighlySimilar = calculateSimilarity(normalizedA, normalizedB) >= similarityThreshold;

    if (isTypoSymbol || isHighlySimilar) {
        return ALIGNMENT_SCORES.SOFT_MATCH;
    }

    return ALIGNMENT_SCORES.MISMATCH_PENALTY;
};

type AlignmentCell = {
    score: number;
    direction: 'diagonal' | 'up' | 'left' | null;
};

type AlignedTokenPair = [string | null, string | null];

/**
 * Backtracks through the scoring matrix to reconstruct optimal sequence alignment.
 * Follows the directional indicators in the matrix to build the sequence of aligned
 * token pairs from the Needleman-Wunsch algorithm.
 *
 * @param matrix - Scoring matrix with directional information from alignment
 * @param tokensA - First sequence of tokens
 * @param tokensB - Second sequence of tokens
 * @returns Array of aligned token pairs, where null indicates a gap
 * @throws Error if invalid alignment direction is encountered
 */
export const backtrackAlignment = (
    matrix: AlignmentCell[][],
    tokensA: string[],
    tokensB: string[],
): AlignedTokenPair[] => {
    const alignment: AlignedTokenPair[] = [];
    let i = tokensA.length;
    let j = tokensB.length;

    while (i > 0 || j > 0) {
        const currentCell = matrix[i][j];

        switch (currentCell.direction) {
            case 'diagonal':
                alignment.push([tokensA[--i], tokensB[--j]]);
                break;
            case 'up':
                alignment.push([tokensA[--i], null]);
                break;
            case 'left':
                alignment.push([null, tokensB[--j]]);
                break;
            default:
                throw new Error('Invalid alignment direction');
        }
    }

    return alignment.reverse();
};

/**
 * Performs global sequence alignment using the Needleman-Wunsch algorithm.
 * Aligns two token sequences to find the optimal pairing that maximizes
 * the total alignment score, handling insertions, deletions, and substitutions.
 *
 * @param tokensA - First sequence of tokens to align
 * @param tokensB - Second sequence of tokens to align
 * @param typoSymbols - Special symbols that affect scoring
 * @param similarityThreshold - Threshold for high similarity scoring
 * @returns Array of aligned token pairs, with null indicating gaps
 * @example
 * alignTokenSequences(['a', 'b'], ['a', 'c'], [], 0.8)
 * // Returns [['a', 'a'], ['b', 'c']]
 */
export const alignTokenSequences = (
    tokensA: string[],
    tokensB: string[],
    typoSymbols: string[],
    similarityThreshold: number,
): AlignedTokenPair[] => {
    const lengthA = tokensA.length;
    const lengthB = tokensB.length;

    // Initialize scoring matrix
    const scoringMatrix: AlignmentCell[][] = Array.from({ length: lengthA + 1 }, () =>
        Array.from({ length: lengthB + 1 }, () => ({ score: 0, direction: null })),
    );

    // Initialize first row and column
    for (let i = 1; i <= lengthA; i++) {
        scoringMatrix[i][0] = { score: i * ALIGNMENT_SCORES.GAP_PENALTY, direction: 'up' };
    }
    for (let j = 1; j <= lengthB; j++) {
        scoringMatrix[0][j] = { score: j * ALIGNMENT_SCORES.GAP_PENALTY, direction: 'left' };
    }

    // Fill scoring matrix
    for (let i = 1; i <= lengthA; i++) {
        for (let j = 1; j <= lengthB; j++) {
            const alignmentScore = calculateAlignmentScore(
                tokensA[i - 1],
                tokensB[j - 1],
                typoSymbols,
                similarityThreshold,
            );

            const diagonalScore = scoringMatrix[i - 1][j - 1].score + alignmentScore;
            const upScore = scoringMatrix[i - 1][j].score + ALIGNMENT_SCORES.GAP_PENALTY;
            const leftScore = scoringMatrix[i][j - 1].score + ALIGNMENT_SCORES.GAP_PENALTY;

            const bestScore = Math.max(diagonalScore, upScore, leftScore);
            const bestDirection = bestScore === diagonalScore ? 'diagonal' : bestScore === upScore ? 'up' : 'left';

            scoringMatrix[i][j] = { score: bestScore, direction: bestDirection };
        }
    }

    // Backtrack to build alignment
    return backtrackAlignment(scoringMatrix, tokensA, tokensB);
};
