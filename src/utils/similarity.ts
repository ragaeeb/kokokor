import { normalizeArabicText } from './textUtils';

/**
 * Calculates Levenshtein distance between two strings using space-optimized DP
 * Time: O(m*n), Space: O(min(m,n))
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
 * Calculates similarity ratio between two strings (0.0 to 1.0)
 */
export const calculateSimilarity = (textA: string, textB: string): number => {
    const maxLength = Math.max(textA.length, textB.length) || 1;
    const distance = calculateLevenshteinDistance(textA, textB);
    return (maxLength - distance) / maxLength;
};

/**
 * Checks if two texts are similar after normalization
 */
export const areSimilarAfterNormalization = (textA: string, textB: string, threshold: number): boolean => {
    const normalizedA = normalizeArabicText(textA);
    const normalizedB = normalizeArabicText(textB);
    return calculateSimilarity(normalizedA, normalizedB) >= threshold;
};

// ---------------------------------------------------------------------------
// 3. Text Tokenization
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 4. Sequence Alignment (Needleman-Wunsch Algorithm)
// ---------------------------------------------------------------------------

// Alignment scoring constants
const ALIGNMENT_SCORES = {
    PERFECT_MATCH: 2,
    SOFT_MATCH: 1,
    GAP_PENALTY: -1,
    MISMATCH_PENALTY: -2,
};

/**
 * Calculates alignment score for two tokens
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

interface AlignmentCell {
    score: number;
    direction: 'diagonal' | 'up' | 'left' | null;
}

type AlignedTokenPair = [string | null, string | null];

/**
 * Backtracks through scoring matrix to reconstruct optimal alignment
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
 * Performs sequence alignment using Needleman-Wunsch algorithm
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
