import { FixTypoOptions, Observation, SuryaPageOcrResult } from '@/types';
import { alignTokenSequences, areSimilarAfterNormalization, calculateSimilarity } from './similarity';
import {
    handleFootnoteFusion,
    handleFootnoteSelection,
    handleStandaloneFootnotes,
    normalizeArabicText,
    tokenizeText,
} from './textUtils';

/**
 * Converts bounding box coordinates from array format to object format.
 * Transforms [x1, y1, x2, y2] coordinates to {x, y, width, height} format.
 *
 * @param box - Array containing [x1, y1, x2, y2] coordinates
 * @returns Bounding box object with x, y, width, and height properties
 */
const mapBoundingBox = (box: number[]) => {
    const [x1, y1, x2, y2] = box;
    return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
};

/**
 * Converts Surya OCR page results to standardized Observation format.
 * Maps each text line from Surya format to the common Observation structure
 * used throughout the application.
 *
 * @param surya - Surya OCR page result containing text lines with bounding boxes
 * @returns Array of observations in standardized format
 */
export const mapSuryaPageResultToObservations = (surya: SuryaPageOcrResult): Observation[] => {
    return surya.text_lines.map((line) => ({ bbox: mapBoundingBox(line.bbox), text: line.text }));
};

/**
 * Selects the best token(s) from an aligned pair during typo correction.
 * Uses various heuristics including normalization, footnote handling, typo symbols,
 * and similarity scores to determine which token(s) to keep.
 *
 * @param originalToken - Token from the original OCR text (may be null)
 * @param suryaToken - Token from the Surya OCR text (may be null)
 * @param options - Configuration options including typo symbols and similarity threshold
 * @returns Array of selected tokens (usually contains one token, but may contain multiple)
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

/**
 * Removes duplicate tokens and handles footnote fusion in post-processing.
 * Identifies and removes tokens that are highly similar while preserving
 * important variations. Also handles special cases like footnote merging.
 *
 * @param tokens - Array of tokens to process
 * @param highSimilarityThreshold - Threshold for detecting duplicates (0.0 to 1.0)
 * @returns Array of tokens with duplicates removed and footnotes fused
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
 * Processes text alignment between original and Surya OCR results to fix typos.
 * Uses the Needleman-Wunsch sequence alignment algorithm to align tokens,
 * then selects the best tokens and performs post-processing.
 *
 * @param originalText - Original OCR text that may contain typos
 * @param suryaText - Reference text from Surya OCR for comparison
 * @param options - Configuration options for alignment and selection
 * @returns Corrected text with typos fixed
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
 * Main function to find and fix typos in observation arrays using Surya reference.
 * Compares original OCR observations with Surya OCR observations and applies
 * typo correction only to observations that contain specified typo symbols.
 *
 * @param suryaObservations - Reference observations from Surya OCR
 * @param observations - Original observations that may contain typos
 * @param options - Configuration options for typo detection and correction
 * @returns Array of observations with typos corrected
 * @throws Error if the observation arrays have different lengths
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
