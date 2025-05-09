import type { OcrResult } from './types';

import { groupObservationsByIndex, mergeGroupedObservations, sortGroupsHorizontally } from './utils/grouping';
import { indexObservationsAsLines, indexObservationsAsParagraphs } from './utils/indexing';
import { applyFooter, mapOcrResultToRTLObservations, normalizeObservationsX } from './utils/normalization';

export type RebuildOptions = {
    readonly fallbackDPI?: number;
    readonly footerSymbol?: string;
    readonly pixelTolerance?: number;
    readonly standardDpiX?: number;
    readonly verticalJumpFactor?: number;
    readonly widthTolerance?: number;
};

export const mapOCRResultToParagraphObservations = (
    ocr: OcrResult,
    {
        fallbackDPI = 72,
        footerSymbol,
        pixelTolerance = 5,
        standardDpiX = 300,
        verticalJumpFactor = 2,
        widthTolerance = 0.85,
    }: RebuildOptions = {},
) => {
    if (ocr.observations.length === 0) {
        return ocr.observations;
    }

    const { x: dpiX = fallbackDPI, y: dpiY = fallbackDPI } = ocr.dpi;

    let observations = mapOcrResultToRTLObservations(ocr.observations, ocr.dpi.width);
    observations = normalizeObservationsX(observations, dpiX, standardDpiX);
    let marked = indexObservationsAsLines(observations, dpiY, pixelTolerance);
    let groups = groupObservationsByIndex(marked);
    groups = sortGroupsHorizontally(groups);
    observations = mergeGroupedObservations(groups);

    marked = indexObservationsAsParagraphs(observations, verticalJumpFactor, widthTolerance);
    groups = groupObservationsByIndex(marked);
    observations = mergeGroupedObservations(groups);

    if (footerSymbol && ocr.horizontalLines?.at(-1)) {
        observations = applyFooter(observations, {
            bbox: ocr.horizontalLines.at(-1)!,
            text: footerSymbol,
        });
    }

    return observations;
};

export const rebuildParagraphs = (ocr: OcrResult, options?: RebuildOptions) => {
    return mapOCRResultToParagraphObservations(ocr, options)
        .map((o) => o.text)
        .join('\n');
};

export * from './types';
