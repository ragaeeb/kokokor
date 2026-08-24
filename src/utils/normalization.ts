import type { Observation } from '@/types';

/**
 * Adjusts x-coordinates of observations for right-to-left (RTL) text processing.
 *
 * This function transforms the coordinate system to accommodate right-to-left text
 * direction, which is essential for languages like Arabic, Hebrew, Farsi, and others.
 * It flips the x-coordinate so that the rightmost edge becomes the origin (x=0),
 * enabling proper text flow analysis for RTL scripts.
 *
 * The transformation formula: `newX = imageWidth - originalX - textWidth`
 *
 * @param observations - Array of text observations with bounding box data from OCR
 * @param imageWidth - Total width of the document/image in pixels
 * @returns A new array of observations with x-coordinates adjusted for RTL text processing
 *
 * @example
 * ```typescript
 * const observations = [
 *   { bbox: { x: 100, y: 0, width: 50, height: 20 }, text: "مرحبا" }
 * ];
 * const rtlObservations = mapOcrResultToRTLObservations(observations, 800);
 * // Result: { bbox: { x: 650, y: 0, width: 50, height: 20 }, text: "مرحبا" }
 * // Original x: 100, becomes: 800 - 100 - 50 = 650
 * ```
 */
export const mapOcrResultToRTLObservations = (observations: Observation[], imageWidth: number) => {
    return observations.map((o) => ({ ...o, bbox: { ...o.bbox, x: imageWidth - o.bbox.x - o.bbox.width } }));
};

/**
 * Filters out noisy or invalid observations based on text content quality.
 *
 * This function removes observations that are likely to be OCR noise or artifacts
 * by checking if the text content meets minimum quality criteria. Currently filters
 * out observations with text shorter than 2 characters, which often represent
 * punctuation marks, single characters, or OCR errors that don't contribute
 * meaningful content to document analysis.
 *
 * @param o - Single observation to evaluate for noise filtering
 * @returns True if the observation should be kept, false if it should be filtered out
 *
 * @example
 * ```typescript
 * const observations = [
 *   { bbox: {...}, text: "Hello world" },  // Kept: length > 1
 *   { bbox: {...}, text: "." },            // Filtered: length = 1
 *   { bbox: {...}, text: "" }              // Filtered: length = 0
 * ];
 * const clean = observations.filter(filterNoisyObservations);
 * // Result: Only "Hello world" observation remains
 * ```
 */
const isArabicLetter = (character: string) => /\p{Letter}/u.test(character) && /\p{Script=Arabic}/u.test(character);

const hasNonArabicLetters = (text: string) =>
    [...text.normalize('NFKC')].some(
        (character) => /\p{Letter}/u.test(character) && !/\p{Script=Arabic}/u.test(character),
    );

/**
 * Returns whether text contains enough Arabic letters to represent useful OCR
 * content. NFKC expands Arabic presentation-form ligatures before counting.
 */
export const hasArabicText = (text: string, minimumLetterCount = 2) => {
    let arabicLetterCount = 0;
    for (const character of text.normalize('NFKC')) {
        if (isArabicLetter(character)) {
            arabicLetterCount++;
            if (arabicLetterCount >= minimumLetterCount) {
                return true;
            }
        }
    }
    return false;
};

export const filterNoisyObservations = (o: Observation, contentFilter: 'any' | 'arabic' = 'any') => {
    const normalizedText = o.text?.normalize('NFKC') ?? '';
    const hasMinimumContent = normalizedText.replace(/[،,؛;؟?۔.:\-()]/g, '').length > 1;
    if (!hasMinimumContent) {
        return false;
    }
    return contentFilter !== 'arabic' || hasArabicText(o.text);
};

const sharesTextLineVertically = (first: Observation, second: Observation) => {
    const firstBottom = first.bbox.y + first.bbox.height;
    const secondBottom = second.bbox.y + second.bbox.height;
    const verticalGap = Math.max(first.bbox.y - secondBottom, second.bbox.y - firstBottom, 0);

    // Narrow numeric table cells are sometimes placed immediately above the
    // Arabic label's box instead of overlapping it. Keep cells within one
    // compact box height; line grouping will still decide whether they belong
    // to the same physical row.
    return verticalGap <= Math.min(first.bbox.height, second.bbox.height);
};

