import type { Observation, OcrResult } from './types';

import { groupObservationsByIndex, mergeGroupedObservations } from './utils/grouping';
import { mapOcrResultToRTLObservations, normalizeObservationsX } from './utils/normalization';

type ReconstructionOptions = {
    verticalJumpFactor?: number;
    widthTolerance?: number;
};

export const reconstructParagraphs = (
    observations: Observation[],
    { verticalJumpFactor = 2, widthTolerance = 0.85 }: ReconstructionOptions = {},
) => {
    const maxWidth = Math.max(...observations.map((o) => o.bbox.width));
    const thresholdWidth = maxWidth * widthTolerance;

    const paragraphs: string[] = [];
    let currentParagraph = '';

    for (let i = 0; i < observations.length; i++) {
        const o = observations[i];
        const text = o.text.trim();

        const currentY = o.bbox.y;

        let isLargeVerticalGap = false;

        if (i > 0) {
            const prevY = observations[i - 1].bbox.y;
            const gap = currentY - prevY;

            if (i > 1) {
                const prevPrevY = observations[i - 2].bbox.y;
                const prevGap = prevY - prevPrevY;

                if (gap > prevGap * verticalJumpFactor) {
                    isLargeVerticalGap = true;
                }
            }
        }

        if (isLargeVerticalGap) {
            if (currentParagraph.trim()) {
                paragraphs.push(currentParagraph.trim());
            }
            currentParagraph = text;
        } else {
            if (currentParagraph) {
                currentParagraph += ' ';
            }
            currentParagraph += text;
        }

        const lineWidth = o.bbox.width;

        if (lineWidth < thresholdWidth) {
            if (currentParagraph.trim()) {
                paragraphs.push(currentParagraph.trim());
                currentParagraph = '';
            }
        }
    }

    if (currentParagraph.trim()) {
        paragraphs.push(currentParagraph.trim());
    }

    return paragraphs.filter(Boolean);
};

export const rebuildTextFromOCR = (ocr: OcrResult) => {
    if (ocr.observations.length === 0) {
        return '';
    }

    const observations = mapOcrResultToRTLObservations(ocr.observations, ocr.dpi.width);
    const normalized = normalizeObservationsX(observations, ocr.dpi.x || 72);
    const groups = groupObservationsByIndex(normalized, { dpi: ocr.dpi.y || 72, sortHorizontally: true });
    const merged = mergeGroupedObservations(groups);

    const paragraphs = reconstructParagraphs(merged);

    return paragraphs.join('\n');
};
