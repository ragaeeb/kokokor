import type { BuildTextBoxOptions, Observation, OcrResult, RebuildOptions, TextBlock } from './types';

import { groupObservationsByIndex, mergeGroupedObservations, sortGroupsHorizontally } from './utils/grouping';
import { indexObservationsAsLines, indexObservationsAsParagraphs } from './utils/marking';
import {
    filterHorizontalLinesOutsideRectangles,
    isBoundingBoxContained,
    isObservationCentered,
    isPoeticLayout,
} from './utils/layout';
import { mapOcrResultToRTLObservations, normalizeObservationsX } from './utils/normalization';
import { findAndFixTypos } from './utils/typos';
import { PTS_TO_INCHES } from './utils/constants';

export const alignAndAdjustObservations = (
    obs: Observation[],
    {
        imageWidth,
        dpiX = PTS_TO_INCHES,
        standardDpiX = 300,
        lineHeightFactor = 0.49,
        dpiY = PTS_TO_INCHES,
        pixelTolerance = 5,
    }: {
        imageWidth: number;
        dpiX?: number;
        standardDpiX?: number;
        dpiY?: number;
        pixelTolerance?: number;
        lineHeightFactor?: number;
    },
) => {
    let observations = mapOcrResultToRTLObservations(obs, imageWidth);
    observations = normalizeObservationsX(observations, dpiX, standardDpiX);

    let marked = indexObservationsAsLines(observations, dpiY, pixelTolerance, lineHeightFactor);
    //assertIndicesContinuous(marked); // TODO: Remove, purely for catching bugs early during alpha stage

    let groups = groupObservationsByIndex(marked);
    groups = sortGroupsHorizontally(groups);

    return { observations: mergeGroupedObservations(groups), groups };
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
        fallbackDPI = PTS_TO_INCHES,
        pixelTolerance = 5,
        standardDpiX = 300,
        centerToleranceRatio = 0.05,
        minMarginRatio = 0.2,
        lineHeightFactor = 0.49,
        typoSymbols = [],
        highSimilarityThreshold = 0.8,
        similarityThreshold = 0.6,
        verticalJumpFactor = 2,
        widthTolerance = 0.85,
    }: BuildTextBoxOptions = {},
) => {
    if (ocr.observations.length === 0) {
        return [];
    }

    const { x: dpiX = fallbackDPI, y: dpiY = fallbackDPI } = ocr.dpi;

    let { observations, groups } = alignAndAdjustObservations(ocr.observations, {
        imageWidth: ocr.dpi.width,
        standardDpiX,
        dpiY,
        dpiX,
        pixelTolerance,
        lineHeightFactor,
    });

    if (typoSymbols.length > 0 && ocr.alternateObservations?.length) {
        observations = findAndFixTypos(ocr.alternateObservations, observations, {
            typoSymbols,
            similarityThreshold,
            highSimilarityThreshold,
        });
    }

    if (!isPoeticLayout(groups)) {
        const marked = indexObservationsAsParagraphs(observations, verticalJumpFactor, widthTolerance);
        //assertIndicesContinuous(marked);

        groups = groupObservationsByIndex(marked);
        observations = mergeGroupedObservations(groups);
    }

    let { rectangles = [], horizontalLines = [] } = ocr;

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

export { extractDigits, normalizeArabicText, PATTERNS } from './utils/textUtils';
export { mapSuryaPageResultToObservations, mapSuryaBoundingBox } from './utils/surya';
export { calculateSimilarity, areSimilarAfterNormalization } from './utils/similarity';
export { calculateDPI } from './utils/marking';
