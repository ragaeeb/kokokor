import type {
    BoundingBox,
    BuildTextBoxOptions,
    CenteringOptions,
    FixTypoOptions,
    Observation,
    ObservationLayoutInfo,
    OcrResult,
    RebuildOptions,
    TextBlock,
} from './types';

import { PTS_TO_INCHES } from './utils/constants';
import { groupObservationsByIndex, mergeGroupedObservations, sortGroupsHorizontally } from './utils/grouping';
import { isBoundingBoxContained, isObservationCentered, isPoeticLayout } from './utils/layout';
import { indexObservationsAsLines, indexObservationsAsParagraphs } from './utils/marking';
import { mapOcrResultToRTLObservations, normalizeObservationsX } from './utils/normalization';
import { findAndFixTypos, processTextAlignment } from './utils/typos';

const indexAndGroupObservations = (
    observations: Observation[],
    dpiY = PTS_TO_INCHES,
    pixelTolerance = 5,
    lineHeightFactor?: number,
) => {
    const marked = indexObservationsAsLines(observations, dpiY, pixelTolerance, lineHeightFactor);
    //assertIndicesContinuous(marked); // TODO: Remove, purely for catching bugs early during alpha stage

    return groupObservationsByIndex(marked);
};

type AlignObservationsOptions = {
    dpiX?: number;
    dpiY?: number;
    imageWidth: number;
    lineHeightFactor?: number;
    log?: boolean;
    pixelTolerance?: number;
    standardDpiX?: number;
};

export const alignAndAdjustObservations = (
    obs: Observation[],
    {
        dpiX = PTS_TO_INCHES,
        dpiY = PTS_TO_INCHES,
        imageWidth,
        lineHeightFactor,
        log,
        pixelTolerance = 5,
        standardDpiX = 300,
    }: AlignObservationsOptions,
) => {
    let observations = mapOcrResultToRTLObservations(obs, imageWidth);
    observations = normalizeObservationsX(observations, dpiX, standardDpiX);

    let groups = indexAndGroupObservations(observations, dpiY, pixelTolerance, lineHeightFactor);
    //assertIndicesContinuous(marked); // TODO: Remove, purely for catching bugs early during alpha stage

    groups = sortGroupsHorizontally(groups);

    if (log) {
        console.log('groups', 'dpiX', dpiX, 'imageWidth', imageWidth, groups);
    }

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

export const flattenObservationsToParagraphs = (
    observations: Observation[],
    verticalJumpFactor = 2,
    widthTolerance = 0.85,
) => {
    const marked = indexObservationsAsParagraphs(observations, verticalJumpFactor, widthTolerance);
    //assertIndicesContinuous(marked);

    const groups = groupObservationsByIndex(marked);
    return mergeGroupedObservations(groups);
};

type MapObservationsToTextBlocksOptions = Partial<CenteringOptions> & {
    horizontalLines?: BoundingBox[];
    imageWidth: number;
    pixelTolerance?: number;
    rectangles?: BoundingBox[];
};

export const getObservationLayoutInfo = (
    o: Observation,
    {
        centerToleranceRatio = 0.05,
        horizontalLines = [],
        imageWidth,
        minMarginRatio = 0.2,
        pixelTolerance = 5,
        rectangles = [],
    }: MapObservationsToTextBlocksOptions,
): ObservationLayoutInfo => {
    const isObservationInsideRectangle = rectangles.some((rectangle) =>
        isBoundingBoxContained(o.bbox, rectangle, pixelTolerance),
    );

    const isCentered = isObservationCentered(o.bbox, imageWidth, { centerToleranceRatio, minMarginRatio });
    const isFootnote = horizontalLines.at(-1) && o.bbox.y > horizontalLines.at(-1)!.y;

    return {
        ...(isObservationInsideRectangle && { isHeading: true }),
        ...(isCentered && { isCentered: true }),
        ...(isFootnote && { isFootnote: true }),
    };
};

export const mapObservationsToTextBlocks = (
    observations: Observation[],
    {
        centerToleranceRatio = 0.05,
        horizontalLines = [],
        imageWidth,
        minMarginRatio = 0.2,
        pixelTolerance = 5,
        rectangles = [],
    }: MapObservationsToTextBlocksOptions,
) => {
    const centerOptions = { centerToleranceRatio, minMarginRatio };

    const textBlocks: TextBlock[] = observations.map((o) => {
        return {
            ...getObservationLayoutInfo(o, {
                ...centerOptions,
                horizontalLines,
                imageWidth,
                pixelTolerance,
                rectangles,
            }),
            text: o.text,
        };
    });

    return textBlocks;
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
        lineHeightFactor,
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

    const { groups, ...adjusted } = alignAndAdjustObservations(ocr.observations, {
        dpiX,
        dpiY,
        imageWidth: ocr.dpi.width,
        lineHeightFactor,
        pixelTolerance,
        standardDpiX,
    });
    let { observations } = adjusted;

    if (typoSymbols.length > 0 && ocr.alternateObservations?.length) {
        observations = findAndFixTypos(ocr.alternateObservations, observations, {
            highSimilarityThreshold,
            log,
            similarityThreshold,
            typoSymbols,
        });
    }

    if (!isPoeticLayout(groups)) {
        observations = flattenObservationsToParagraphs(observations, verticalJumpFactor, widthTolerance);
    }

    return mapObservationsToTextBlocks(observations, {
        centerToleranceRatio,
        horizontalLines: ocr.horizontalLines,
        imageWidth: ocr.dpi.width,
        minMarginRatio,
        pixelTolerance,
        rectangles: ocr.rectangles,
    });
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

export { filterHorizontalLinesOutsideRectangles, isPoeticLayout } from './utils/layout';
export { calculateDPI } from './utils/marking';
export { areSimilarAfterNormalization, calculateSimilarity } from './utils/similarity';
export { mapSuryaBoundingBox, mapSuryaPageResultToObservations } from './utils/surya';
export { extractDigits, normalizeArabicText, PATTERNS } from './utils/textUtils';
export { findAndFixTypos } from './utils/typos';
