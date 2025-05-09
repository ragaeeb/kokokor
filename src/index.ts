import type { OcrResult } from './types';

import { groupObservationsByIndex, mergeGroupedObservations, sortGroupsHorizontally } from './utils/grouping';
import { indexObservationsAsLines, indexObservationsAsParagraphs } from './utils/indexing';
import { applyFooter, mapOcrResultToRTLObservations, normalizeObservationsX } from './utils/normalization';

const DEFAULT_DPI = 72;

export const FOOTER_LINE = '___';

type RebuildOptions = {
    fallbackDPI?: number;
    footerSymbol?: string;
    pixelTolerance?: number;
    standardDpiX?: number;
    verticalJumpFactor?: number;
    widthTolerance?: number;
};

export const mapOCRResultToParagraphObservations = (
    ocr: OcrResult,
    { fallbackDPI = DEFAULT_DPI }: RebuildOptions = {},
) => {
    if (ocr.observations.length === 0) {
        return ocr.observations;
    }

    const { x: dpiX = DEFAULT_DPI, y: dpiY = DEFAULT_DPI } = ocr.dpi;

    const observations = mapOcrResultToRTLObservations(ocr.observations, ocr.dpi.width);
    const normalized = normalizeObservationsX(observations, dpiX);
    let marked = indexObservationsAsLines(normalized, dpiY);
    let groups = groupObservationsByIndex(marked);
    groups = sortGroupsHorizontally(groups);
    let merged = mergeGroupedObservations(groups);

    marked = indexObservationsAsParagraphs(merged);
    groups = groupObservationsByIndex(marked);
    merged = mergeGroupedObservations(groups);

    if (ocr.horizontalLines?.at(-1) && Number(1) === 2) {
        merged = applyFooter(merged, {
            bbox: ocr.horizontalLines.at(-1)!,
            text: FOOTER_LINE,
        });
    }

    return merged;
};

export const rebuildParagraphs = (ocr: OcrResult, options?: RebuildOptions) => {
    return mapOCRResultToParagraphObservations(ocr, options)
        .map((o) => o.text)
        .join('\n');
};