const REFERENCE_FRAGMENT_PATTERN = /^[\p{Script=Arabic}\p{Number}\p{Mark}\s()[\]{}،؛؟.,:;/\\\-–—«»'"’“”]+$/u;

const isUsefulNumericFragment = (observation: Observation, arabicObservations: Observation[]) => {
    const normalizedText = observation.text.normalize('NFKC');
    const numberCount = [...normalizedText].filter((character) => /\p{Number}/u.test(character)).length;
    if (numberCount === 0 || !REFERENCE_FRAGMENT_PATTERN.test(normalizedText)) {
        return false;
    }
    return (
        hasArabicText(normalizedText, 1) ||
        arabicObservations.some((arabicObservation) => sharesTextLineVertically(observation, arabicObservation))
    );
};

/**
 * Applies the requested content policy while retaining credible numeric
 * fragments on pages that otherwise contain Arabic text.
 */
export const filterObservationsByContent = (observations: Observation[], contentFilter: 'any' | 'arabic' = 'any') => {
    const meaningful = observations.filter((observation) => filterNoisyObservations(observation));
    if (contentFilter !== 'arabic') {
        return meaningful;
    }

    const arabicObservations = meaningful.filter((observation) => hasArabicText(observation.text));
    if (arabicObservations.length === 0) {
        return [];
    }
    const arabicObservationSet = new Set(arabicObservations);
    const arabicContentCandidates = observations.filter(
        (observation) => filterNoisyObservations(observation) || /\p{Number}/u.test(observation.text.normalize('NFKC')),
    );
    return arabicContentCandidates.filter(
        (observation) =>
            arabicObservationSet.has(observation) ||
            (!hasNonArabicLetters(observation.text) && isUsefulNumericFragment(observation, arabicObservations)),
    );
};

/**
 * Normalizes x-coordinates of observations to create clean alignment.
 *
 * This function identifies observations that are approximately aligned to the leftmost
 * position and standardizes their x-coordinates to create visually consistent, properly
 * aligned text blocks. This is particularly useful for correcting minor OCR alignment
 * inconsistencies that can occur due to image quality, skew, or OCR engine variations.
 *
 * The alignment threshold is calculated proportionally to the DPI ratio to ensure
 * consistent behavior across different document resolutions. Observations within
 * the threshold distance from the leftmost position are snapped to that position.
 *
 * @param observations - Array of text observations to normalize for alignment
 * @param dpi - The dots per inch of the source document used for threshold calculation
 * @param standardDPI - The standard DPI to normalize against for consistent thresholds (default: 300)
 * @returns A new array of observations with normalized x-coordinates for improved alignment
 *
 * @example
 * ```typescript
 * const observations = [
 *   { bbox: { x: 50, y: 0, width: 100, height: 20 }, text: "Line 1" },
 *   { bbox: { x: 52, y: 25, width: 100, height: 20 }, text: "Line 2" }, // Slightly off
 *   { bbox: { x: 100, y: 50, width: 100, height: 20 }, text: "Indented" }
 * ];
 * const normalized = normalizeObservationsX(observations, 300);
 * // Result: First two lines aligned to x: 50, third line unchanged at x: 100
 * ```
 */
export const normalizeObservationsX = (observations: Observation[], dpi: number, standardDPI: number = 300) => {
    const thresholdPx = (standardDPI / dpi) * 5;
    const minX = Math.min(...observations.map((o) => o.bbox.x));

    return observations.map((o) => {
        if (Math.abs(o.bbox.x - minX) <= thresholdPx) {
            return { ...o, bbox: { ...o.bbox, x: minX } };
        }

        return o;
    });
};

/**
 * Simplifies an observation for debugging purposes by reducing precision and content.
 *
 * This utility function creates a simplified version of an observation that's easier
 * to read in debug output or logs. It performs two main simplifications:
 *
 * 1. **Coordinate precision**: Truncates floating-point coordinates to integers
 * 2. **Text content**: Filters to words longer than 1 character and keeps only the first word
 *
 * This is particularly useful when debugging large datasets where full observation
 * details would be overwhelming, but you need to understand the general structure
 * and positioning of text elements.
 *
 * @param observation - The observation to simplify for debugging output
 * @returns A simplified observation with truncated coordinates and reduced text content
 *
 * @example
 * ```typescript
 * const observation = {
 *   bbox: { x: 123.456, y: 78.901, width: 234.567, height: 19.123 },
 *   text: "Hello world from OCR engine"
 * };
 * const simplified = simplifyObservation(observation);
 * // Result: {
 * //   bbox: { x: 123, y: 78, width: 234, height: 19 },
 * //   text: "Hello"
 * // }
 * ```
 */
export const simplifyObservations = (observations: Observation[], truncateText = false): Observation[] => {
    return observations.map((observation) => {
        return {
            bbox: {
                height: Math.trunc(observation.bbox.height),
                width: Math.trunc(observation.bbox.width),
                x: Math.trunc(observation.bbox.x),
                y: Math.trunc(observation.bbox.y),
            },
            text: truncateText
                ? observation.text
                      .split(' ')
                      .filter((word) => word.length > 1)
                      .slice(0, 1)
                      .join(' ')
                : observation.text,
        };
    });
};
