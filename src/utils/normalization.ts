import type { Observation } from '@/types';

export const mapOcrResultToRTLObservations = (observations: Observation[], imageWidth: number) => {
    return observations.map((o) => ({ ...o, bbox: { ...o.bbox, x: imageWidth - o.bbox.x - o.bbox.width } }));
};

export const normalizeObservationsX = (observations: Observation[], dpi: number, standardDPI: number) => {
    const thresholdPx = (standardDPI / dpi) * 5;
    const minX = Math.min(...observations.map((o) => o.bbox.x));

    return observations.map((o) => {
        if (Math.abs(o.bbox.x - minX) <= thresholdPx) {
            return { ...o, bbox: { ...o.bbox, x: minX } };
        }

        return o;
    });
};

export const applyFooter = (observations: Observation[], footer: Observation) => {
    const insertAfter = observations.findLastIndex((o) => o.bbox.y < footer.bbox.y);

    if (insertAfter >= 0) {
        const observationsWithFooter = observations.slice();
        observationsWithFooter.splice(insertAfter + 1, 0, footer);

        return observationsWithFooter;
    }

    console.warn('Footer not found');

    return observations;
};
