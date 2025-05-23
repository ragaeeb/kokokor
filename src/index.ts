import type { Observation, OcrResult, RebuildOptions } from './types';

import { groupObservationsByIndex, mergeGroupedObservations, sortGroupsHorizontally } from './utils/grouping';
import { indexObservationsAsLines, indexObservationsAsParagraphs } from './utils/indexing';
import { isPoeticLayout } from './utils/layout';
import { applyFooter, mapOcrResultToRTLObservations, normalizeObservationsX } from './utils/normalization';
import { findAndFixTypos } from './utils/typos';

const alignAndAdjustObservations = (
    obs: Observation[],
    {
        dpiWidth,
        dpiX,
        standardDpiX,
        dpiY,
        pixelTolerance,
    }: { dpiWidth: number; dpiX: number; standardDpiX: number; dpiY: number; pixelTolerance: number },
) => {
    let observations = mapOcrResultToRTLObservations(obs, dpiWidth);
    observations = normalizeObservationsX(observations, dpiX, standardDpiX);

    let marked = indexObservationsAsLines(observations, dpiY, pixelTolerance);
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
 * @returns An array of merged observations, where each item represents a complete paragraph
 */
export const mapOCRResultToParagraphObservations = (
    ocr: OcrResult,
    {
        fallbackDPI = 72,
        footerSymbol,
        pixelTolerance = 5,
        standardDpiX = 300,
        typoSymbols,
        highSimilarityThreshold = 0.8,
        similarityThreshold = 0.6,
        verticalJumpFactor = 2,
        widthTolerance = 0.85,
    }: RebuildOptions = {},
) => {
    if (ocr.observations.length === 0) {
        return ocr.observations;
    }

    const { x: dpiX = fallbackDPI, y: dpiY = fallbackDPI } = ocr.dpi;

    let { observations, groups } = alignAndAdjustObservations(ocr.observations, {
        dpiWidth: ocr.dpi.width,
        standardDpiX,
        dpiY,
        dpiX,
        pixelTolerance,
    });

    if (typoSymbols && typoSymbols.length > 0 && ocr.alternateObservations) {
        observations = findAndFixTypos(
            alignAndAdjustObservations(ocr.alternateObservations, {
                dpiWidth: ocr.dpi.width,
                standardDpiX,
                dpiY,
                dpiX,
                pixelTolerance,
            }).observations,
            observations,
            {
                typoSymbols,
                similarityThreshold,
                highSimilarityThreshold,
            },
        );
    }

    if (!isPoeticLayout(groups)) {
        const marked = indexObservationsAsParagraphs(observations, verticalJumpFactor, widthTolerance);
        //assertIndicesContinuous(marked);

        groups = groupObservationsByIndex(marked);
        observations = mergeGroupedObservations(groups);
    }

    if (footerSymbol && ocr.horizontalLines?.at(-1)) {
        observations = applyFooter(observations, {
            bbox: ocr.horizontalLines.at(-1)!,
            text: footerSymbol,
        });
    }

    return observations;
};

/**
 * Reconstructs complete paragraph text from OCR results.
 *
 * This is a convenience function that processes the OCR data using mapOCRResultToParagraphObservations,
 * then extracts and joins the text content from each paragraph with newlines to create a
 * formatted text document.
 *
 * @param ocr - The OCR result containing text observations and document metadata
 * @param options - Configuration options that control the paragraph reconstruction process
 * @returns A string containing the reconstructed text with paragraphs separated by newlines
 */
export const rebuildParagraphs = (ocr: OcrResult, options?: RebuildOptions) => {
    return mapOCRResultToParagraphObservations(ocr, options)
        .map((o) => o.text)
        .join('\n');
};

export * from './types';
