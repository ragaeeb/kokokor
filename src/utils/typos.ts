import { FixTypoOptions, Observation, SuryaPageOcrResult } from '@/types';
import { alignTokenSequences, areSimilarAfterNormalization, calculateSimilarity } from './similarity';
import {
    handleFootnoteFusion,
    handleFootnoteSelection,
    handleStandaloneFootnotes,
    normalizeArabicText,
    tokenizeText,
} from './textUtils';

const mapBoundingBox = (box: number[]) => {
    const [x1, y1, x2, y2] = box;
    return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
};

export const mapSuryaPageResultToObservations = (surya: SuryaPageOcrResult): Observation[] => {
    return surya.text_lines.map((line) => ({ bbox: mapBoundingBox(line.bbox), text: line.text }));
};

// ---------------------------------------------------------------------------
// 5. Token Selection and Merging Logic
// ---------------------------------------------------------------------------

/**
 * Chooses the best token(s) from an aligned pair based on various criteria
 */
const selectBestTokens = (
    originalToken: string | null,
    suryaToken: string | null,
    { typoSymbols, similarityThreshold }: FixTypoOptions,
): string[] => {
    // Handle missing tokens
    if (originalToken === null) {
        return [suryaToken!];
    }
    if (suryaToken === null) {
        return [originalToken];
    }

    // Preserve original if same after normalization (keeps diacritics)
    if (normalizeArabicText(originalToken) === normalizeArabicText(suryaToken)) {
        return [originalToken];
    }

    // Handle embedded footnotes
    const result = handleFootnoteSelection(originalToken, suryaToken);
    if (result) return result;

    // Handle standalone footnotes
    const footnoteResult = handleStandaloneFootnotes(originalToken, suryaToken);
    if (footnoteResult) return footnoteResult;

    // Handle typo symbols - prefer the symbol itself
    if (typoSymbols.includes(originalToken) || typoSymbols.includes(suryaToken)) {
        const typoSymbol = typoSymbols.find((symbol) => symbol === originalToken || symbol === suryaToken);
        return typoSymbol ? [typoSymbol] : [originalToken];
    }

    // Choose based on similarity
    const normalizedOriginal = normalizeArabicText(originalToken);
    const normalizedSurya = normalizeArabicText(suryaToken);
    const similarity = calculateSimilarity(normalizedOriginal, normalizedSurya);

    return [similarity > similarityThreshold ? originalToken : suryaToken];
};

// ---------------------------------------------------------------------------
// 6. Duplicate Removal and Post-processing
// ---------------------------------------------------------------------------

/**
 * Removes duplicate tokens and handles footnote fusion
 */
const removeDuplicateTokens = (tokens: string[], highSimilarityThreshold: number): string[] => {
    if (tokens.length === 0) return tokens;

    const result: string[] = [];

    for (const currentToken of tokens) {
        if (result.length === 0) {
            result.push(currentToken);
            continue;
        }

        const previousToken = result[result.length - 1];

        // Handle ordinary echoes (similar tokens)
        if (areSimilarAfterNormalization(previousToken, currentToken, highSimilarityThreshold)) {
            // Keep the shorter version
            if (currentToken.length < previousToken.length) {
                result[result.length - 1] = currentToken;
            }
            continue;
        }

        // Handle footnote fusion cases
        if (handleFootnoteFusion(result, previousToken, currentToken)) {
            continue;
        }

        result.push(currentToken);
    }

    return result;
};

/**
 * Fixes typos in original text using Surya text as reference
 */
const processTextAlignment = (originalText: string, suryaText: string, options: FixTypoOptions): string => {
    const originalTokens = tokenizeText(originalText, options.typoSymbols);
    const suryaTokens = tokenizeText(suryaText, options.typoSymbols);

    // Handle empty inputs
    if (originalTokens.length === 0) return suryaText;
    if (suryaTokens.length === 0) return originalText;

    // Align token sequences
    const alignedPairs = alignTokenSequences(
        originalTokens,
        suryaTokens,
        options.typoSymbols,
        options.similarityThreshold,
    );

    // Select best tokens from each aligned pair
    const mergedTokens = alignedPairs.flatMap(([original, surya]) => selectBestTokens(original, surya, options));

    // Remove duplicates and handle post-processing
    const finalTokens = removeDuplicateTokens(mergedTokens, options.highSimilarityThreshold);

    return finalTokens.join(' ');
};

/**
 * Main function to find and fix typos in observation arrays
 */
export const findAndFixTypos = (
    suryaObservations: Observation[],
    observations: Observation[],
    options: FixTypoOptions,
): Observation[] => {
    if (suryaObservations.length !== observations.length) {
        throw new Error('The two observation arrays must have the same length');
    }

    const typoSymbolsRegex = new RegExp(options.typoSymbols.join('|'));

    return observations.map((observation, index) => {
        const suryaObservation = suryaObservations[index];

        if (!typoSymbolsRegex.test(suryaObservation.text)) {
            return observation;
        }

        return {
            ...observation,
            text: processTextAlignment(observation.text, suryaObservation.text, options),
        };
    });
};
