import type { BuildTextBoxOptions, FixTypoOptions, Observation, OcrResult, RebuildOptions, TextBlock } from './types';

import { PTS_TO_INCHES } from './utils/constants';
import { groupObservationsByIndex, mergeGroupedObservations, sortGroupsHorizontally } from './utils/grouping';
import {
    filterHorizontalLinesOutsideRectangles,
    isBoundingBoxContained,
    isObservationCentered,
    isPoeticLayout,
} from './utils/layout';
import { indexObservationsAsLines, indexObservationsAsParagraphs } from './utils/marking';
import { mapOcrResultToRTLObservations, normalizeObservationsX } from './utils/normalization';
import { findAndFixTypos, processTextAlignment } from './utils/typos';

export const alignAndAdjustObservations = (
    obs: Observation[],
    {
        dpiX = PTS_TO_INCHES,
        dpiY = PTS_TO_INCHES,
        imageWidth,
        lineHeightFactor = 0.49,
        pixelTolerance = 5,
        standardDpiX = 300,
    }: {
        dpiX?: number;
        dpiY?: number;
        imageWidth: number;
        lineHeightFactor?: number;
        pixelTolerance?: number;
        standardDpiX?: number;
    },
) => {
    let observations = mapOcrResultToRTLObservations(obs, imageWidth);
    observations = normalizeObservationsX(observations, dpiX, standardDpiX);

    const marked = indexObservationsAsLines(observations, dpiY, pixelTolerance, lineHeightFactor);
    //assertIndicesContinuous(marked); // TODO: Remove, purely for catching bugs early during alpha stage

    let groups = groupObservationsByIndex(marked);
    groups = sortGroupsHorizontally(groups);

    return { groups, observations: mergeGroupedObservations(groups) };
};

export const fixTypo = (
    original: string,
    correction: string,
    {
        highSimilarityThreshold = 0.8,
        similarityThreshold = 0.6,
        typoSymbols,
    }: Partial<FixTypoOptions> & Pick<FixTypoOptions, 'typoSymbols'>,
) => {
    return processTextAlignment(original, correction, { highSimilarityThreshold, similarityThreshold, typoSymbols });
};

/**
 * Processes OCR result data to identify and reconstruct paragraphs from individual text observations.
 *
 * This function performs several operations to transform raw OCR observations into coherent paragraphs:
 * 1. Adjusts coordinates for right-to-left text if needed
 * 2. Normalizes x-coordinates to align similar positions
 * 3. Groups observations into lines based on vertical proximity
 * 4. Sorts line contents horizontally for proper reading order
 * 5. Groups lines into paragraphs based on vertical spacing patterns and line widths
 * 6. Optionally adds footer text if horizontal lines are detected in the document
 *
 * @param ocr - The OCR result containing text observations and document metadata
 * @param options - Configuration options that control the paragraph reconstruction process
 * @returns An array of text blocks, where each item represents a complete paragraph along with metadata.
 */
export const buildTextBlocksFromOCR = (
    ocr: OcrResult,
    {
        centerToleranceRatio = 0.05,
        fallbackDPI = PTS_TO_INCHES,
        highSimilarityThreshold = 0.8,
        lineHeightFactor = 0.49,
        log,
        minMarginRatio = 0.2,
        pixelTolerance = 5,
        similarityThreshold = 0.6,
        standardDpiX = 300,
        typoSymbols = [],
        verticalJumpFactor = 2,
        widthTolerance = 0.85,
    }: BuildTextBoxOptions = {},
) => {
    if (ocr.observations.length === 0) {
        return [];
    }

    const { x: dpiX = fallbackDPI, y: dpiY = fallbackDPI } = ocr.dpi;

    let { groups, observations } = alignAndAdjustObservations(ocr.observations, {
        dpiX,
        dpiY,
        imageWidth: ocr.dpi.width,
        lineHeightFactor,
        pixelTolerance,
        standardDpiX,
    });

    if (typoSymbols.length > 0 && ocr.alternateObservations?.length) {
        observations = findAndFixTypos(ocr.alternateObservations, observations, {
            highSimilarityThreshold,
            log,
            similarityThreshold,
            typoSymbols,
        });
    }

    if (!isPoeticLayout(groups)) {
        const marked = indexObservationsAsParagraphs(observations, verticalJumpFactor, widthTolerance);
        //assertIndicesContinuous(marked);

        groups = groupObservationsByIndex(marked);
        observations = mergeGroupedObservations(groups);
    }

    let { horizontalLines = [] } = ocr;
    const { rectangles = [] } = ocr;

    if (rectangles.length > 0 && horizontalLines.length > 0) {
        horizontalLines = filterHorizontalLinesOutsideRectangles(rectangles, horizontalLines, pixelTolerance);
    }

    const lastHorizontalLine = horizontalLines.at(-1);
    const centerOptions = { centerToleranceRatio, minMarginRatio };

    const textBlocks: TextBlock[] = observations.map((o) => {
        const isObservationInsideRectangle = rectangles.some((rectangle) =>
            isBoundingBoxContained(o.bbox, rectangle, pixelTolerance),
        );

        const isCentered = isObservationCentered(o, ocr.dpi.width, centerOptions);

        return {
            ...(isCentered && { isCentered: true }),
            ...(o.confidence && o.confidence < 1 && { isEdited: true }),
            ...(lastHorizontalLine && o.bbox.y > lastHorizontalLine.y && { isFootnote: true }),
            ...(isObservationInsideRectangle && { isHeading: true }),
            text: o.text,
        };
    });

    return textBlocks;
};

export const mapTextBlocksToParagraphs = (textBlocks: TextBlock[], footerSymbol?: string) => {
    let isAtLeastOneFootnoteHit = false;

    const paragraphs = textBlocks.flatMap((t) => {
        if (footerSymbol && t.isFootnote && !isAtLeastOneFootnoteHit) {
            isAtLeastOneFootnoteHit = true;
            return [footerSymbol, t.text];
        }

        if (t.isHeading) {
            return [t.text, ''];
        }

        return [t.text];
    });

    return paragraphs.join('\n');
};

/**
 * Reconstructs complete paragraph text from OCR results.
 *
 * This is a convenience function that processes the OCR data using buildTextBlocksFromOCR,
 * then extracts and joins the text content from each paragraph with newlines to create a
 * formatted text document.
 *
 * @param ocr - The OCR result containing text observations and document metadata
 * @param options - Configuration options that control the paragraph reconstruction process
 * @returns A string containing the reconstructed text with paragraphs separated by newlines
 */
export const rebuildParagraphs = (ocr: OcrResult, options?: RebuildOptions) => {
    return mapTextBlocksToParagraphs(buildTextBlocksFromOCR(ocr, options), options?.footerSymbol);
};

export * from './types';

export { calculateDPI } from './utils/marking';
export { areSimilarAfterNormalization, calculateSimilarity } from './utils/similarity';
export { mapSuryaBoundingBox, mapSuryaPageResultToObservations } from './utils/surya';
export { extractDigits, normalizeArabicText, PATTERNS } from './utils/textUtils';
export { findAndFixTypos } from './utils/typos';
