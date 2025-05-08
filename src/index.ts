import type { IndexedObservation, Observation, OcrResult } from './types';

import { groupObservationsByIndex, mergeGroupedObservations } from './utils/grouping';
import { mapOcrResultToRTLObservations, normalizeObservationsX } from './utils/normalization';
import { markObservationsWithIndex } from './utils/sorting';

type ReconstructionOptions = {
    verticalJumpFactor?: number;
    widthTolerance?: number;
};

const DEFAULT_DPI = 72;

export function markObservationsWithParagraph(
    observations: Observation[],
    { verticalJumpFactor = 2, widthTolerance = 0.85 }: ReconstructionOptions = {},
): IndexedObservation[] {
    if (observations.length === 0) return [];

    // ensure top→bottom order
    const byY = observations.slice().sort((a, b) => a.bbox.y - b.bbox.y);

    // precompute width threshold
    const maxWidth = Math.max(...byY.map((o) => o.bbox.width));
    const thresholdWidth = maxWidth * widthTolerance;

    const out: IndexedObservation[] = [];
    let index = 0;

    for (let i = 0; i < byY.length; i++) {
        const o = byY[i];

        // check for big vertical jump
        if (i > 1) {
            const prev = byY[i - 1];
            const prevPrev = byY[i - 2];
            const gap = o.bbox.y - prev.bbox.y;
            const prevGap = prev.bbox.y - prevPrev.bbox.y;
            if (gap > prevGap * verticalJumpFactor) {
                index++;
            }
        }

        // tag this line
        out.push({ ...o, index });

        // if it’s a “short” line, bump to new paragraph afterwards
        if (o.bbox.width < thresholdWidth) {
            index++;
        }
    }

    // final sort by paragraph then y (just to keep stable ordering)
    return out.toSorted((a, b) => (a.index !== b.index ? a.index - b.index : a.bbox.y - b.bbox.y));
}

export const rebuildTextFromOCR = (ocr: OcrResult) => {
    if (ocr.observations.length === 0) {
        return '';
    }

    const { x: dpiX = DEFAULT_DPI, y: dpiY = DEFAULT_DPI } = ocr.dpi;

    const observations = mapOcrResultToRTLObservations(ocr.observations, ocr.dpi.width);
    const normalized = normalizeObservationsX(observations, dpiX);
    let marked = markObservationsWithIndex(normalized, dpiY);
    let groups = groupObservationsByIndex(marked, { dpi: dpiY, sortHorizontally: true });
    let merged = mergeGroupedObservations(groups);

    console.log('merged', merged);
    marked = markObservationsWithParagraph(merged);
    groups = groupObservationsByIndex(marked, { dpi: dpiY });
    merged = mergeGroupedObservations(groups);

    return merged.map((o) => o.text).join('\n');
};
