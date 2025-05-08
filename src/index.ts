import type { OcrResult } from './types';

import { groupObservationsByIndex, mergeGroupedObservations } from './utils/grouping';
import { indexObservationsAsLines, indexObservationsAsParagraphs } from './utils/indexing';
import { mapOcrResultToRTLObservations, normalizeObservationsX } from './utils/normalization';

const DEFAULT_DPI = 72;

export const FOOTER_LINE = '___';

export const mapOCRResultToParagraphObservations = (ocr: OcrResult) => {
    if (ocr.observations.length === 0) {
        return '';
    }

    const { x: dpiX = DEFAULT_DPI, y: dpiY = DEFAULT_DPI } = ocr.dpi;

    const observations = mapOcrResultToRTLObservations(ocr.observations, ocr.dpi.width);
    const normalized = normalizeObservationsX(observations, dpiX);
    let marked = indexObservationsAsLines(normalized, dpiY);
    let groups = groupObservationsByIndex(marked, { dpi: dpiY, sortHorizontally: true });
    let merged = mergeGroupedObservations(groups);

    marked = indexObservationsAsParagraphs(merged);
    groups = groupObservationsByIndex(marked, { dpi: dpiY });
    merged = mergeGroupedObservations(groups);

    const footerLine = ocr.horizontalLines?.at(-1);

    if (footerLine) {
        const insertAfter = merged.findLastIndex((o) => o.bbox.y < footerLine.y);
        const footerObservation = {
            bbox: footerLine,
            text: FOOTER_LINE,
        };

        if (insertAfter >= 0) {
            merged.splice(insertAfter + 1, 0, footerObservation);
        } else {
            console.warn('Footer not found');
        }
    }

    return merged.map((o) => o.text).join('\n');
};
